/**
 * @fileoverview Out of Attempts Modal Component
 *
 * A critical decision point modal that appears when players have exhausted
 * all available attempts for the current riddle. This modal serves as a key
 * monetization and engagement touchpoint, offering multiple paths for
 * continued gameplay while respecting player choice and financial constraints.
 *
 * **Key Features:**
 * - Multiple continuation options (ads, coins, or exit)
 * - Real-time affordability checking for coin-based continues
 * - Clear value proposition for each option
 * - Graceful exit option without pressure
 * - Accessibility support for all interaction elements
 *
 * **Monetization Strategy:**
 * - Primary: Rewarded video ads for free continues (user acquisition)
 * - Secondary: Coin spending for immediate continues (direct monetization)
 * - Fallback: Graceful exit maintaining positive user experience
 *
 * **User Experience:**
 * - Appears at moment of highest investment (3 attempts used)
 * - Provides clear options without overwhelming choice
 * - Shows real-time coin balance and affordability
 * - Maintains game flow with minimal friction
 * - Respects player autonomy with clear exit option
 *
 * **Psychology & Design:**
 * - Warning modal variant with yellow accent for attention
 * - Visual hierarchy emphasizing free options first
 * - Clear affordability indicators to prevent frustration
 * - Supportive messaging focusing on continuation rather than failure
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 *
 * @see {@link WatchAdForChanceModal} For simplified ad-only option
 * @see {@link LossModal} For final failure state
 * @see {@link CoinShopModal} For coin purchasing options
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
 * Props interface for the OutOfAttemptsModal component.
 *
 * Defines all required properties for rendering the attempt exhaustion modal
 * with appropriate continuation options and user financial state.
 */
interface OutOfAttemptsModalProps {
  /** Controls the visibility state of the modal */
  isVisible: boolean;

  /** Current number of coins the user possesses */
  userCoins: number;

  /** Cost in coins required to continue playing */
  continueCost: number;

  /** Callback function executed when user chooses to watch a rewarded ad */
  onWatchAd: () => void;

  /** Callback function executed when user chooses to spend coins to continue */
  onSpendCoins: () => void;

  /** Callback function executed when user chooses to exit/give up */
  onClose: () => void;
}

/**
 * Out of Attempts Modal Component
 *
 * Displays when a player has used all available attempts for the current riddle,
 * offering multiple paths for continuation while providing clear information
 * about costs and benefits of each option.
 *
 * **Behavior:**
 * - Appears after the 3rd unsuccessful attempt
 * - Calculates and displays real-time affordability for coin options
 * - Triggers appropriate reward flows based on user selection
 * - Dismisses upon any action selection or explicit close
 * - Prevents accidental dismissal during critical decision moment
 *
 * **Accessibility:**
 * - Screen reader compatible with clear option descriptions
 * - High contrast colors for text and background elements
 * - Touch-friendly button sizes with adequate spacing
 * - Clear affordability indicators for financial decisions
 * - Disabled state handling for unaffordable options
 *
 * **Styling:**
 * - Warning modal variant with yellow accent color
 * - Visual hierarchy emphasizing free options first
 * - Clear affordability indicators (enabled/disabled states)
 * - Consistent modal layout with responsive design
 * - Progressive disclosure of option details
 *
 * @param props - Component props defining modal state and callbacks
 * @returns Rendered out of attempts modal component
 *
 * @example
 * ```tsx
 * <OutOfAttemptsModal
 *   isVisible={showAttemptsModal}
 *   userCoins={150}
 *   continueCost={50}
 *   onWatchAd={() => {
 *     loadRewardedAd();
 *     setShowAttemptsModal(false);
 *   }}
 *   onSpendCoins={() => {
 *     spendCoins(50);
 *     setShowAttemptsModal(false);
 *   }}
 *   onClose={() => {
 *     setShowAttemptsModal(false);
 *     navigateToHome();
 *   }}
 * />
 * ```
 */
const OutOfAttemptsModal: React.FC<OutOfAttemptsModalProps> = ({
  isVisible,
  userCoins,
  continueCost,
  onWatchAd,
  onSpendCoins,
  onClose,
}) => {
  const canAffordContinue = userCoins >= continueCost;

  if (!isVisible) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      accessibilityLabel="Out of attempts - continuation options"
    >
      <SafeAreaView style={modalStyles.overlay}>
        <View style={[modalStyles.modalContainer, modalStyles.warningModal]}>
          {/* Close Button */}
          <View style={modalStyles.closeButton}>
            <CloseButton
              onPress={onClose}
              size={scale(24)}
              accessibilityLabel="Close attempts modal and give up"
            />
          </View>

          {/* Header */}
          <View style={modalStyles.headerCentered}>
            <Text
              style={[
                modalStyles.title,
                {
                  color: COLORS.warning,
                  fontSize: scale(26),
                  marginBottom: SPACING.sm,
                },
              ]}
            >
              ⏰ Out of Attempts!
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
              You&apos;ve used all 3 attempts
            </Text>
          </View>

          {/* Explanation */}
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
              Continue playing by choosing one of the options below:
            </Text>
          </View>

          {/* Continue Options */}
          <View style={modalStyles.buttonContainerVertical}>
            {/* Watch Ad Option - Free */}
            <TouchableOpacity
              onPress={onWatchAd}
              style={{
                backgroundColor: COLORS.info,
                paddingVertical: SPACING.lg,
                paddingHorizontal: SPACING.lg,
                borderRadius: 12,
                width: "100%",
                alignItems: "center",
                marginBottom: SPACING.sm,
              }}
              accessibilityRole="button"
              accessibilityLabel="Watch advertisement for free continue"
              accessibilityHint="View a short video to get 3 more attempts"
            >
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: scale(18),
                  fontWeight: "bold",
                  marginBottom: scale(4),
                }}
              >
                📺 Watch Ad to Continue
              </Text>
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: scale(14),
                  opacity: 0.9,
                }}
              >
                Free • Get 3 more attempts
              </Text>
            </TouchableOpacity>

            {/* Spend Coins Option */}
            <TouchableOpacity
              onPress={() => {
                if (canAffordContinue) {
                  onSpendCoins();
                }
              }}
              style={{
                backgroundColor: canAffordContinue
                  ? COLORS.warning
                  : COLORS.gray400,
                paddingVertical: SPACING.lg,
                paddingHorizontal: SPACING.lg,
                borderRadius: 12,
                width: "100%",
                alignItems: "center",
                marginBottom: SPACING.sm,
                opacity: canAffordContinue ? 1 : 0.6,
              }}
              disabled={!canAffordContinue}
              accessibilityRole="button"
              accessibilityLabel={
                canAffordContinue
                  ? `Spend ${continueCost} coins to continue`
                  : `Cannot afford - need ${
                      continueCost - userCoins
                    } more coins`
              }
              accessibilityHint={
                canAffordContinue
                  ? "Use coins to get 3 more attempts immediately"
                  : "Visit coin shop to purchase more coins"
              }
            >
              <View style={modalStyles.coinDisplay}>
                <Text
                  style={{
                    color: COLORS.white,
                    fontSize: scale(18),
                    fontWeight: "bold",
                    marginBottom: scale(4),
                  }}
                >
                  🪙 Spend {continueCost} Coins
                </Text>
              </View>
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: scale(14),
                  opacity: 0.9,
                }}
              >
                {canAffordContinue
                  ? `You have ${userCoins} coins`
                  : `Need ${continueCost - userCoins} more coins`}
              </Text>
            </TouchableOpacity>

            {/* Give Up Option */}
            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: COLORS.gray500,
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.lg,
                borderRadius: 12,
                width: "100%",
                alignItems: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="Give up and exit current riddle"
              accessibilityHint="Return to main menu without continuing"
            >
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: scale(16),
                  fontWeight: "500",
                }}
              >
                😔 Give Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default OutOfAttemptsModal;
