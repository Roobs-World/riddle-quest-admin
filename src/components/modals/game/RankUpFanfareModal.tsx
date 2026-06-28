import React, {useEffect, useState} from "react";
import {Animated, Easing, Modal, Text, TouchableOpacity, View} from "react-native";
import {TYPOGRAPHY} from "../../../styles";
import {
  MODAL_BUTTON_SPACER,
  MODAL_CONTENT_PADDING,
  MODAL_MAX_SCREEN_HEIGHT_FRACTION,
  MODAL_WIDTH,
  getResponsiveModalHeight,
} from "../../../constants/layout";
import {t} from "../../../i18n";
import {verticalScale} from "../../../utils/responsive";
import RotatingWheelBackground from "../../shared/RotatingWheelBackground";
import type {ModalSequenceProgress} from "../../../types/ModalTypes";
import ModalSequenceBreadcrumb from "../ModalSequenceBreadcrumb";
import WideButton from "../../buttons/WideButton";
import DecoratedModalShell from "../../shared/DecoratedModalShell";
import RankBadge from "../../progression/RankBadge";
import {getRankForLevel} from "../../../constants/ranks";
import {isQASurfaceRuntimeActive} from "../../../qa/qaRuntime";

interface RankUpFanfareModalProps {
  isVisible: boolean;
  newLevel: number;
  sequenceProgress?: ModalSequenceProgress;
  showRotatingBackground?: boolean;
  onContinue?: () => void;
  onClose: () => void;
}

export const RANK_UP_FANFARE_MODAL_HEIGHT_MULTIPLIER = 1.55;

const RANK_UP_FANFARE_MODAL_HEIGHT = getResponsiveModalHeight(
  RANK_UP_FANFARE_MODAL_HEIGHT_MULTIPLIER,
  MODAL_MAX_SCREEN_HEIGHT_FRACTION,
);

const RankUpFanfareModal: React.FC<RankUpFanfareModalProps> = ({
  isVisible,
  newLevel,
  sequenceProgress,
  showRotatingBackground = true,
  onContinue,
  onClose,
}) => {
  const continueButtonText = sequenceProgress?.primaryActionText ?? t("RankUpFanfare.CONTINUE_BUTTON");
  const rank = getRankForLevel(newLevel);
  const [entranceScale] = useState(() => new Animated.Value(0.62));
  const [entranceOpacity] = useState(() => new Animated.Value(0));
  const [badgeLift] = useState(() => new Animated.Value(10));

  useEffect(() => {
    entranceScale.stopAnimation();
    entranceOpacity.stopAnimation();
    badgeLift.stopAnimation();

    if (!isVisible) {
      return;
    }

    if (isQASurfaceRuntimeActive() || process.env.NODE_ENV === "test") {
      entranceScale.setValue(1);
      entranceOpacity.setValue(1);
      badgeLift.setValue(0);
      return;
    }

    entranceScale.setValue(0.62);
    entranceOpacity.setValue(0);
    badgeLift.setValue(10);

    const animations = [
      Animated.timing(entranceScale, {
        toValue: 1,
        duration: 680,
        easing: Easing.out(Easing.back(1.45)),
        useNativeDriver: true,
      }),
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(badgeLift, {
        toValue: 0,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ];

    if (typeof Animated.parallel === "function") {
      Animated.parallel(animations).start();
    } else {
      animations.forEach((animation) => animation.start());
    }
  }, [badgeLift, entranceOpacity, entranceScale, isVisible, newLevel]);

  const handleContinue = () => {
    onContinue?.();
    onClose();
  };

  return (
    <Modal transparent animationType="none" visible={isVisible} onRequestClose={handleContinue}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: showRotatingBackground ? "rgba(0,0,0,0.5)" : "transparent",
          paddingTop: verticalScale(24),
        }}
      >
        {showRotatingBackground ? <RotatingWheelBackground isVisible={isVisible} /> : null}

        <DecoratedModalShell
          isVisible={isVisible}
          width={MODAL_WIDTH}
          height={RANK_UP_FANFARE_MODAL_HEIGHT}
          frameStyle={{alignItems: "center"}}
          contentStyle={{justifyContent: "center"}}
          modalBgTestID="rank-up-fanfare-background"
        >
          <TouchableOpacity
            testID="rank-up-fanfare-modal"
            onPress={handleContinue}
            activeOpacity={0.9}
            style={{width: MODAL_WIDTH, height: RANK_UP_FANFARE_MODAL_HEIGHT}}
          >
            <View
              testID="rank-up-fanfare-frame"
              style={{
                width: MODAL_WIDTH,
                height: RANK_UP_FANFARE_MODAL_HEIGHT,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  flex: 1,
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: MODAL_BUTTON_SPACER,
                  padding: MODAL_CONTENT_PADDING,
                }}
              >
                <ModalSequenceBreadcrumb sequenceProgress={sequenceProgress} />
                <Animated.View
                  testID="rank-up-entrance-animation"
                  style={{
                    alignItems: "center",
                    opacity: entranceOpacity,
                    transform: [{scale: entranceScale}, {translateY: badgeLift}],
                  }}
                >
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontPrimary,
                      fontSize: TYPOGRAPHY.fontSize["3xl"],
                      color: "black",
                      textAlign: "center",
                      marginTop: verticalScale(-18),
                    }}
                  >
                    {t("RankUpFanfare.TITLE")}
                  </Text>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondaryBold,
                      fontSize: TYPOGRAPHY.fontSize.base,
                      color: "#401F40",
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    {t("RankUpFanfare.SUBTITLE")}
                  </Text>
                  <RankBadge
                    rank={rank}
                    size={88}
                    showLabel
                    labelColor="#401F40"
                    testID="rank-up-rank-badge"
                  />
                  <Text
                    testID="rank-up-rank-description"
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.base,
                      color: "rgba(0,0,0,0.72)",
                      textAlign: "center",
                      marginTop: 10,
                      maxWidth: "88%",
                    }}
                  >
                    {t(rank.descriptionKey)}
                  </Text>
                </Animated.View>

                <View style={{width: "100%"}}>
                  <WideButton
                    buttonText={continueButtonText}
                    onPress={handleContinue}
                    testID="rank-up-continue-button"
                  />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </DecoratedModalShell>
      </View>
    </Modal>
  );
};

export default RankUpFanfareModal;
