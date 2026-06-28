import React, {useRef} from "react";
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
import {t} from "../../../i18n";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {ModalReward, type RewardAnimationHandle} from "@/components/rewards/RewardFactory";
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
  showRotatingBackground?: boolean;
  onContinue?: () => void;
  onClose: () => void;
}

export const STREAK_INCREASE_FANFARE_MODAL_HEIGHT_MULTIPLIER = 1.2;

const STREAK_INCREASE_FANFARE_MODAL_HEIGHT = getResponsiveModalHeight(
  STREAK_INCREASE_FANFARE_MODAL_HEIGHT_MULTIPLIER,
  MODAL_MAX_SCREEN_HEIGHT_FRACTION,
);

const StreakIncreaseFanfareModal: React.FC<StreakIncreaseFanfareModalProps> = ({
  isVisible,
  streakValue,
  coinsAwarded,
  totalCoins,
  sequenceProgress,
  showRotatingBackground = true,
  onContinue,
  onClose,
}) => {
  const continueButtonText = sequenceProgress?.primaryActionText ?? t("StreakFanfare.CONTINUE_BUTTON");
  const rewardRef = useRef<RewardAnimationHandle>(null);
  const isContinuingRef = useRef(false);
  const handleContinue = () => {
    if (isContinuingRef.current) {
      return;
    }

    isContinuingRef.current = true;

    const finish = async () => {
      await Promise.resolve(onContinue?.());
      onClose();
      isContinuingRef.current = false;
    };

    if (process.env.NODE_ENV === "test") {
      void rewardRef.current?.play();
      onContinue?.();
      onClose();
      isContinuingRef.current = false;
      return;
    }

    void (async () => {
      try {
        await rewardRef.current?.play();
        await finish();
      } catch {
        isContinuingRef.current = false;
      }
    })();
  };

  return (
    <Modal transparent animationType="none" visible={isVisible} onRequestClose={handleContinue}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: showRotatingBackground ? "rgba(0,0,0,0.5)" : "transparent",
        }}
      >
        {showRotatingBackground ? <RotatingWheelBackground isVisible={isVisible} /> : null}
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <TouchableOpacity key={"streak-increase-fanfare-modal"} onPress={handleContinue}>
            <View
              testID="streak-increase-fanfare-frame"
              style={{
                width: MODAL_WIDTH,
                height: STREAK_INCREASE_FANFARE_MODAL_HEIGHT,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ModalBg
                testID="streak-increase-fanfare-background"
                width={MODAL_WIDTH}
                height={STREAK_INCREASE_FANFARE_MODAL_HEIGHT}
                style={{position: "absolute"}}
                preserveAspectRatio="none"
              />
              {/* Decorative wave - clipped to card bounds */}
              <HomeBg
                width={MODAL_WIDTH * 1.1}
                height={STREAK_INCREASE_FANFARE_MODAL_HEIGHT * 1.05}
                style={{
                  position: "absolute",
                  top: -STREAK_INCREASE_FANFARE_MODAL_HEIGHT * 0.05,
                  left: -MODAL_WIDTH * 0.05,
                }}
              />

              <View
                style={{
                  position: "absolute",
                  width: MODAL_WIDTH,
                  height: STREAK_INCREASE_FANFARE_MODAL_HEIGHT,
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
                  {t("StreakFanfare.TITLE")}
                </Text>

                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    fontSize: TYPOGRAPHY.fontSize["2xl"],
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {`${streakValue}${t("StreakFanfare.STREAK_SUFFIX")}`}
                </Text>

                <ModalReward ref={rewardRef} amount={coinsAwarded} totalCoins={totalCoins} />

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
