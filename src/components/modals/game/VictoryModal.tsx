import React from "react";
import {View, Text, Modal, Pressable} from "react-native";
import type {SubmittedGuess} from "../../../hooks/types";
import {TYPOGRAPHY} from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import {
  MODAL_WIDTH, MODAL_CONTENT_PADDING, MODAL_MAX_SCREEN_HEIGHT_FRACTION, getResponsiveModalHeight, } from "../../../constants/layout";
import {t} from "../../../i18n";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {NewCoins} from "@/components/shared/NewCoins";
import {verticalScale} from "@/utils/responsive";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WideButton from "../../buttons/WideButton";
import {generateFeedbackEmojiGrid} from "../../../utils/gameUtils";
import {SocialSharingService} from "../../../services/SocialSharingService";
import type {ModalSequenceProgress} from "../../../types/ModalTypes";
import ModalSequenceBreadcrumb from "../ModalSequenceBreadcrumb";

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
  totalCoins?: number;
  /** Callback for advancing to the next level/riddle. */
  onNextLevel: () => void;
  /** Submitted guesses used to build shareable emoji summary. */
  guesses: SubmittedGuess[];
  /** Game mode label included in share analytics/payload. */
  gameMode?: "daily" | "classic";
  sequenceProgress?: ModalSequenceProgress;
  /** Closes the modal. */
  onClose: () => void;
}

export const VICTORY_MODAL_HEIGHT_MULTIPLIER = 1.55;

/**
 * Celebratory modal with rewards, optional achievement fanfare, and sharing CTA.
 *
 * @param props Victory details and user action callbacks.
 * @returns Animated victory modal view.
 */
const VictoryModal: React.FC<VictoryModalProps> = ({
  isVisible,
  attempts,
  coinsEarned,
  totalCoins = coinsEarned,
  onNextLevel,
  guesses,
  gameMode,
  sequenceProgress,
  onClose,
}) => {
  const modalHeight = getResponsiveModalHeight(VICTORY_MODAL_HEIGHT_MULTIPLIER, MODAL_MAX_SCREEN_HEIGHT_FRACTION);
  const nextButtonText = sequenceProgress?.primaryActionText ?? t("VictoryModal.NEXT_LEVEL_BUTTON");

  /**
   * Advances to the next level and closes the modal afterward.
   */
  const handleNextLevel = async () => {
    await Promise.resolve(onNextLevel?.());
    onClose?.();
  };

  /**
   * Shares the current win summary using the platform-native share sheet.
   */
  const handleShare = async () => {
    await SocialSharingService.share("system", {
      attempts,
      emojiGrid: generateFeedbackEmojiGrid(guesses),
      gameMode: gameMode ?? "daily",
    });
  };

  return (
    <Modal transparent animationType="none" visible={isVisible} onRequestClose={onClose}>
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
          <Pressable
            style={{
              width: MODAL_WIDTH,
              height: modalHeight,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => {
              void handleNextLevel();
            }}
            testID="victory-modal-tap-target"
          >
            <ModalBg
              testID="victory-modal-background"
              width={MODAL_WIDTH}
              height={modalHeight}
              preserveAspectRatio="none"
              style={{position: "absolute"}}
            />
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={modalHeight * 1.05}
              style={{position: "absolute", top: -modalHeight * 0.08, left: -MODAL_WIDTH * 0.05}}
            />

            <View
              style={{
                flex: 1,
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                padding: MODAL_CONTENT_PADDING,
                paddingBottom: MODAL_CONTENT_PADDING + verticalScale(20),
              }}
            >
              <View style={{marginTop: 20}}>
                <ModalSequenceBreadcrumb sequenceProgress={sequenceProgress} />
              </View>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["4xl"],
                  color: "black",
                }}
              >
                {t("VictoryModal.TITLE")}
              </Text>

              <NewCoins coinsEarned={coinsEarned} totalCoins={totalCoins} />

              <View style={{width: "100%"}}>
                <WideButton
                  buttonText={t("VictoryModal.SHARE_TEXT")}
                  onPress={() => {
                    void handleShare();
                  }}
                  testID="victory-share-button"
                />
                <View style={{height: verticalScale(10)}} />
                <WideButton
                  buttonText={nextButtonText}
                  onPress={() => {
                    void handleNextLevel();
                  }}
                  testID="victory-next-button"
                />
              </View>
            </View>
          </Pressable>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default VictoryModal;
