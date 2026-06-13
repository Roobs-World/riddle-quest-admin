import React, {useEffect, useRef, useState} from "react";
import {Animated, Dimensions, Easing, Modal, Pressable, Text, View} from "react-native";
import {t} from "../../i18n";
import {COLORS, SPACING, TYPOGRAPHY} from "../../styles";
import {isQASurfaceRuntimeActive} from "../../qa/qaRuntime";
import {logger} from "../../utils/logger";
import TooltipCalloutShell from "./TooltipCalloutShell";
import type {TargetRect, TooltipContent} from "./types";

interface TooltipOverlayProps {
  visible: boolean;
  targetRect: TargetRect | null;
  content: TooltipContent;
  onDismiss: () => void;
  onExited?: () => void;
}

const ANIMATION_DURATION_MS = 360;
const BUTTON_BOUNCE_SCALE = 1.06;
const BUTTON_BOUNCE_HALF_MS = 175; // half of the total 350ms bounce

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TooltipOverlay: React.FC<TooltipOverlayProps> = ({visible, targetRect, content, onDismiss, onExited}) => {
  const [translateY] = useState(() => new Animated.Value(Dimensions.get("window").height + 80));
  const [opacity] = useState(() => new Animated.Value(0));
  const [buttonScale] = useState(() => new Animated.Value(1));
  const [isModalMounted, setIsModalMounted] = useState(visible);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    logger.debug("[TooltipOverlay] visibility changed", {
      visible,
      title: content.title,
      targetRect,
    });

    if (visible) {
      setIsModalMounted(true);
    }

    const isQASurfaceRuntime = isQASurfaceRuntimeActive();
    const height = Dimensions.get("window").height;
    const toTranslateY = visible ? 0 : height + 80;
    const easing = visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic);

    if (isQASurfaceRuntime) {
      animationRef.current?.stop();
      translateY.setValue(toTranslateY);
      opacity.setValue(visible ? 1 : 0);
      buttonScale.setValue(1);

      if (!visible && previousVisibleRef.current) {
        logger.debug("[TooltipOverlay] QA surface exit complete, clearing overlay", {
          title: content.title,
        });
        onExited?.();
        setIsModalMounted(false);
      }

      previousVisibleRef.current = visible;
      return;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: toTranslateY,
        duration: ANIMATION_DURATION_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: ANIMATION_DURATION_MS,
        easing,
        useNativeDriver: true,
      }),
    ]).start(({finished}) => {
      logger.debug("[TooltipOverlay] animation finished", {
        finished,
        visible,
        title: content.title,
      });

      if (finished && !visible) {
        logger.debug("[TooltipOverlay] exit complete, clearing overlay", {
          title: content.title,
        });
        onExited?.();
        setIsModalMounted(false);
      }
    });

    previousVisibleRef.current = visible;
  }, [buttonScale, content.title, onExited, opacity, targetRect, translateY, visible]);

  useEffect(() => {
    if (isQASurfaceRuntimeActive()) {
      buttonScale.setValue(1);
      animationRef.current?.stop();
      return;
    }

    if (visible) {
      const pulse = Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: BUTTON_BOUNCE_SCALE,
          duration: BUTTON_BOUNCE_HALF_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 1,
          duration: BUTTON_BOUNCE_HALF_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

      animationRef.current = Animated.loop(pulse);
      animationRef.current.start();
    } else {
      animationRef.current?.stop();
      Animated.timing(buttonScale, {toValue: 1, duration: 120, useNativeDriver: true}).start();
    }

    return () => {
      animationRef.current?.stop();
    };
  }, [visible, buttonScale]);

  const overlayPointerEvents = visible ? "auto" : "none";

  return (
      <Modal
      animationType="none"
      transparent={true}
      visible={isModalMounted}
      onRequestClose={onDismiss}
      presentationStyle="overFullScreen"
    >
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 1000,
        }}
        testID="tooltip-overlay"
      >
        <Animated.View
          pointerEvents={overlayPointerEvents}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            transform: [{translateY}],
            opacity,
          }}
        >
          <TooltipCalloutShell
            visible={visible}
            targetRect={targetRect}
            showBackdropCutout={true}
            showPointer={Boolean(targetRect)}
            panelStyle={{opacity: 1}}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.xl,
                color: "#1A1A1A",
                marginBottom: SPACING.xs,
              }}
            >
              {content.title}
            </Text>
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontSecondary,
                fontSize: TYPOGRAPHY.fontSize.base,
                color: "#1A1A1A",
                lineHeight: 22,
              }}
            >
              {content.body}
            </Text>
            <AnimatedPressable
              onPress={() => {
                logger.debug("[TooltipOverlay] dismiss button pressed", {
                  title: content.title,
                  targetRect,
                });
                onDismiss();
              }}
              accessibilityRole="button"
              accessibilityLabel={content.action}
              style={[
                {transform: [{scale: buttonScale}]},
                {
                  alignSelf: "flex-end",
                  backgroundColor: COLORS.figmaGold,
                  borderRadius: 12,
                  paddingHorizontal: SPACING.md,
                  paddingVertical: SPACING.sm,
                  marginTop: SPACING.md,
                },
              ]}
              testID="tooltip-dismiss-button"
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondaryBold,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "#1A1A1A",
                }}
              >
                {content.action || t("CommonAlerts.OK_BUTTON")}
              </Text>
            </AnimatedPressable>
          </TooltipCalloutShell>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default TooltipOverlay;
