import React, {useRef} from "react";
import {View, Text, Modal, Pressable} from "react-native";
import type {SubmittedGuess} from "../../../hooks/types";
import {TYPOGRAPHY} from "../../../styles";
import {
  MODAL_WIDTH, MODAL_CONTENT_PADDING, MODAL_MAX_SCREEN_HEIGHT_FRACTION, getResponsiveModalHeight, } from "../../../constants/layout";
import {t} from "../../../i18n";
import {ModalReward, type RewardAnimationHandle} from "@/components/rewards/RewardFactory";
import {verticalScale} from "@/utils/responsive";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";
import WideButton from "../../buttons/WideButton";
import {generateFeedbackEmojiGrid} from "../../../utils/gameUtils";
import {SocialSharingService} from "../../../services/SocialSharingService";
import type {ModalSequenceProgress} from "../../../types/ModalTypes";
import ModalSequenceBreadcrumb from "../ModalSequenceBreadcrumb";
import DecoratedModalShell from "../../shared/DecoratedModalShell";

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
  /** Daily streak displayed beneath the reward chest. */
  streakValue?: number;
  /** Callback for advancing to the next level/riddle. */
  onNextLevel: () => void;
  /** Submitted guesses used to build shareable emoji summary. */
  guesses: SubmittedGuess[];
  /** Game mode label included in share analytics/payload. */
  gameMode?: "daily" | "classic";
  sequenceProgress?: ModalSequenceProgress;
  showRotatingBackground?: boolean;
  /** Closes the modal. */
  onClose: () => void;
}

export const VICTORY_MODAL_HEIGHT_MULTIPLIER = 1.42;
export const VICTORY_TITLE_TOP_OFFSET = verticalScale(30);

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
  streakValue,
  onNextLevel,
  guesses,
  gameMode,
  sequenceProgress,
  showRotatingBackground = true,
  onClose,
}) => {
  const modalHeight = getResponsiveModalHeight(VICTORY_MODAL_HEIGHT_MULTIPLIER, MODAL_MAX_SCREEN_HEIGHT_FRACTION);
  const nextButtonText = sequenceProgress?.primaryActionText ?? t("VictoryModal.NEXT_LEVEL_BUTTON");
  const rewardRef = useRef<RewardAnimationHandle>(null);
  const isContinuingRef = useRef(false);

  /**
   * Advances to the next level and closes the modal afterward.
   */
  const handleNextLevel = async () => {
    if (isContinuingRef.current) {
      return;
    }

    isContinuingRef.current = true;

    if (process.env.NODE_ENV === "test") {
      void rewardRef.current?.play();
      await Promise.resolve(onNextLevel?.());
      onClose?.();
      isContinuingRef.current = false;
      return;
    }

    try {
      await rewardRef.current?.play();
      await Promise.resolve(onNextLevel?.());
      onClose?.();
    } finally {
      isContinuingRef.current = false;
    }
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
    <Modal
      transparent
      animationType="none"
      visible={isVisible}
      onRequestClose={() => {
        void handleNextLevel();
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: showRotatingBackground ? "rgba(0,0,0,0.5)" : "transparent",
        }}
      >
        {showRotatingBackground ? <RotatingWheelBackground isVisible={isVisible} /> : null}
        <DecoratedModalShell
          isVisible={isVisible}
          width={MODAL_WIDTH}
          height={modalHeight}
          frameStyle={{alignItems: "center"}}
          contentStyle={{justifyContent: "center"}}
          modalBgTestID="victory-modal-background"
        >
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
              <ModalSequenceBreadcrumb sequenceProgress={sequenceProgress} />
              <Text
                testID="victory-title-text"
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["4xl"],
                  color: "black",
                  textAlign: "center",
                  marginTop: VICTORY_TITLE_TOP_OFFSET,
                }}
              >
                {t("VictoryModal.TITLE")}
              </Text>

              <ModalReward ref={rewardRef} amount={coinsEarned} totalCoins={totalCoins} streakValue={streakValue} />

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
        </DecoratedModalShell>
      </View>
    </Modal>
  );
};

export default VictoryModal;
