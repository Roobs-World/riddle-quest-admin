import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Modal, Animated, Easing } from "react-native";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WheelBg from "../../../../assets/images/wheel-bg.svg";
import CoinSvg from "../../../../assets/images/coin.svg";
import WideButton from "../../buttons/WideButton";
import { TYPOGRAPHY } from "../../../styles";
import { AchievementUnlockFanfareItem } from "../../../types/ModalTypes";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_BUTTON_SPACER,
  wheelSize,
} from "../../../constants/layout";
import { AppStrings } from "../../../constants/AppStrings";

interface AchievementUnlockFanfareModalProps {
  isVisible: boolean;
  coinsEarned: number;
  achievementNames?: string[];
  achievements?: AchievementUnlockFanfareItem[];
  onClose: () => void;
}

const AchievementUnlockFanfareModal: React.FC<
  AchievementUnlockFanfareModalProps
> = ({
  isVisible,
  coinsEarned,
  achievementNames = [],
  achievements = [],
  onClose,
}) => {
  const [rotationAnim] = useState(() => new Animated.Value(0));

  const spin = useMemo(() => {
    return rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
  }, [rotationAnim]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isVisible) {
      rotationAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 12000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
    }

    return () => {
      animation?.stop();
      rotationAnim.stopAnimation();
      rotationAnim.setValue(0);
    };
  }, [isVisible, rotationAnim]);

  const hasAchievementDetails = achievements.length > 0;
  const primaryAchievementName =
    achievements[0]?.name ?? achievementNames[0] ?? AppStrings.Achievements.NEW_ACHIEVEMENT;
  const primaryAchievementDescription = achievements[0]?.description ?? "";
  const primaryAchievementIcon = achievements[0]?.icon ?? "";
  const achievementCount = hasAchievementDetails
    ? achievements.length
    : achievementNames.length;
  const extraCount = Math.max(0, achievementCount - 1);

  return (
    <Modal transparent animationType="fade" visible={isVisible} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            width: MODAL_WIDTH,
            height: MODAL_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg
            width={MODAL_WIDTH}
            height={MODAL_HEIGHT}
            style={{ position: "absolute" }}
          />

          <View
            style={{
              position: "absolute",
              width: MODAL_WIDTH,
              height: MODAL_HEIGHT,
              overflow: "hidden",
              borderRadius: 30,
            }}
          >
            <Animated.View
              style={{
                position: "absolute",
                left: (MODAL_WIDTH - wheelSize) / 2,
                top: (MODAL_HEIGHT - wheelSize) / 2,
                opacity: 0.25,
                transform: [{ rotate: spin }],
              }}
            >
              <WheelBg width={wheelSize} height={wheelSize} />
            </Animated.View>
          </View>

          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
              gap: MODAL_BUTTON_SPACER * 2,
              padding: MODAL_CONTENT_PADDING,
            }}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize["3xl"],
                color: "black",
                textAlign: "center",
              }}
            >
              {AppStrings.Achievements.FANFARE_TITLE}
            </Text>

            <View style={{ alignItems: "center", maxWidth: "90%" }}>
              {primaryAchievementIcon ? (
                <Text
                  style={{
                    fontSize: TYPOGRAPHY.fontSize["4xl"],
                    marginBottom: 8,
                  }}
                >
                  {primaryAchievementIcon}
                </Text>
              ) : null}
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondaryBold,
                  fontSize: TYPOGRAPHY.fontSize["2xl"],
                  color: "black",
                  textAlign: "center",
                }}
              >
                {primaryAchievementName}
              </Text>
              {primaryAchievementDescription ? (
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "black",
                    marginTop: 6,
                    textAlign: "center",
                  }}
                >
                  {primaryAchievementDescription}
                </Text>
              ) : null}
              {extraCount > 0 ? (
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "black",
                    marginTop: 6,
                    textAlign: "center",
                  }}
                >
                  +{extraCount}{AppStrings.Achievements.MORE_UNLOCKED_SUFFIX}
                </Text>
              ) : null}
            </View>

            {coinsEarned > 0 ? (
              <View style={{ alignItems: "center" }}>
                <CoinSvg width={32} height={32} />
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    fontSize: TYPOGRAPHY.fontSize["2xl"],
                    color: "black",
                    marginTop: 6,
                  }}
                >
                  +{coinsEarned}
                  {AppStrings.Achievements.COINS_SUFFIX}
                </Text>
              </View>
            ) : null}

            <View style={{ width: "100%", marginTop: 8 }}>
              <WideButton buttonText={AppStrings.Achievements.NICE_BUTTON} onPress={onClose} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AchievementUnlockFanfareModal;
