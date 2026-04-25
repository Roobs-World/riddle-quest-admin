import React, {useMemo, useState, useEffect} from "react";
import {View, Text, Modal, Animated, Easing} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WheelBg from "../../../../assets/images/wheel-bg.svg";
import {TYPOGRAPHY} from "../../../styles";
import {AchievementUnlockFanfareItem} from "../../../types/ModalTypes";
import WideButton from "../../buttons/WideButton";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_BUTTON_SPACER,
  wheelSize,
} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {NewCoins} from "@/components/shared/NewCoins";
import {verticalScale} from "@/utils/responsive";

interface AchievementUnlockFanfareModalProps {
  isVisible: boolean;
  coinsEarned: number;
  totalCoins: number;
  achievementNames?: string[];
  achievements?: AchievementUnlockFanfareItem[];
  onContinue?: () => void;
  onClose: () => void;
}

const AchievementUnlockFanfareModal: React.FC<AchievementUnlockFanfareModalProps> = ({
  isVisible,
  coinsEarned,
  totalCoins,
  achievementNames = [],
  achievements = [],
  onContinue,
  onClose,
}) => {
  const [rotationAnim] = useState(() => new Animated.Value(0));
  const modalBgHeight = MODAL_HEIGHT * 1.6;
  const modalBgOffsetY = -(modalBgHeight - MODAL_HEIGHT) / 2;

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
        }),
      );
      animation.start();
    }

    return () => {
      animation?.stop();
      rotationAnim.stopAnimation();
      rotationAnim.setValue(0);
    };
  }, [isVisible, rotationAnim]);

  const primaryAchievementName =
    achievements[0]?.name ?? achievementNames[0] ?? AppStrings.Achievements.NEW_ACHIEVEMENT;
  const primaryAchievementDescription = achievements[0]?.description ?? "";
  const primaryAchievementIcon = achievements[0]?.icon ?? "";

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
        <SlideInModalContent isVisible={isVisible}>
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
              height={modalBgHeight}
              preserveAspectRatio="none"
              style={{position: "absolute", top: modalBgOffsetY}}
            />

            <View
              style={{
                position: "absolute",
                width: MODAL_WIDTH,
                height: modalBgHeight,
                top: modalBgOffsetY,
              }}
            >
              <MaskedView
                style={{
                  width: MODAL_WIDTH,
                  height: modalBgHeight,
                }}
                maskElement={
                  <View
                    style={{
                      width: MODAL_WIDTH,
                      height: modalBgHeight,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ModalBg width={MODAL_WIDTH} height={modalBgHeight} preserveAspectRatio="none" />
                  </View>
                }
              >
                <View
                  style={{
                    width: MODAL_WIDTH,
                    height: modalBgHeight,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Animated.View
                    style={{
                      position: "absolute",
                      opacity: 0.25,
                      transform: [{rotate: spin}],
                      marginTop: verticalScale(-90),
                    }}
                  >
                    <WheelBg width={wheelSize * 1.4} height={wheelSize * 1.4} />
                  </Animated.View>
                </View>
              </MaskedView>
            </View>

            <View
              style={{
                position: "absolute",
                width: MODAL_WIDTH,
                height: MODAL_HEIGHT,
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

              <View style={{alignItems: "center", maxWidth: "90%"}}>
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
              </View>

              <NewCoins coinsEarned={coinsEarned} totalCoins={totalCoins} />

              <View style={{width: "100%"}}>
                <WideButton
                  buttonText={AppStrings.Achievements.NICE_BUTTON}
                  onPress={() => {
                    onContinue?.();
                    onClose();
                  }}
                />
              </View>
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default AchievementUnlockFanfareModal;
