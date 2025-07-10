/**
 * @fileoverview VictoryModal component - Celebration modal for successful riddle solving.
 *
 * This modal is displayed when a player successfully solves a riddle, providing
 * a celebratory experience with game statistics, coin rewards, and sharing options.
 * It includes an emoji grid representation of the player's guesses for social
 * sharing and provides navigation options to continue playing or return home.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { View, Text, Modal, SafeAreaView } from "react-native";
import type { SubmittedGuess } from "../../../hooks/types";
import { generateFeedbackEmojiGrid } from "../../../utils/gameUtils";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import HomeBgSvg from "../../../../assets/images/home-bg.svg";
import { modalStyles } from "../../../styles/components/modals";
import { COLORS } from "../../../styles/tokens/colors";
import { SPACING } from "../../../styles/tokens/spacing";
import { BORDER_RADIUS } from "../../../styles/tokens/borderRadius";
import { scale } from "../../../utils/responsive";

/**
 * Props interface for the VictoryModal component.
 *
 * @property {boolean} isVisible - Controls modal visibility state
 * @property {number} attempts - Number of attempts taken to solve the riddle
 * @property {number} coinsEarned - Coins awarded for solving the riddle
 * @property {() => void} onNextLevel - Callback to proceed to next level
 * @property {() => void} onHome - Callback to return to home screen
 * @property {SubmittedGuess[]} guesses - Array of submitted guesses with feedback
 */
interface VictoryModalProps {
  /** Controls whether the modal is visible */
  isVisible: boolean;

  /** Number of attempts taken to solve the riddle (1-5) */
  attempts: number;

  /** Number of coins earned from solving the riddle */
  coinsEarned: number;

  /** Function called when player chooses to go to next level */
  onNextLevel: () => void;

  /** Function called when player chooses to return home */
  onHome: () => void;

  /**
   * Array of submitted guesses with feedback data.
   * Used to generate the emoji grid for sharing.
   */
  guesses: SubmittedGuess[];
}

/**
 * VictoryModal Component
 *
 * A celebratory modal that displays when a player successfully solves a riddle.
 * This component provides positive reinforcement, shows performance statistics,
 * and offers sharing capabilities through an emoji grid representation of the
 * player's solution path.
 *
 * Modal Content:
 * - Victory celebration message
 * - Number of attempts taken
 * - Coins earned (if any)
 * - Shareable emoji grid of guesses
 * - Navigation buttons (Next Level, Home)
 * - Close button for quick exit
 *
 * Visual Design:
 * - Full-screen modal with branded background
 * - SafeAreaView for proper device handling
 * - Drag handle for intuitive interaction
 * - Professional layout with design tokens
 * - Green "Victory!" header for positive reinforcement
 * - Clear typography hierarchy for information
 *
 * Features:
 * - Automatic emoji grid generation from guesses
 * - Conditional coin display (only if coins earned)
 * - Multiple navigation options for user choice
 * - Accessible design with proper button roles
 * - Responsive layout for different screen sizes
 *
 * User Experience:
 * - Celebrates player achievement
 * - Provides clear game statistics
 * - Enables social sharing through emoji grid
 * - Offers clear next steps (continue or quit)
 * - Quick exit option with close button
 *
 * Usage Example:
 * ```tsx
 * <VictoryModal
 *   isVisible={showVictory}
 *   attempts={playerAttempts}
 *   coinsEarned={calculateCoins(attempts)}
 *   onNextLevel={handleNextLevel}
 *   onHome={handleReturnHome}
 *   guesses={playerGuesses}
 * />
 * ```
 *
 * @param {VictoryModalProps} props - Component props
 * @returns {JSX.Element} Rendered victory celebration modal
 */
const VictoryModal: React.FC<VictoryModalProps> = ({
  isVisible,
  attempts,
  coinsEarned,
  onNextLevel,
  onHome,
  guesses,
}) => {
  /**
   * Generate emoji grid representation of the player's guesses.
   * This creates a shareable visual summary of the solution path
   * using colored squares to represent correct, partial, and incorrect letters.
   */
  const emojiSummary = generateFeedbackEmojiGrid(guesses);

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isVisible}
      onRequestClose={onHome}
      accessibilityLabel="Victory celebration modal"
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: COLORS.backgroundPrimary }}
      >
        <View
          style={{
            backgroundColor: COLORS.backgroundPrimary,
            borderBottomLeftRadius: BORDER_RADIUS.xl,
            borderBottomRightRadius: BORDER_RADIUS.xl,
            flex: 1,
            paddingTop: SPACING.lg,
          }}
        >
          {/* Background Design */}
          <HomeBgSvg
            width="120%"
            height="100%"
            style={{
              position: "absolute",
              top: 0,
              left: -50,
              zIndex: 0,
              opacity: 0.1,
            }}
          />

          {/* Drag Handle */}
          <View
            style={{
              alignSelf: "center",
              width: scale(40),
              height: scale(4),
              backgroundColor: COLORS.gray300,
              borderRadius: BORDER_RADIUS.sm,
              marginBottom: SPACING.lg,
            }}
          />

          {/* Close Button */}
          <View
            style={{
              position: "absolute",
              top: SPACING.xl,
              right: SPACING.lg,
              zIndex: 10,
            }}
          >
            <CloseButton
              onPress={onHome}
              size={scale(24)}
              accessibilityLabel="Close victory modal"
            />
          </View>

          {/* Header */}
          <View
            style={[
              modalStyles.headerCentered,
              { paddingHorizontal: SPACING.lg },
            ]}
          >
            <Text
              style={[
                modalStyles.title,
                {
                  fontSize: scale(32),
                  color: COLORS.success,
                  marginBottom: SPACING.sm,
                },
              ]}
            >
              🎉 Victory!
            </Text>
            <Text
              style={[
                modalStyles.subtitle,
                {
                  fontSize: scale(18),
                  color: COLORS.textSecondary,
                  marginBottom: SPACING.md,
                },
              ]}
            >
              Solved in {attempts} attempts!
            </Text>
          </View>

          {/* Content Container */}
          <View
            style={{
              flex: 1,
              paddingHorizontal: SPACING.lg,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {/* Conditional Coin Reward Display */}
            {coinsEarned > 0 && (
              <View
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  borderRadius: BORDER_RADIUS.lg,
                  padding: SPACING.lg,
                  marginBottom: SPACING.xl,
                  shadowColor: COLORS.shadowColor,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: scale(18),
                    fontWeight: "bold",
                    color: COLORS.textPrimary,
                    marginBottom: SPACING.xs,
                  }}
                >
                  💰 Coins Earned
                </Text>
                <Text
                  style={{
                    fontSize: scale(24),
                    fontWeight: "bold",
                    color: COLORS.primaryOrange,
                  }}
                >
                  {coinsEarned}
                </Text>
              </View>
            )}

            {/* Emoji Grid Summary for Sharing */}
            {guesses.length > 0 && (
              <View
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  borderRadius: BORDER_RADIUS.lg,
                  padding: SPACING.lg,
                  marginBottom: SPACING.xl,
                  shadowColor: COLORS.shadowColor,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <Text
                  style={{
                    fontSize: scale(18),
                    fontWeight: "bold",
                    color: COLORS.textPrimary,
                    marginBottom: SPACING.md,
                    textAlign: "center",
                  }}
                >
                  📤 Share your result:
                </Text>
                <Text
                  style={{
                    fontSize: scale(20),
                    lineHeight: scale(28),
                    textAlign: "center",
                    color: COLORS.textPrimary,
                  }}
                >
                  {emojiSummary}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View
            style={{
              paddingHorizontal: SPACING.lg,
              paddingBottom: SPACING.lg,
              backgroundColor: COLORS.backgroundPrimary,
            }}
          >
            <WideButton
              buttonText="🚀 Next Level"
              onPress={onNextLevel}
              buttonColor="bg-blue-500"
            />
            <WideButton
              buttonText="🏠 Home"
              onPress={onHome}
              buttonColor="bg-gray-500"
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default VictoryModal;
