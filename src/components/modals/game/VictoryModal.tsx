import React from "react";
import {View, Text, Modal, TouchableOpacity} from "react-native";
import type {SubmittedGuess} from "../../../hooks/types";
import {TYPOGRAPHY} from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {NewCoins} from "@/components/shared/NewCoins";
import {verticalScale} from "@/utils/responsive";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";
import HomeBg from "../../../../assets/images/home-bg.svg";

/**
 * Props for the victory feedback modal shown after a successful solve.
 */
interface VictoryModalProps {
  /** Controls modal visibility state. */
  isVisible: boolean;
  /** Number of attempts used to solve the riddle. */
  attempts: number;
  /** Coin reward earned for this win. */
  coinsEarned: number;
  /** Optional list of achievement names unlocked by this win. */
  unlockedAchievementNames?: string[];
  /** Optional current wallet balance shown in the summary strip. */
  totalCoins: number;
  /** Callback for advancing to the next level/riddle. */
  onNextLevel: () => void;
  /** Submitted guesses used to build shareable emoji summary. */
  guesses: SubmittedGuess[];
  /** Game mode label included in share analytics/payload. */
  gameMode?: "daily" | "classic";
  /** Closes the modal. */
  onClose: () => void;
}

/**
 * Celebratory modal with rewards, optional achievement fanfare, and sharing CTA.
 *
 * @param props Victory details and user action callbacks.
 * @returns Animated victory modal view.
 */
const VictoryModal: React.FC<VictoryModalProps> = ({isVisible, coinsEarned, totalCoins, onNextLevel, onClose}) => {
  const modalHeight = MODAL_HEIGHT * 1.2;

  /**
   * Advances to the next level and closes the modal afterward.
   */
  const handleNextLevel = async () => {
    await Promise.resolve(onNextLevel?.());
    onClose?.();
  };

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
        <RotatingWheelBackground isVisible={isVisible} />
        <SlideInModalContent isVisible={isVisible}>
          <TouchableOpacity
            testID="victory-card-pressable"
            accessibilityRole="button"
            accessibilityLabel={AppStrings.VictoryModal.NEXT_LEVEL_BUTTON}
            activeOpacity={1}
            onPress={() => {
              void handleNextLevel();
            }}
            style={{
              width: MODAL_WIDTH,
              height: modalHeight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModalBg
              width={MODAL_WIDTH}
              height={modalHeight}
              preserveAspectRatio="none"
              style={{position: "absolute"}}
            />
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={MODAL_HEIGHT * 1.1}
              style={{position: "absolute", top: -MODAL_HEIGHT * 0.1, left: -MODAL_WIDTH * 0.05}}
            />

            <View
              style={{
                flex: 1,
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                padding: MODAL_CONTENT_PADDING,
                marginBottom: verticalScale(20),
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["4xl"],
                  color: "black",
                  marginTop: 20,
                }}
              >
                {AppStrings.VictoryModal.TITLE}
              </Text>

              <NewCoins coinsEarned={coinsEarned} totalCoins={totalCoins} />
            </View>
          </TouchableOpacity>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default VictoryModal;
