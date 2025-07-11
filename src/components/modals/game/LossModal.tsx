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
import { scale } from "../../../utils/responsive";

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
}) => {
  const handleNextLevel = async () => {
    if (typeof onNext === "function") {
      await Promise.resolve(onNext());
    }
    if (typeof onClose === "function") {
      onClose();
    }
  };

  const handleHome = async () => {
    if (typeof onHome === "function") {
      await Promise.resolve(onHome());
    }
    if (typeof onClose === "function") {
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
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <View
          style={{
            width: 335,
            height: 423,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg style={{ position: "absolute" }} />
          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "space-around",
              padding: 20,
            }}
          >
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
                  fontSize: scale(32),
                  color: "white",
                }}
              >
                Oh no!
              </Text>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: scale(20),
                  color: "white",
                  textAlign: "center",
                }}
              >
                You lost this round.
              </Text>
            </View>
            <View
              style={{
                flex: 2,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white" }}>The correct word was</Text>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: scale(32),
                  color: "white",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                {correctAnswer}
              </Text>
            </View>
            <View style={{ flex: 1, justifyContent: "center", width: "100%" }}>
              <WideButton onPress={handleNextLevel} buttonText="Next Level" />
              <View style={{ height: 10 }} />
              <WideButton onPress={handleHome} buttonText="Go to Lobby" />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default LossModal;
