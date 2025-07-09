/**
 * @fileoverview HintModal component - Modal for purchasing gameplay hints in Qwordly.
 *
 * This modal allows players to purchase hints using coins during gameplay.
 * It displays the hint cost, player's current coin balance, and provides
 * clear feedback about whether the player can afford the hint. The modal
 * includes proper error handling for insufficient funds.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { ModalButton } from "../ModalButton";
import { TYPOGRAPHY } from "src/styles";

/**
 * Props interface for the HintModal component.
 *
 * @property {boolean} isVisible - Controls modal visibility state
 * @property {number} userCoins - Player's current coin balance
 * @property {number} hintCost - Cost in coins for purchasing the hint
 * @property {() => void} onShowHint - Callback to purchase and display the hint
 * @property {() => void} onClose - Callback to close the modal without purchasing
 */
interface HintModalProps {
  /** Controls whether the modal is visible */
  isVisible: boolean;

  /** Player's current coin balance */
  userCoins: number;

  /** Cost in coins to purchase the hint */
  hintCost: number;

  /** Function called when player chooses to purchase and show the hint */
  onShowHint: () => void;

  /** Function called when player closes the modal without purchasing */
  onClose: () => void;
}

/**
 * HintModal Component
 *
 * A modal dialog that allows players to purchase hints using their coin balance.
 * The modal provides clear information about the cost, player's available coins,
 * and whether they can afford the hint. It includes error messaging for insufficient
 * funds and uses the standardized ModalButton component for actions.
 *
 * Modal Content:
 * - "Use a Hint?" title
 * - Cost display with player's current balance
 * - Insufficient funds warning (if applicable)
 * - Show Hint button (disabled if insufficient funds)
 * - Close button for cancellation
 *
 * Visual Design:
 * - Fade animation for smooth appearance
 * - Semi-transparent background overlay
 * - Rounded modal with light background
 * - Primary typography for consistency
 * - Close button in top-right corner
 *
 * Features:
 * - Real-time affordability calculation
 * - Clear cost and balance display
 * - Error messaging for insufficient funds
 * - Disabled state for unaffordable hints
 * - Accessible button interactions
 * - Proper modal dismissal handling
 *
 * Game Economy Integration:
 * - Displays current coin balance
 * - Shows exact hint cost
 * - Prevents purchases with insufficient funds
 * - Integrates with game's coin system
 *
 * Usage Example:
 * ```tsx
 * <HintModal
 *   isVisible={showHintModal}
 *   userCoins={player.coins}
 *   hintCost={50}
 *   onShowHint={handlePurchaseHint}
 *   onClose={closeHintModal}
 * />
 * ```
 *
 * @param {HintModalProps} props - Component props
 * @returns {JSX.Element} Rendered hint purchase modal
 */
const HintModal: React.FC<HintModalProps> = ({
  isVisible,
  userCoins,
  hintCost,
  onShowHint,
  onClose,
}) => {
  /** Calculate whether the player can afford the hint */
  const canAffordHint = userCoins >= hintCost;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-input-background p-6 rounded-3xl items-center relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          {/* Modal Title */}
          <Text
            className="text-gray-800 mb-4"
            style={{
              fontFamily: TYPOGRAPHY.fontPrimary,
              fontSize: 24,
            }}
          >
            Use a Hint?
          </Text>

          {/* Cost and Balance Information */}
          <Text
            className="text-md text-gray-700 mb-4"
            style={{
              fontFamily: TYPOGRAPHY.fontPrimary,
            }}
          >
            Cost: {hintCost} Coins. You have: {userCoins} Coins.
          </Text>

          {/* Insufficient Funds Warning */}
          {!canAffordHint && (
            <Text
              className="text-red-500 mb-4"
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
              }}
            >
              You do not have enough coins for a hint.
            </Text>
          )}

          {/* Action Buttons */}
          <View className="flex-row mt-4">
            <ModalButton
              text="SHOW HINT"
              callback={onShowHint}
              isDisabled={!canAffordHint}
            />

            <ModalButton text="CLOSE" callback={onClose} isDisabled={false} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default HintModal;
