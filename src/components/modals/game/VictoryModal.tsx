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
import { View, Text, Modal } from "react-native";
import type { SubmittedGuess } from "../../../hooks/types";
import { generateFeedbackEmojiGrid } from "../../../utils/gameUtils";
import WideButton from "../../buttons/WideButton";
import SocialShareButton from "../../buttons/SocialShareButton";
import LargeCoinStackSvg from "../../../../assets/images/large-coin-stack.svg";
import { scale } from "../../../utils/responsive";
import { SocialSharingService } from "../../../services/SocialSharingService";
import { TYPOGRAPHY } from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";

interface VictoryModalProps {
  isVisible: boolean;
  attempts: number;
  coinsEarned: number;
  onNextLevel: () => void;
  onHome: () => void;
  guesses: SubmittedGuess[];
  gameMode?: "daily" | "classic";
  onClose: () => void;
}

const VictoryModal: React.FC<VictoryModalProps> = ({
  isVisible,
  attempts,
  coinsEarned,
  onNextLevel,
  onHome,
  guesses,
  gameMode = "daily",
  onClose,
}) => {
  const emojiSummary = generateFeedbackEmojiGrid(guesses);

  const handleShare = async (platform: "facebook" | "x") => {
    try {
      const shareContent = {
        attempts,
        emojiGrid: emojiSummary,
        gameMode,
      };
      await SocialSharingService.share(platform, shareContent);
    } catch (error) {
      console.error(`Error sharing to ${platform}:`, error);
    }
  };

  const handleNextLevel = async () => {
    if (typeof onNextLevel === "function") {
      await Promise.resolve(onNextLevel());
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
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: scale(32),
                color: "white",
              }}
            >
              Victory!
            </Text>

            <View style={{ alignItems: "center" }}>
              <LargeCoinStackSvg width={scale(80)} height={scale(80)} />
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondaryBold,
                  fontSize: scale(24),
                  color: "white",
                }}
              >
                +{coinsEarned} Coins
              </Text>
            </View>

            <View style={{ alignItems: "center" }}>
              <Text style={{ color: "white", fontSize: scale(16) }}>
                {emojiSummary}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  marginTop: 10,
                }}
              >
                <SocialShareButton
                  platform="facebook"
                  onPress={() => handleShare("facebook")}
                />
                <View style={{ width: 10 }} />
                <SocialShareButton
                  platform="x"
                  onPress={() => handleShare("x")}
                />
              </View>
            </View>

            <View style={{ width: "100%" }}>
              <WideButton onPress={handleNextLevel} buttonText="Next Level" />
              <View style={{ height: 10 }} />
              <WideButton onPress={handleHome} buttonText="Home" />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default VictoryModal;
