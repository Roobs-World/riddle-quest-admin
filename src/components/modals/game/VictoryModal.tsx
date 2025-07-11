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

import React, { useEffect } from "react";
import { View, Text, Modal, SafeAreaView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import type { SubmittedGuess } from "../../../hooks/types";
import { generateFeedbackEmojiGrid } from "../../../utils/gameUtils";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import SocialShareButton from "../../buttons/SocialShareButton";
import WheelBgSvg from "../../../../assets/images/wheel-bg.svg";
import LargeCoinStackSvg from "../../../../assets/images/large-coin-stack.svg";
import ChestSvg from "../../../../assets/images/chest.svg";
import { modalStyles } from "../../../styles/components/modals";
import { COLORS } from "../../../styles/tokens/colors";
import { SPACING } from "../../../styles/tokens/spacing";
import { BORDER_RADIUS } from "../../../styles/tokens/borderRadius";
import { scale } from "../../../utils/responsive";
import { SocialSharingService } from "../../../services/SocialSharingService";
import { TYPOGRAPHY } from "../../../styles";

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

  /** Game mode for contextual sharing text */
  gameMode?: "daily" | "classic";
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
  gameMode = "daily",
}) => {
  /**
   * Generate emoji grid representation of the player's guesses.
   * This creates a shareable visual summary of the solution path
   * using colored squares to represent correct, partial, and incorrect letters.
   */
  const emojiSummary = generateFeedbackEmojiGrid(guesses);

  /**
   * Rotation animation for the wheel background
   */
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      // Start rotation animation when modal becomes visible
      rotation.value = 0; // Reset to 0 first
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 10000, // 10 seconds for one full rotation (faster)
          easing: Easing.linear,
        }),
        -1, // Infinite repetition
        false // Don't reverse
      );
    } else {
      // Reset rotation when modal is hidden
      rotation.value = 0;
    }
  }, [isVisible, rotation]);

  const animatedWheelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  /**
   * Handle social media sharing
   */
  const handleShare = async (platform: "facebook" | "x") => {
    try {
      const shareContent = {
        attempts,
        emojiGrid: emojiSummary,
        gameMode,
      };

      const success = await SocialSharingService.share(platform, shareContent);
      if (success) {
        console.log(`✅ Successfully shared to ${platform}`);
      } else {
        console.log(`❌ Failed to share to ${platform}`);
      }
    } catch (error) {
      console.error(`Error sharing to ${platform}:`, error);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isVisible}
      onRequestClose={onHome}
      accessibilityLabel="Victory celebration modal"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <View
          style={{
            backgroundColor: "transparent",
            borderBottomLeftRadius: BORDER_RADIUS.xl,
            borderBottomRightRadius: BORDER_RADIUS.xl,
            flex: 1,
            paddingTop: SPACING.lg,
          }}
        >
          {/* Background Design */}
          <View
            style={{
              position: "absolute",
              top: -150,
              left: -150,
              right: -150,
              bottom: -150,
              zIndex: 0,
              justifyContent: "center",
              alignItems: "center",
              opacity: 0.4,
            }}
          >
            <Animated.View
              style={[
                animatedWheelStyle,
                {
                  width: 1000,
                  height: 1000,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <WheelBgSvg width={1000} height={1000} />
            </Animated.View>
          </View>

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
              backgroundColor: COLORS.white,
              borderRadius: BORDER_RADIUS.full,
              elevation: 4,
              shadowColor: COLORS.shadowColor,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              padding: scale(2), // Added padding around the button
            }}
          >
            <CloseButton
              onPress={onHome}
              size={scale(32)} // Increased size from 28 to 32 for better visibility
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
                  fontSize: scale(48),
                  color: COLORS.success,
                  fontFamily: TYPOGRAPHY.fontPrimary,
                },
              ]}
            >
              Victory!
            </Text>
            <Text
              style={[
                modalStyles.subtitle,
                {
                  fontSize: scale(18),
                  color: COLORS.textSecondary,
                  fontFamily: TYPOGRAPHY.fontPrimary,
                },
              ]}
            >
              Solved in {attempts} {attempts === 1 ? "attempt" : "attempts"}!
            </Text>
          </View>

          {/* Content Container */}
          <View
            style={{
              flex: 1,
              paddingHorizontal: SPACING.lg,
              justifyContent: "space-between", // Changed from center to space-between
              alignItems: "center",
            }}
          >
            {/* Top Section with Victory Message and Coins */}
            <View style={{ width: "100%", alignItems: "center" }}>
              {coinsEarned > 0 && (
                <View
                  style={{
                    alignItems: "center",
                  }}
                >
                  {/* Large Coin Stack Icon */}
                  <View>
                    <LargeCoinStackSvg
                      width={scale(300)}
                      height={scale(200)}
                      style={{
                        top: -20,
                      }}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Middle Section with Treasure Chest */}
            {guesses.length > 0 && (
              <View
                style={{
                  alignItems: "center",
                  width: "100%",
                  position: "absolute",
                  top: 200, // Adjusted from 220 to 200 to move up slightly
                }}
              >
                {/* Treasure Chest with Overlaid Text */}
                <View
                  style={{
                    position: "relative",
                    alignItems: "center",
                    marginTop: -100, // Adjusted from -80 to -60
                  }}
                >
                  <ChestSvg width={scale(320)} height={scale(240)} />

                  {/* Overlaid Coins Text - Only show when coins are earned */}
                  {coinsEarned > 0 && (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {/* Semi-transparent background for better text visibility */}
                      <View
                        style={{
                          paddingHorizontal: scale(16),
                          paddingVertical: scale(8),
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: scale(24),
                            fontFamily: TYPOGRAPHY.fontPrimary,
                            color: "black",
                            textAlign: "center",
                          }}
                        >
                          Coins Earned
                        </Text>
                        <Text
                          style={{
                            fontSize: scale(32),
                            color: COLORS.primaryOrange,
                            textAlign: "center",
                            fontFamily: TYPOGRAPHY.fontPrimary,
                          }}
                        >
                          {coinsEarned}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Bottom Section with Share Functionality */}
            {guesses.length > 0 && (
              <View
                style={{
                  alignItems: "center",
                  width: "100%",
                  position: "absolute",
                  top: 280, // Adjusted from 300 to 380 to move down below the larger chest
                }}
              >
                <Text
                  style={{
                    fontSize: scale(24), // Increased from 18 to 20
                    fontFamily: TYPOGRAPHY.fontPrimary,
                    color: COLORS.textPrimary,
                    marginBottom: SPACING.md,
                    textAlign: "center",
                  }}
                >
                  Share your victory
                </Text>

                {/* Social Share Buttons */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    width: "100%",
                    marginTop: scale(12), // Increased from 8 to 12 for better spacing
                    gap: scale(24), // Increased from 16 to 24 for better spacing between buttons
                  }}
                >
                  <SocialShareButton
                    platform="facebook"
                    onPress={() => handleShare("facebook")}
                    size="medium" // Changed from small to medium
                  />
                  <SocialShareButton
                    platform="x"
                    onPress={() => handleShare("x")}
                    size="medium" // Changed from small to medium
                  />
                </View>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View
            style={{
              paddingHorizontal: SPACING.lg,
              paddingBottom: SPACING.lg,
              backgroundColor: "transparent",
            }}
          >
            <WideButton
              buttonText="Next Level"
              onPress={onNextLevel}
              buttonColor="bg-blue-500"
            />
            <WideButton
              buttonText="Home"
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
