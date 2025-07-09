/**
 * @fileoverview Daily Challenge Completion Modal Component
 *
 * Celebration modal displayed when a player successfully completes all five
 * daily challenge questions. This modal provides positive reinforcement,
 * displays earned rewards, and offers navigation options to continue playing
 * or return to the main menu.
 *
 * **Key Features:**
 * - Celebratory design with congratulatory messaging
 * - Rewards summary showing total coins earned
 * - Progress acknowledgment (5/5 questions completed)
 * - Motivational messaging for player retention
 * - Clear action buttons for next steps
 * - Accessibility support for screen readers
 *
 * **User Experience:**
 * - Automatically displays after completing the 5th daily question
 * - Provides immediate positive feedback and reward visibility
 * - Encourages continued engagement with classic mode option
 * - Allows graceful exit to main menu
 *
 * **Design Patterns:**
 * - Success modal variant with green/gold color scheme
 * - Achievement-focused layout with emoji celebrations
 * - Structured information hierarchy (congratulations → details → actions)
 * - Consistent button styling and interaction patterns
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 *
 * @see {@link VictoryModal} For single-question completion modal
 * @see {@link ModalProvider} For modal state management
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
 * Props interface for the DailyChallengeCompletionModal component.
 *
 * Defines all required properties for rendering the daily challenge completion
 * celebration modal with appropriate rewards display and navigation options.
 */
interface DailyChallengeCompletionModalProps {
  /** Controls the visibility state of the modal */
  isVisible: boolean;

  /** Total coins earned from completing all 5 daily challenge questions */
  totalCoinsEarned: number;

  /** Number of questions completed (typically 5 for full completion) */
  questionsCompleted: number;

  /** Total number of questions in the daily challenge (always 5) */
  totalQuestions: number;

  /** Callback function executed when user chooses to continue playing */
  onContinue: () => void;

  /** Callback function executed when user chooses to return to main menu */
  onHome: () => void;

  /** Callback function executed when user closes the modal */
  onClose: () => void;
}

/**
 * Daily Challenge Completion Modal Component
 *
 * A celebration modal that congratulates players on completing the daily
 * challenge, displays their achievement summary, and provides options for
 * continued engagement or returning to the main menu.
 *
 * **Behavior:**
 * - Displays immediately after completing the 5th daily question
 * - Shows total coins earned across all 5 questions
 * - Provides motivational messaging to encourage return visits
 * - Offers seamless transition to classic mode or main menu
 *
 * **Accessibility:**
 * - Screen reader compatible with proper role and label attributes
 * - High contrast colors for text and background elements
 * - Touch-friendly button sizes and spacing
 * - Clear visual hierarchy and content organization
 *
 * **Styling:**
 * - Success-themed color scheme (green/gold)
 * - Celebration elements (emojis, positive language)
 * - Consistent modal layout and button patterns
 * - Responsive design for different screen sizes
 *
 * @param props - Component props defining modal state and callbacks
 * @returns Rendered daily challenge completion modal component
 *
 * @example
 * ```tsx
 * <DailyChallengeCompletionModal
 *   isVisible={showCompletionModal}
 *   totalCoinsEarned={125}
 *   questionsCompleted={5}
 *   totalQuestions={5}
 *   onContinue={() => navigateToClassicMode()}
 *   onHome={() => navigateToHome()}
 *   onClose={() => setShowCompletionModal(false)}
 * />
 * ```
 */
const DailyChallengeCompletionModal: React.FC<
  DailyChallengeCompletionModalProps
> = ({
  isVisible,
  totalCoinsEarned,
  questionsCompleted,
  totalQuestions,
  onContinue,
  onHome,
  onClose,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
      accessibilityLabel="Daily Challenge Completion Celebration"
    >
      <SafeAreaView style={modalStyles.overlay}>
        <View
          style={[
            modalStyles.modalContainer,
            modalStyles.successModal,
            modalStyles.gameModal,
          ]}
        >
          {/* Close Button */}
          <View style={modalStyles.closeButton}>
            <CloseButton
              onPress={onClose}
              size={scale(24)}
              accessibilityLabel="Close completion modal"
            />
          </View>

          {/* Celebration Header */}
          <View style={modalStyles.headerCentered}>
            <Text
              style={[
                modalStyles.title,
                { color: COLORS.success, fontSize: scale(32) },
              ]}
            >
              🎉 Congratulations! 🎉
            </Text>
            <Text
              style={[
                modalStyles.subtitle,
                { color: COLORS.success, fontSize: scale(20) },
              ]}
            >
              Daily Challenge Complete!
            </Text>
          </View>

          {/* Achievement Summary */}
          <View
            style={[
              modalStyles.content,
              {
                backgroundColor: COLORS.gray100,
                borderRadius: 12,
                marginVertical: SPACING.md,
                padding: SPACING.lg,
              },
            ]}
          >
            <Text
              style={[
                modalStyles.modalText,
                {
                  fontSize: scale(18),
                  fontWeight: "600",
                  color: COLORS.textPrimary,
                  marginBottom: SPACING.sm,
                },
              ]}
            >
              Amazing Achievement!
            </Text>

            <Text style={[modalStyles.modalText, { marginBottom: SPACING.sm }]}>
              You solved all {questionsCompleted} of {totalQuestions} daily
              questions!
            </Text>

            {totalCoinsEarned > 0 && (
              <View style={modalStyles.coinDisplay}>
                <Text style={[modalStyles.coinText, { fontSize: scale(18) }]}>
                  🪙 Total Coins Earned: {totalCoinsEarned}
                </Text>
              </View>
            )}
          </View>

          {/* Motivational Message */}
          <View style={modalStyles.contentCentered}>
            <Text
              style={[
                modalStyles.description,
                {
                  textAlign: "center",
                  lineHeight: scale(22),
                  marginBottom: SPACING.lg,
                },
              ]}
            >
              Outstanding work! You&apos;ve mastered today&apos;s daily
              challenge. Come back tomorrow for a new set of brain-teasing
              riddles!
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
              onPress={onContinue}
              accessibilityRole="button"
              accessibilityLabel="Continue to Classic Mode"
              accessibilityHint="Start playing classic mode riddles"
            >
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: scale(16),
                  fontWeight: "600",
                }}
              >
                Play Classic Mode
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
              }}
              onPress={onHome}
              accessibilityRole="button"
              accessibilityLabel="Return to Home"
              accessibilityHint="Go back to the main menu"
            >
              <Text
                style={{
                  color: COLORS.textPrimary,
                  fontSize: scale(16),
                  fontWeight: "600",
                }}
              >
                Return Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default DailyChallengeCompletionModal;
