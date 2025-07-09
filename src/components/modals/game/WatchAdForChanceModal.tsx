/**
 * @fileoverview Watch Ad for Chance Modal Component
 *
 * A rewarded advertisement modal that appears when players run out of attempts
 * and offers them the opportunity to watch an ad to continue playing. This modal
 * serves as a key monetization touchpoint while providing value to players
 * through additional gameplay opportunities.
 *
 * **Key Features:**
 * - Clear value proposition (watch ad = continue playing)
 * - Prominent call-to-action button for ad viewing
 * - Alternative "no thanks" option for graceful exit
 * - Consistent branding and visual hierarchy
 * - Accessibility support for all interaction elements
 *
 * **Monetization Strategy:**
 * - Rewarded video ad integration for revenue generation
 * - Strategic placement at moment of highest player investment
 * - Non-intrusive design that respects player choice
 * - Clear benefit communication to increase conversion rates
 *
 * **User Experience:**
 * - Appears when player has no remaining attempts
 * - Provides immediate alternative to purchasing continues
 * - Maintains game flow with minimal disruption
 * - Allows easy dismissal without penalty
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 *
 * @see {@link OutOfAttemptsModal} For coin-based continue options
 * @see {@link useInterstitialAds} For ad management logic
 */

import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import WideButton from "../../buttons/WideButton";
import CloseButton from "../../buttons/CloseButton";
import { AppStrings } from "../../../constants/AppStrings";
import { modalStyles } from "../../../styles/components/modals";
import { COLORS } from "../../../styles/tokens/colors";
import { SPACING } from "../../../styles/tokens/spacing";
import { scale } from "../../../utils/responsive";

/**
 * Props interface for the WatchAdForChanceModal component.
 *
 * Defines the required properties for displaying the rewarded ad
 * opportunity modal with appropriate callbacks for user actions.
 */
interface WatchAdForChanceModalProps {
  /** Controls the visibility state of the modal */
  visible: boolean;

  /** Callback function executed when user closes/dismisses the modal */
  onClose: () => void;

  /** Callback function executed when user chooses to watch the rewarded ad */
  onWatchAd: () => void;
}

/**
 * Watch Ad for Chance Modal Component
 *
 * Presents players with the opportunity to watch a rewarded video advertisement
 * in exchange for continuing their current game session. This modal appears
 * when players have exhausted their attempts and provides an alternative to
 * coin-based continues.
 *
 * **Behavior:**
 * - Displays when player has no remaining attempts
 * - Triggers rewarded ad loading and display upon acceptance
 * - Dismisses gracefully when declined
 * - Integrates with ad network callbacks for reward delivery
 *
 * **Accessibility:**
 * - Screen reader compatible with clear action descriptions
 * - High contrast colors for text and buttons
 * - Touch-friendly button sizing and spacing
 * - Clear value proposition communication
 *
 * **Styling:**
 * - Information modal variant with neutral color scheme
 * - Prominent call-to-action button for ad viewing
 * - Secondary dismiss option with lower visual weight
 * - Consistent modal layout and responsive design
 *
 * @param props - Component props defining modal state and callbacks
 * @returns Rendered watch ad for chance modal component
 *
 * @example
 * ```tsx
 * <WatchAdForChanceModal
 *   visible={showAdModal}
 *   onClose={() => setShowAdModal(false)}
 *   onWatchAd={() => {
 *     loadRewardedAd();
 *     setShowAdModal(false);
 *   }}
 * />
 * ```
 */
const WatchAdForChanceModal: React.FC<WatchAdForChanceModalProps> = ({
  visible,
  onClose,
  onWatchAd,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      accessibilityLabel="Watch advertisement for additional chance"
    >
      <SafeAreaView style={modalStyles.overlay}>
        <View style={[modalStyles.modalContainer, modalStyles.infoModal]}>
          {/* Close Button */}
          <View style={modalStyles.closeButton}>
            <CloseButton
              onPress={onClose}
              size={scale(24)}
              accessibilityLabel="Close ad offer modal"
            />
          </View>

          {/* Header */}
          <View style={modalStyles.headerCentered}>
            <Text
              style={[
                modalStyles.title,
                {
                  color: COLORS.info,
                  fontSize: scale(24),
                  marginBottom: SPACING.md,
                },
              ]}
            >
              📺 Watch Ad for Extra Chance
            </Text>
          </View>

          {/* Content */}
          <View style={modalStyles.contentCentered}>
            <Text
              style={[
                modalStyles.modalText,
                {
                  textAlign: "center",
                  lineHeight: scale(22),
                  marginBottom: SPACING.lg,
                },
              ]}
            >
              {AppStrings.RewardedAdPrompts.OUT_OF_GUESSES_PROMPT}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={modalStyles.buttonContainerVertical}>
            <WideButton
              buttonText={AppStrings.RewardedAdPrompts.WATCH_AD_BUTTON}
              onPress={onWatchAd}
            />

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
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="No thanks, close modal"
              accessibilityHint="Decline the ad offer and return to game"
            >
              <Text
                style={{
                  color: COLORS.textPrimary,
                  fontSize: scale(16),
                  fontWeight: "500",
                }}
              >
                {AppStrings.RewardedAdPrompts.NO_THANKS_BUTTON}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default WatchAdForChanceModal;
