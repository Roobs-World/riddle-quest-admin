import React from "react";
import {View, Text, Modal, TouchableOpacity} from "react-native";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {TYPOGRAPHY} from "../../../styles";
import {AchievementUnlockFanfareItem} from "../../../types/ModalTypes";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, MODAL_BUTTON_SPACER} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {NewCoins} from "@/components/shared/NewCoins";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";
import type {ModalSequenceProgress} from "../../../types/ModalTypes";
import ModalSequenceBreadcrumb from "../ModalSequenceBreadcrumb";
import WideButton from "../../buttons/WideButton";

interface AchievementUnlockFanfareModalProps {
  isVisible: boolean;
  coinsEarned: number;
  totalCoins: number;
  achievementNames?: string[];
  achievements?: AchievementUnlockFanfareItem[];
  sequenceProgress?: ModalSequenceProgress;
  onContinue?: () => void;
  onClose: () => void;
}

const AchievementUnlockFanfareModal: React.FC<AchievementUnlockFanfareModalProps> = ({
  isVisible,
  coinsEarned,
  totalCoins,
  achievementNames = [],
  achievements = [],
  sequenceProgress,
  onContinue,
  onClose,
}) => {
  const modalBgHeight = MODAL_HEIGHT * 1.6;
  const modalBgOffsetY = -(modalBgHeight - MODAL_HEIGHT) / 2;

  const primaryAchievementName =
    achievements[0]?.name ?? achievementNames[0] ?? AppStrings.Achievements.NEW_ACHIEVEMENT;
  const primaryAchievementDescription = achievements[0]?.description ?? "";
  const primaryAchievementIcon = achievements[0]?.icon ?? "";
  const continueButtonText =
    sequenceProgress?.primaryActionText ?? AppStrings.Achievements.NICE_BUTTON;
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
        }}
      >
        <RotatingWheelBackground isVisible={isVisible} />
        <SlideInModalContent isVisible={isVisible}>
          <TouchableOpacity testID="achievement-unlock-fanfare-modal" onPress={handleContinue}>
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
              <HomeBg
                width={MODAL_WIDTH * 1.1}
                height={MODAL_HEIGHT * 1.1}
                style={{position: "absolute", top: -MODAL_HEIGHT * 0.25, left: -MODAL_WIDTH * 0.05}}
              />

              <View
                style={{
                  position: "absolute",
                  width: MODAL_WIDTH,
                  height: MODAL_HEIGHT,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: MODAL_BUTTON_SPACER,
                  padding: MODAL_CONTENT_PADDING,
                }}
              >
                <ModalSequenceBreadcrumb sequenceProgress={sequenceProgress} />
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
                    buttonText={continueButtonText}
                    onPress={handleContinue}
                    testID="achievement-unlock-continue-button"
                  />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default AchievementUnlockFanfareModal;
