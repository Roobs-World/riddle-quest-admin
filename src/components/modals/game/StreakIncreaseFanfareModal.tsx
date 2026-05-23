import React from "react";
import {View, Text, Modal, TouchableOpacity} from "react-native";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {TYPOGRAPHY} from "../../../styles";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, MODAL_BUTTON_SPACER, MODAL_MAX_HEIGHT} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {NewCoins} from "@/components/shared/NewCoins";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";
import type {ModalSequenceProgress} from "../../../types/ModalTypes";
import ModalSequenceBreadcrumb from "../ModalSequenceBreadcrumb";
import WideButton from "../../buttons/WideButton";

interface StreakIncreaseFanfareModalProps {
  isVisible: boolean;
  streakValue: number;
  coinsAwarded: number;
  totalCoins: number;
  sequenceProgress?: ModalSequenceProgress;
  onContinue?: () => void;
  onClose: () => void;
}

const StreakIncreaseFanfareModal: React.FC<StreakIncreaseFanfareModalProps> = ({
  isVisible,
  streakValue,
  coinsAwarded,
  totalCoins,
  sequenceProgress,
  onContinue,
  onClose,
}) => {
  const streakModalHeight = Math.min(MODAL_HEIGHT * 1.4, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT * 1.4);
  const continueButtonText =
    sequenceProgress?.primaryActionText ?? AppStrings.StreakFanfare.CONTINUE_BUTTON;
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
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <TouchableOpacity key={"streak-increase-fanfare-modal"} onPress={handleContinue}>
            <View
              style={{
                width: MODAL_WIDTH,
                height: streakModalHeight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ModalBg
                width={MODAL_WIDTH}
                height={streakModalHeight}
                style={{position: "absolute"}}
                preserveAspectRatio="none"
              />
              {/* Decorative wave - clipped to card bounds */}
              <HomeBg
                width={MODAL_WIDTH * 1.1}
                height={streakModalHeight * 1.05}
                style={{position: "absolute", top: -streakModalHeight * 0.05, left: -MODAL_WIDTH * 0.05}}
              />

              <View
                style={{
                  position: "absolute",
                  width: MODAL_WIDTH,
                  height: streakModalHeight,
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
                  {AppStrings.StreakFanfare.TITLE}
                </Text>

                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    fontSize: TYPOGRAPHY.fontSize["2xl"],
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {`${streakValue}${AppStrings.StreakFanfare.STREAK_SUFFIX}`}
                </Text>

                <NewCoins coinsEarned={coinsAwarded} totalCoins={totalCoins} />

                <View style={{width: "100%"}}>
                  <WideButton
                    buttonText={continueButtonText}
                    onPress={handleContinue}
                    testID="streak-increase-continue-button"
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

export default StreakIncreaseFanfareModal;
