import React from "react";
import {View, Text, Modal, TouchableOpacity} from "react-native";
import {TYPOGRAPHY} from "../../../styles";
import {AchievementUnlockFanfareItem} from "../../../types/ModalTypes";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_BUTTON_SPACER,
  MODAL_MAX_HEIGHT,
} from "../../../constants/layout";
import {t} from "../../../i18n";
import {NewCoins} from "@/components/shared/NewCoins";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";
import type {ModalSequenceProgress} from "../../../types/ModalTypes";
import ModalSequenceBreadcrumb from "../ModalSequenceBreadcrumb";
import WideButton from "../../buttons/WideButton";
import DecoratedModalShell from "../../shared/DecoratedModalShell";

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
  const modalHeight = Math.min(MODAL_HEIGHT * 1, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT * 1);
  const modalBgHeight = Math.min(MODAL_HEIGHT * 1.6, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT * 1.6);
  const modalBgOffsetY = -(modalBgHeight - MODAL_HEIGHT) / 2;

  const primaryAchievementName =
    achievements[0]?.name ?? achievementNames[0] ?? t("Achievements.NEW_ACHIEVEMENT");
  const primaryAchievementDescription = achievements[0]?.description ?? "";
  const primaryAchievementIcon = achievements[0]?.icon ?? "";
  const continueButtonText = sequenceProgress?.primaryActionText ?? t("Achievements.NICE_BUTTON");
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
        <DecoratedModalShell
          isVisible={isVisible}
          width={MODAL_WIDTH}
          height={modalHeight}
          frameStyle={{alignItems: "center"}}
          contentStyle={{justifyContent: "center"}}
          modalBgStyle={{top: modalBgOffsetY}}
          homeBgStyle={{top: -modalHeight * 0.25}}
          homeHeightMultiplier={1.1}
          homeTopOffsetMultiplier={0.25}
        >
          <TouchableOpacity testID="achievement-unlock-fanfare-modal" onPress={handleContinue} style={{width: "100%", height: "100%"}}>
            <View
              style={{
                width: "100%",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  width: MODAL_WIDTH,
                  height: modalHeight,
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
                  {t("Achievements.FANFARE_TITLE")}
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
        </DecoratedModalShell>
      </View>
    </Modal>
  );
};

export default AchievementUnlockFanfareModal;
