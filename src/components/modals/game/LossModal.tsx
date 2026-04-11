/**
 * @fileoverview Loss Modal Component
 *
 * A feedback modal that appears when a player fails to solve a riddle within
 * the allowed attempts. This modal provides closure by revealing the correct
 * answer, offers emotional support through encouraging messaging, and presents
 * clear options for continuing their gaming session.
 *
 * **Key Features:**
 * - Clear loss state communication with supportive messaging
 * - Correct answer revelation for learning and closure
 * - Immediate next level option to encourage continued engagement
 * - Alternative navigation to main menu for session management
 * - Accessibility support for all interaction elements
 *
 * **Psychology & UX:**
 * - Minimizes frustration by immediately showing the answer
 * - Provides learning opportunity through answer revelation
 * - Encourages immediate re-engagement with prominent next level option
 * - Offers graceful exit without penalty or shame
 * - Uses supportive rather than punitive language and design
 *
 * **Design Patterns:**
 * - Error modal variant with red accent color
 * - Information-focused layout prioritizing answer display
 * - Clear action hierarchy (next level primary, home secondary)
 * - Consistent modal structure and responsive design
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 *
 * @see {@link VictoryModal} For success state counterpart
 */

import React from "react";
import { View, Text, Modal } from "react-native";
import { TYPOGRAPHY } from "../../../styles";
import WideButton from "../../buttons/WideButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, MODAL_BUTTON_SPACER } from "../../../constants/layout";

/**
 * Props interface for the LossModal component.
 *
 * Defines all required properties for rendering the loss state modal
 * with appropriate answer display and navigation options.
 */
interface LossModalProps {
  /** Controls the visibility state of the modal */
  isVisible: boolean;

  /** The correct answer to display for player learning */
  correctAnswer: string;

  /** Callback function executed when user chooses to go to the next level */
  onNext: () => void;

  /** Callback function executed when user chooses to return to main menu */
  onHome: () => void;

  /** Function to close the modal (from BaseModalProps) */
  onClose?: () => void;

  /** When provided, shows a "Watch Ad" button to continue with extra attempts */
  onWatchAdContinue?: () => void | boolean | Promise<void | boolean>;

  /** When provided, shows a "Use Coins" button to continue with extra attempts */
  onCoinContinue?: () => void | boolean | Promise<void | boolean>;

  /** Coin cost shown on the coin-continue button */
  coinContinueCost?: number;

  /** Whether the rewarded ad is ready (disables the watch-ad button if false) */
  canWatchAd?: boolean;

  /** Whether the user has enough coins (disables the coin button if false) */
  canUseCoin?: boolean;
}

/**
 * Loss Modal Component
 *
 * Displays when a player fails to solve a riddle, providing the correct answer
 * and options for next steps. The modal focuses on learning and encouragement
 * rather than punishment, helping maintain player engagement and motivation.
 */
const LossModal: React.FC<LossModalProps> = ({
  isVisible,
  correctAnswer,
  onNext,
  onHome,
  onClose,
  onWatchAdContinue,
  onCoinContinue,
  coinContinueCost,
  canWatchAd,
  canUseCoin,
}) => {
  const showContinueOptions = !!(onWatchAdContinue || onCoinContinue);

  /**
   * Handles skipping to the next level and closes the modal afterward.
   */
  const handleNextLevel = async () => {
    if (typeof onNext === "function") {
      await Promise.resolve(onNext());
    }
    if (typeof onClose === "function") {
      onClose();
    }
  };

  /**
   * Handles returning to lobby/home and closes the modal afterward.
   */
  const handleHome = async () => {
    if (typeof onHome === "function") {
      await Promise.resolve(onHome());
    }
    if (typeof onClose === "function") {
      onClose();
    }
  };

  /**
   * Handles rewarded-ad continue flow; closes unless callback explicitly returns `false`.
   */
  const handleWatchAdContinue = async () => {
    let shouldClose = true;
    if (typeof onWatchAdContinue === "function") {
      const result = await Promise.resolve(onWatchAdContinue());
      shouldClose = result !== false;
    }
    if (shouldClose && typeof onClose === "function") {
      onClose();
    }
  };

  /**
   * Handles coin-continue flow; closes unless callback explicitly returns `false`.
   */
  const handleCoinContinue = async () => {
    let shouldClose = true;
    if (typeof onCoinContinue === "function") {
      const result = await Promise.resolve(onCoinContinue());
      shouldClose = result !== false;
    }
    if (shouldClose && typeof onClose === "function") {
      onClose();
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
      accessibilityLabel="Game loss notification with correct answer"
    >
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
          <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{ position: "absolute" }} />
          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "space-around",
              padding: MODAL_CONTENT_PADDING,
            }}
          >
            {showContinueOptions ? (
              <>
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontPrimary,
                      fontSize: TYPOGRAPHY.fontSize.display,
                      color: "black",
                      textAlign: "center",
                    }}
                  >
                    So close!
                  </Text>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.xl,
                      color: "black",
                      textAlign: "center",
                    }}
                  >
                    Out of attempts.
                  </Text>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.base,
                      color: "black",
                      textAlign: "center",
                      marginTop: 6,
                    }}
                  >
                    Answer: {correctAnswer}
                  </Text>
                </View>
                <View style={{ flex: 2, justifyContent: "center", width: "100%" }}>
                  {onWatchAdContinue && (
                    <>
                      <WideButton
                        onPress={handleWatchAdContinue}
                        buttonText="Watch Ad to Continue"
                        disabled={canWatchAd === false}
                      />
                      <View style={{ height: MODAL_BUTTON_SPACER }} />
                    </>
                  )}
                  {onCoinContinue && (
                    <>
                      <WideButton
                        onPress={handleCoinContinue}
                        buttonText={`Use ${coinContinueCost ?? 0} Coins to Continue`}
                        disabled={canUseCoin === false}
                      />
                      <View style={{ height: MODAL_BUTTON_SPACER }} />
                    </>
                  )}
                  <WideButton onPress={handleNextLevel} buttonText="Skip Level" />
                  <View style={{ height: MODAL_BUTTON_SPACER }} />
                  <WideButton onPress={handleHome} buttonText="Go to Lobby" />
                </View>
              </>
            ) : (
              <>
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontPrimary,
                      fontSize: TYPOGRAPHY.fontSize.display,
                      color: "black",
                    }}
                  >
                    So close!
                  </Text>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.xl,
                      color: "black",
                      textAlign: "center",
                    }}
                  >
                    Out of attempts.
                  </Text>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.base,
                      color: "black",
                      textAlign: "center",
                      marginTop: 6,
                    }}
                  >
                    Answer: {correctAnswer}
                  </Text>
                </View>
                <View style={{ flex: 2, justifyContent: "center", width: "100%" }}>
                  <WideButton onPress={handleNextLevel} buttonText="Next Level" />
                  <View style={{ height: MODAL_BUTTON_SPACER }} />
                  <WideButton onPress={handleHome} buttonText="Go to Lobby" />
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default LossModal;
