/**
 * @fileoverview GameModeModal — centered card for selecting Classic or Daily game mode.
 */

import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { TYPOGRAPHY, SPACING } from "../../../styles";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_INSET,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_TOP_OFFSET_NARROW,
} from "../../../constants/layout";
import CloseButton from "../../buttons/CloseButton";

interface GameModeModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectMode: (mode: "classic" | "daily") => void;
  currentLevel?: number;
}

const GameModeModal: React.FC<GameModeModalProps> = ({
  isVisible,
  onClose,
  onSelectMode,
  currentLevel,
}) => {
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

          <View
            style={{
              width: "80%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={{
                position: "absolute",
                top: MODAL_CLOSE_TOP_OFFSET_NARROW,
                right: -CLOSE_BUTTON_INSET,
                zIndex: 10,
              }}
            />

            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.xl,
                fontWeight: "bold",
                color: "#1A1A1A",
                letterSpacing: 1,
                marginBottom: SPACING.xl,
              }}
            >
              LET&apos;S PLAY
            </Text>

            {/* Classic Challenge button */}
            <TouchableOpacity
              onPress={() => onSelectMode("classic")}
              style={{
                backgroundColor: "#401F40",
                borderRadius: 16,
                paddingVertical: 18,
                paddingHorizontal: 20,
                width: "100%",
                marginBottom: SPACING.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize.lg,
                  fontWeight: "bold",
                  color: "#FFFFFF",
                }}
              >
                Classic
              </Text>
              {currentLevel != null && (
                <View
                  style={{
                    backgroundColor: "#FEC880",
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 5,
                  }}
                >
                  <Text
                    style={{
                      color: "#1A1A1A",
                      fontFamily: TYPOGRAPHY.fontPrimary,
                      fontWeight: "bold",
                      fontSize: TYPOGRAPHY.fontSize.sm,
                    }}
                  >
                    Level {currentLevel}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Daily Challenge button */}
            <TouchableOpacity
              onPress={() => onSelectMode("daily")}
              style={{
                backgroundColor: "#401F40",
                borderRadius: 16,
                paddingVertical: 18,
                paddingHorizontal: 20,
                width: "100%",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize.lg,
                  fontWeight: "bold",
                  color: "#FFFFFF",
                }}
              >
                Daily Challenge
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default GameModeModal;
