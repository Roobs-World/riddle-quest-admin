import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  Text,
  View,
} from "react-native";
import { AppStrings } from "../../constants/AppStrings";
import { COLORS, SPACING, TYPOGRAPHY } from "../../styles";
import type { TargetRect, TooltipContent } from "./types";

interface TooltipOverlayProps {
  visible: boolean;
  targetRect: TargetRect | null;
  content: TooltipContent;
  onDismiss: () => void;
  onExited?: () => void;
}

const SCREEN_PADDING = 18;
const TARGET_PADDING = 8;
const PANEL_WIDTH = Math.min(Dimensions.get("window").width - SCREEN_PADDING * 2, 340);
const ANIMATION_DURATION_MS = 360;

const TooltipOverlay: React.FC<TooltipOverlayProps> = ({
  visible,
  targetRect,
  content,
  onDismiss,
  onExited,
}) => {
  const [translateY] = useState(
    () => new Animated.Value(Dimensions.get("window").height + 80)
  );
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const height = Dimensions.get("window").height;
    const toTranslateY = visible ? 0 : height + 80;
    const easing = visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic);

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
    ]).start(({ finished }) => {
      if (finished && !visible) {
        onExited?.();
      }
    });
  }, [onExited, opacity, translateY, visible]);

  const cutout = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    if (!targetRect) {
      return null;
    }

    const x = Math.max(0, targetRect.x - TARGET_PADDING);
    const y = Math.max(0, targetRect.y - TARGET_PADDING);
    const right = Math.min(width, targetRect.x + targetRect.width + TARGET_PADDING);
    const bottom = Math.min(height, targetRect.y + targetRect.height + TARGET_PADDING);

    return {
      x,
      y,
      width: Math.max(0, right - x),
      height: Math.max(0, bottom - y),
      rightWidth: Math.max(0, width - right),
      bottomHeight: Math.max(0, height - bottom),
    };
  }, [targetRect]);

  const panelPosition = useMemo(() => {
    const { height, width } = Dimensions.get("window");
    if (!targetRect) {
      return {
        left: SCREEN_PADDING,
        top: Math.max(SCREEN_PADDING, Math.round(height * 0.18)),
      };
    }

    const preferredAbove = targetRect.y > height * 0.45;
    const panelTop = preferredAbove
      ? Math.max(SCREEN_PADDING, targetRect.y - 190)
      : Math.min(height - 190, targetRect.y + targetRect.height + 28);
    const targetCenter = targetRect.x + targetRect.width / 2;
    const panelLeft = Math.min(
      width - PANEL_WIDTH - SCREEN_PADDING,
      Math.max(SCREEN_PADDING, targetCenter - PANEL_WIDTH / 2)
    );

    return { left: panelLeft, top: panelTop };
  }, [targetRect]);

  return (
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
      {cutout ? (
        <>
          <Animated.View
            pointerEvents="auto"
            testID="tooltip-backdrop-top"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: cutout.y,
              backgroundColor: "rgba(0,0,0,0.3)",
              opacity,
            }}
          />
          <Animated.View
            pointerEvents="auto"
            testID="tooltip-backdrop-left"
            style={{
              position: "absolute",
              top: cutout.y,
              left: 0,
              width: cutout.x,
              height: cutout.height,
              backgroundColor: "rgba(0,0,0,0.3)",
              opacity,
            }}
          />
          <Animated.View
            pointerEvents="auto"
            testID="tooltip-target-cutout"
            style={{
              position: "absolute",
              top: cutout.y,
              left: cutout.x,
              width: cutout.width,
              height: cutout.height,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: COLORS.figmaGold,
            }}
          />
          <Animated.View
            pointerEvents="auto"
            testID="tooltip-backdrop-right"
            style={{
              position: "absolute",
              top: cutout.y,
              right: 0,
              width: cutout.rightWidth,
              height: cutout.height,
              backgroundColor: "rgba(0,0,0,0.3)",
              opacity,
            }}
          />
          <Animated.View
            pointerEvents="auto"
            testID="tooltip-backdrop-bottom"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: cutout.y + cutout.height,
              height: cutout.bottomHeight,
              backgroundColor: "rgba(0,0,0,0.3)",
              opacity,
            }}
          />
        </>
      ) : (
        <Animated.View
          pointerEvents="auto"
          testID="tooltip-backdrop"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            opacity,
          }}
        />
      )}

      <Animated.View
        pointerEvents="auto"
        style={{
          position: "absolute",
          width: PANEL_WIDTH,
          left: panelPosition.left,
          top: panelPosition.top,
          transform: [{ translateY }],
          opacity,
          backgroundColor: "#FCFAF4",
          borderRadius: 16,
          padding: SPACING.md,
          borderWidth: 2,
          borderColor: COLORS.figmaGold,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
        testID="tooltip-panel"
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
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={content.action}
          style={{
            alignSelf: "flex-end",
            backgroundColor: COLORS.figmaGold,
            borderRadius: 12,
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.sm,
            marginTop: SPACING.md,
          }}
          testID="tooltip-dismiss-button"
        >
          <Text
            style={{
              fontFamily: TYPOGRAPHY.fontSecondaryBold,
              fontSize: TYPOGRAPHY.fontSize.base,
              color: "#1A1A1A",
            }}
          >
            {content.action || AppStrings.CommonAlerts.OK_BUTTON}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

export default TooltipOverlay;
