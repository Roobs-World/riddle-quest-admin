/**
 * @fileoverview GameModeModal component - Modal for selecting game mode.
 *
 * This modal allows players to choose between different game modes:
 * - Classic mode: Regular gameplay with unlimited levels
 * - Daily Challenge: Daily puzzles with special rewards
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { TYPOGRAPHY } from "../../../styles";
import WideButton from "src/components/buttons/WideButton";

interface GameModeModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectMode: (mode: "classic" | "daily") => void;
}

/**
 * GameModeModal Component
 *
 * A modal that allows players to select between different game modes.
 * Currently supports Classic mode and Daily Challenge mode.
 *
 * @param {GameModeModalProps} props - Component props
 * @returns {JSX.Element} Rendered game mode selection modal
 */
const GameModeModal: React.FC<GameModeModalProps> = ({
  isVisible,
  onClose,
  onSelectMode,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            borderRadius: 20,
            padding: 20,
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: 335,
            height: 423,
            overflow: "hidden",
          }}
        >
          <ModalBg
            width="100%"
            height="100%"
            style={{ position: "absolute" }}
            preserveAspectRatio="xMidYMid slice"
          />

          {/* Close button */}
          <View
            style={{ position: "absolute", top: 10, right: 10, zIndex: 10 }}
          >
            <CloseButton onPress={onClose} size={20} />
          </View>

          {/* Title */}
          <Text
            className="text-2xl text-gray-800 text-center mb-8"
            style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
          >
            LET&apos;S PLAY
          </Text>

          <WideButton
            buttonText="Classic Challenge"
            onPress={() => onSelectMode("classic")}
            buttonColor="bg-orange-500"
          />

          <WideButton
            buttonText="Daily Challenge"
            onPress={() => onSelectMode("daily")}
            buttonColor="bg-orange-500"
          />

          <WideButton
            buttonText="Close"
            onPress={onClose}
            buttonColor="bg-gray-500"
          />
        </View>
      </View>
    </Modal>
  );
};

export default GameModeModal;
