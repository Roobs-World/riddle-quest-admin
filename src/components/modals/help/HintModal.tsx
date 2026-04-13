/**
 * @fileoverview HintModal component - Modal for purchasing gameplay hints in Qwordly.
 */

import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { TYPOGRAPHY } from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WideButton from "src/components/buttons/WideButton";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_BUTTON_POSITION,
} from "../../../constants/layout";
import { SPACING } from "../../../styles";
import { AppStrings } from "../../../constants/AppStrings";

/**
 * Props for the hint purchase modal shown during gameplay.
 */
interface HintModalProps {
  /** Controls modal visibility. */
  isVisible: boolean;
  /** User's current coin balance. */
  userCoins: number;
  /** Cost in coins required to reveal a hint. */
  hintCost: number;
  /** Invoked after user confirms hint purchase. */
  onShowHint: () => void;
  /** Closes the hint modal. */
  onClose: () => void;
  /** Opens the shop */
  onOpenShop: () => void;
}

/**
 * Confirms hint purchase and displays affordability state for the player.
 *
 * @param props Coin and action handlers for hint flow.
 * @returns Hint confirmation modal.
 */
const HintModal: React.FC<HintModalProps> = ({
  isVisible,
  userCoins,
  hintCost,
  onShowHint,
  onClose,
  onOpenShop
}) => {
  const canAffordHint = userCoins >= hintCost;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
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
          {/* Decorative wave — clipped to card bounds */}
          <HomeBg
            width={MODAL_WIDTH * 1.1}
            height={MODAL_HEIGHT * 1.1}
            style={{ position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05 }}
          />
          <CloseButton
            onPress={onClose}
            size={CLOSE_BUTTON_SIZE}
            style={MODAL_CLOSE_BUTTON_POSITION}
          />
          <View
            style={{
              width: "80%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.title,
                color: "black",
                marginBottom: SPACING.lg,
                textAlign: "center",
              }}
            >
              {AppStrings.GameScreenAlerts.HINT_MODAL_TITLE}
            </Text>

            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontSecondary,
                fontSize: TYPOGRAPHY.fontSize.lg,
                color: "black",
                marginBottom: SPACING.lg,
                textAlign: "center",
              }}
            >
              {AppStrings.GameScreenAlerts.COST_COINS_PREFIX}{hintCost}{AppStrings.GameScreenAlerts.COST_COINS_MIDDLE}{userCoins}{AppStrings.GameScreenAlerts.COST_COINS_SUFFIX}
            </Text>

            {!canAffordHint && (
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "#FF6B6B",
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                {AppStrings.GameScreenAlerts.HINT_NOT_ENOUGH_COINS_MESSAGE}
              </Text>
            )}

            <View style={{ width: "100%", marginTop: SPACING.lg }}>
              <WideButton
                buttonText={
                  canAffordHint
                    ? AppStrings.GameScreenAlerts.HINT_SHOW_BUTTON
                    : AppStrings.Navigation.BUY_COINS_BUTTON
                }
                onPress={() => {
                  onClose();
                  if (canAffordHint) {
                    onShowHint();
                  } else {
                    onOpenShop();
                  }
                }}
                disabled={false}
              />

              <View style={{ marginTop: SPACING.md }}>
                <WideButton
                  buttonText={AppStrings.CommonAlerts.CLOSE_BUTTON}
                  onPress={onClose}
                  disabled={false}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default HintModal;
