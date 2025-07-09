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
 * - Immediate retry option to encourage continued engagement
 * - Alternative navigation to main menu for session management
 * - Accessibility support for all interaction elements
 *
 * **Psychology & UX:**
 * - Minimizes frustration by immediately showing the answer
 * - Provides learning opportunity through answer revelation
 * - Encourages immediate re-engagement with prominent retry option
 * - Offers graceful exit without penalty or shame
 * - Uses supportive rather than punitive language and design
 *
 * **Design Patterns:**
 * - Error modal variant with red accent color
 * - Information-focused layout prioritizing answer display
 * - Clear action hierarchy (retry primary, home secondary)
 * - Consistent modal structure and responsive design
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 *
 * @see {@link VictoryModal} For success state counterpart
 * @see {@link OutOfAttemptsModal} For attempt exhaustion handling
 */

import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { modalStyles } from "../../../styles/components/modals";
import { COLORS } from "../../../styles/tokens/colors";
import { SPACING } from "../../../styles/tokens/spacing";
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

  /** Callback function executed when user chooses to retry the same riddle */
  onRetry: () => void;

  /** Callback function executed when user chooses to return to main menu */
  onHome: () => void;
}

/**
 * Loss Modal Component
 *
 * Displays when a player fails to solve a riddle, providing the correct answer
 * and options for next steps. The modal focuses on learning and encouragement
 * rather than punishment, helping maintain player engagement and motivation.
 *
 * **Behavior:**
 * - Appears immediately after final incorrect guess
 * - Reveals the correct answer for educational value
 * - Provides immediate retry option for re-engagement
 * - Allows navigation back to main menu
 * - Dismisses upon any action selection
 *
 * **Accessibility:**
 * - Screen reader compatible with clear state communication
 * - High contrast colors for text and background elements
 * - Touch-friendly button sizes and spacing
 * - Clear labeling of all interactive elements
 *
 * **Styling:**
 * - Error modal variant with red accent color
 * - Prominent correct answer display for learning
 * - Primary retry button for immediate re-engagement
 * - Secondary home button for session management
 *
 * @param props - Component props defining modal state and callbacks
 * @returns Rendered loss modal component
 *
 * @example
 * ```tsx
 * <LossModal
 *   isVisible={showLossModal}
 *   correctAnswer="rainbow"
 *   onRetry={() => {
 *     resetGame();
 *     setShowLossModal(false);
 *   }}
 *   onHome={() => {
 *     navigateToHome();
 *     setShowLossModal(false);
 *   }}
 * />
 * ```
 */
const LossModal: React.FC<LossModalProps> = ({
  isVisible,
  correctAnswer,
  onRetry,
  onHome,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onHome}
      accessibilityLabel="Game loss notification with correct answer"
    >
      <SafeAreaView style={modalStyles.overlay}>
        <View style={[modalStyles.modalContainer, modalStyles.errorModal]}>
          {/* Close Button */}
          <View style={modalStyles.closeButton}>
            <CloseButton
              onPress={onHome}
              size={scale(24)}
              accessibilityLabel="Close loss modal and return home"
            />
          </View>

          {/* Header */}
          <View style={modalStyles.headerCentered}>
            <Text
              style={[
                modalStyles.title,
                {
                  color: COLORS.error,
                  fontSize: scale(28),
                  marginBottom: SPACING.sm,
                },
              ]}
            >
              😔 Try Again!
            </Text>
            <Text
              style={[
                modalStyles.subtitle,
                {
                  color: COLORS.textSecondary,
                  marginBottom: SPACING.lg,
                },
              ]}
            >
              Don&apos;t worry, every puzzle is a learning opportunity!
            </Text>
          </View>

          {/* Correct Answer Display */}
          <View
            style={[
              modalStyles.content,
              {
                backgroundColor: COLORS.gray100,
                borderRadius: 12,
                marginVertical: SPACING.md,
                padding: SPACING.lg,
                alignItems: "center",
              },
            ]}
          >
            <Text
              style={[
                modalStyles.modalText,
                {
                  fontSize: scale(16),
                  fontWeight: "600",
                  color: COLORS.textPrimary,
                  marginBottom: SPACING.sm,
                },
              ]}
            >
              The correct answer was:
            </Text>

            <Text
              style={[
                modalStyles.title,
                {
                  fontSize: scale(24),
                  color: COLORS.primaryOrange,
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                },
              ]}
            >
              {correctAnswer}
            </Text>
          </View>

          {/* Encouragement Message */}
          <View style={modalStyles.contentCentered}>
            <Text
              style={[
                modalStyles.description,
                {
                  textAlign: "center",
                  lineHeight: scale(20),
                  marginBottom: SPACING.lg,
                },
              ]}
            >
              Every riddle master started as a beginner. Ready to tackle another
              challenge?
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={modalStyles.buttonContainerVertical}>
            <TouchableOpacity
              style={{
                backgroundColor: COLORS.primaryOrange,
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.lg,
                borderRadius: 12,
                width: "100%",
                alignItems: "center",
              }}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Try again with a new riddle"
              accessibilityHint="Start a new riddle to test your skills"
            >
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: scale(16),
                  fontWeight: "600",
                }}
              >
                🔄 Try Another Riddle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: COLORS.gray300,
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.lg,
                borderRadius: 12,
                width: "100%",
                alignItems: "center",
                marginTop: SPACING.sm,
              }}
              onPress={onHome}
              accessibilityRole="button"
              accessibilityLabel="Return to main menu"
              accessibilityHint="Go back to the home screen"
            >
              <Text
                style={{
                  color: COLORS.textPrimary,
                  fontSize: scale(16),
                  fontWeight: "500",
                }}
              >
                🏠 Return Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default LossModal;
