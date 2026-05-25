import React from "react";
import {View, Text, Modal, TouchableOpacity} from "react-native";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {TYPOGRAPHY} from "../../../styles";
import {
  MODAL_WIDTH,
  MODAL_CONTENT_PADDING,
  MODAL_BUTTON_SPACER,
  MODAL_MAX_SCREEN_HEIGHT_FRACTION,
  getResponsiveModalHeight,
} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {verticalScale} from "@/utils/responsive";
import {NewCoins} from "@/components/shared/NewCoins";
import RotatingWheelBackground from "../../shared/RotatingWheelBackground";
import type {ModalSequenceProgress} from "../../../types/ModalTypes";
import ModalSequenceBreadcrumb from "../ModalSequenceBreadcrumb";
import WideButton from "../../buttons/WideButton";

interface LevelUpFanfareModalProps {
  isVisible: boolean;
  newLevel: number;
  coinsAwarded: number;
  totalCoins: number;
  sequenceProgress?: ModalSequenceProgress;
  onContinue?: () => void;
  onClose: () => void;
}

export const LEVEL_UP_FANFARE_MODAL_HEIGHT_MULTIPLIER = 1.55;

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
  const continueButtonText =
    sequenceProgress?.primaryActionText ?? AppStrings.LevelUpFanfare.CONTINUE_BUTTON;
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

        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <TouchableOpacity key={"coin-purchase-modal"} onPress={handleContinue}>
            <View
              testID="level-up-fanfare-frame"
              style={{
                width: MODAL_WIDTH,
                height: LEVEL_UP_FANFARE_MODAL_HEIGHT,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <ModalBg
                testID="level-up-fanfare-background"
                width={MODAL_WIDTH}
                height={LEVEL_UP_FANFARE_MODAL_HEIGHT}
                style={{position: "absolute"}}
                preserveAspectRatio="none"
              />
              <HomeBg
                width={MODAL_WIDTH * 1.1}
                height={LEVEL_UP_FANFARE_MODAL_HEIGHT * 1.1}
                style={{
                  position: "absolute",
                  top: -LEVEL_UP_FANFARE_MODAL_HEIGHT * 0.05,
                  left: -MODAL_WIDTH * 0.05,
                }}
              />

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
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontPrimary,
                    fontSize: TYPOGRAPHY.fontSize["3xl"],
                    color: "black",
                    textAlign: "center",
                    marginTop: verticalScale(-40),
                  }}
                >
                  {AppStrings.LevelUpFanfare.TITLE}
                </Text>

                <View style={{alignItems: "center"}}>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondaryBold,
                      fontSize: TYPOGRAPHY.fontSize["2xl"],
                      color: "black",
                      marginBottom: 6,
                    }}
                  >
                    {`${AppStrings.LevelUpFanfare.LEVEL_PREFIX}${newLevel}`}
                  </Text>

                  <NewCoins coinsEarned={coinsAwarded} totalCoins={totalCoins} />
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
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default LevelUpFanfareModal;
