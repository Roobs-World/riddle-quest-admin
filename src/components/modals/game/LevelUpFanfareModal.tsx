import React, {useEffect, useState} from "react";
import {Animated, Easing, Modal, Text, TouchableOpacity, View} from "react-native";
import {TYPOGRAPHY} from "../../../styles";
import {
  MODAL_WIDTH,
  MODAL_CONTENT_PADDING,
  MODAL_BUTTON_SPACER,
  MODAL_MAX_SCREEN_HEIGHT_FRACTION,
  getResponsiveModalHeight,
} from "../../../constants/layout";
import {t} from "../../../i18n";
import {verticalScale} from "@/utils/responsive";
import {ModalReward} from "@/components/rewards/RewardFactory";
import RotatingWheelBackground from "../../shared/RotatingWheelBackground";
import type {ModalSequenceProgress} from "../../../types/ModalTypes";
import ModalSequenceBreadcrumb from "../ModalSequenceBreadcrumb";
import WideButton from "../../buttons/WideButton";
import DecoratedModalShell from "../../shared/DecoratedModalShell";
import RankBadge from "../../progression/RankBadge";
import ProfileIcon from "../../icons/ProfileIcon";
import {getRankForLevel} from "../../../constants/ranks";
import {isQASurfaceRuntimeActive} from "../../../qa/qaRuntime";

interface LevelUpFanfareModalProps {
  isVisible: boolean;
  newLevel: number;
  coinsAwarded: number;
  totalCoins: number;
  sequenceProgress?: ModalSequenceProgress;
  onContinue?: () => void;
  onClose: () => void;
}

export const LEVEL_UP_FANFARE_MODAL_HEIGHT_MULTIPLIER = 1.72;

const LEVEL_UP_FANFARE_MODAL_HEIGHT = getResponsiveModalHeight(
  LEVEL_UP_FANFARE_MODAL_HEIGHT_MULTIPLIER,
  MODAL_MAX_SCREEN_HEIGHT_FRACTION,
);

const LevelUpFanfareModal: React.FC<LevelUpFanfareModalProps> = ({
  isVisible,
  newLevel,
  coinsAwarded,
  totalCoins,
  sequenceProgress,
  onContinue,
  onClose,
}) => {
  const continueButtonText = sequenceProgress?.primaryActionText ?? t("LevelUpFanfare.CONTINUE_BUTTON");
  const rank = getRankForLevel(newLevel);
  const [entranceScale] = useState(() => new Animated.Value(0.58));
  const [entranceOpacity] = useState(() => new Animated.Value(0));
  const [crestRotation] = useState(() => new Animated.Value(-1));

  useEffect(() => {
    entranceScale.stopAnimation();
    entranceOpacity.stopAnimation();
    crestRotation.stopAnimation();

    if (!isVisible) {
      return;
    }

    if (isQASurfaceRuntimeActive() || process.env.NODE_ENV === "test") {
      entranceScale.setValue(1);
      entranceOpacity.setValue(1);
      crestRotation.setValue(0);
      return;
    }

    entranceScale.setValue(0.58);
    entranceOpacity.setValue(0);
    crestRotation.setValue(-1);
    const animations = [
      Animated.timing(entranceScale, {
        toValue: 1,
        duration: 720,
        easing: Easing.out(Easing.back(1.55)),
        useNativeDriver: true,
      }),
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(crestRotation, {
        toValue: 0,
        duration: 760,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ];

    if (typeof Animated.parallel === "function") {
      Animated.parallel(animations).start();
    } else {
      animations.forEach((animation) => animation.start());
    }
  }, [crestRotation, entranceOpacity, entranceScale, isVisible, newLevel]);

  const crestRotate = crestRotation.interpolate({
    inputRange: [-1, 0],
    outputRange: ["-18deg", "0deg"],
  });

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
          backgroundColor: "rgba(0,0,0,0.5)",
          paddingTop: verticalScale(30),
        }}
      >
        <RotatingWheelBackground isVisible={isVisible} />

        <DecoratedModalShell
          isVisible={isVisible}
          width={MODAL_WIDTH}
          height={LEVEL_UP_FANFARE_MODAL_HEIGHT}
          frameStyle={{alignItems: "center"}}
          contentStyle={{justifyContent: "center"}}
          modalBgTestID="level-up-fanfare-background"
        >
          <TouchableOpacity
            key="level-up-modal"
            onPress={handleContinue}
            style={{width: MODAL_WIDTH, height: LEVEL_UP_FANFARE_MODAL_HEIGHT}}
          >
            <View
              testID="level-up-fanfare-frame"
              style={{
                width: MODAL_WIDTH,
                height: LEVEL_UP_FANFARE_MODAL_HEIGHT,
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
                  testID="level-up-entrance-animation"
                  style={{
                    alignItems: "center",
                    opacity: entranceOpacity,
                    transform: [{scale: entranceScale}],
                  }}
                >
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontPrimary,
                      fontSize: TYPOGRAPHY.fontSize["3xl"],
                      color: "black",
                      textAlign: "center",
                      marginTop: verticalScale(-30),
                    }}
                  >
                    {t("LevelUpFanfare.TITLE")}
                  </Text>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondaryBold,
                      fontSize: TYPOGRAPHY.fontSize["2xl"],
                      color: "black",
                      marginBottom: 6,
                    }}
                  >
                    {`${t("LevelUpFanfare.LEVEL_PREFIX")}${newLevel}`}
                  </Text>
                  <Animated.View style={{transform: [{rotate: crestRotate}], marginBottom: 4}}>
                    <RankBadge
                      rank={rank}
                      size={68}
                      showLabel
                      labelColor="#401F40"
                      testID="level-up-rank-badge"
                    />
                  </Animated.View>
                  <ModalReward amount={coinsAwarded} totalCoins={totalCoins} />
                </Animated.View>

                <View
                  testID="level-up-profile-guidance"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingHorizontal: 10,
                  }}
                >
                  <ProfileIcon color="#401F40" width={24} height={24} />
                  <Text
                    style={{
                      flexShrink: 1,
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.sm,
                      color: "#401F40",
                      textAlign: "center",
                    }}
                  >
                    {t("LevelUpFanfare.PROFILE_GUIDANCE")}
                  </Text>
                </View>

                <View style={{width: "100%"}}>
                  <WideButton
                    buttonText={continueButtonText}
                    onPress={handleContinue}
                    testID="level-up-continue-button"
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

export default LevelUpFanfareModal;
