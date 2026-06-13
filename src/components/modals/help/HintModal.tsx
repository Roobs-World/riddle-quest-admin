/**
 * @fileoverview HintModal component - Modal for purchasing gameplay hints in Riddle Quest.
 */

import React from "react";
import {View, Text, Modal} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import {TYPOGRAPHY} from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WideButton from "src/components/buttons/WideButton";
import {
  MODAL_WIDTH, MODAL_HEIGHT, CLOSE_BUTTON_SIZE, MODAL_CLOSE_BUTTON_POSITION, MODAL_MAX_HEIGHT, } from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {t} from "../../../i18n";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {verticalScale} from "../../../utils/responsive";
import {ModalReward} from "@/components/rewards/RewardFactory";

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
const HintModal: React.FC<HintModalProps> = ({isVisible, userCoins, hintCost, onShowHint, onClose, onOpenShop}) => {
  const canAffordHint = userCoins >= hintCost;
  const hintModalHeight = Math.min(MODAL_HEIGHT * 1.4, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT * 1.4);

  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: hintModalHeight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModalBg
              width={MODAL_WIDTH}
              height={hintModalHeight}
              style={{position: "absolute"}}
              preserveAspectRatio="none"
            />
            {/* Decorative wave — clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={hintModalHeight * 1.05}
              style={{position: "absolute", top: -hintModalHeight * 0.05, left: -MODAL_WIDTH * 0.05}}
            />
            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={{...MODAL_CLOSE_BUTTON_POSITION, marginTop: verticalScale(12)}}
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
                {t("GameScreenAlerts.HINT_MODAL_TITLE")}
              </Text>

              <ModalReward amount={-hintCost} totalCoins={userCoins} />

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
                  {t("GameScreenAlerts.HINT_NOT_ENOUGH_COINS_MESSAGE")}
                </Text>
              )}

              <View style={{width: "100%", marginTop: SPACING.lg}}>
                <WideButton
                  buttonText={
                    canAffordHint
                      ? t("GameScreenAlerts.HINT_SHOW_BUTTON")
                      : t("Navigation.BUY_COINS_BUTTON")
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
              </View>
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default HintModal;
