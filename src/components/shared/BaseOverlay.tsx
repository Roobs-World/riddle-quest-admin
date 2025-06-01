import React from "react";
import { View, Modal, TouchableOpacity, StyleSheet } from "react-native";
import CloseButton from "../buttons/CloseButton";

interface BaseOverlayProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showCloseButton?: boolean;
  closeButtonPosition?: "top-right" | "top-left";
  backgroundColor?: string;
  overlayStyle?: object;
  contentStyle?: object;
}

const OVERLAY_BACKGROUND_COLOR = "#2a2a2a";

const BaseOverlay: React.FC<BaseOverlayProps> = ({
  visible,
  onClose,
  children,
  showCloseButton = true,
  closeButtonPosition = "top-right",
  backgroundColor = "rgba(0, 0, 0, 0.8)",
  overlayStyle,
  contentStyle,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor }, overlayStyle]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={[styles.content, contentStyle]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {showCloseButton && (
            <View
              style={[
                styles.closeButtonContainer,
                closeButtonPosition === "top-left"
                  ? styles.topLeft
                  : styles.topRight,
              ]}
            >
              <CloseButton onPress={onClose} size={20} />
            </View>
          )}
          {children}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  closeButtonContainer: {
    position: "absolute",
    top: 8,
    zIndex: 10,
  },
  content: {
    backgroundColor: OVERLAY_BACKGROUND_COLOR,
    borderRadius: 20,
    margin: 20,
    maxHeight: "80%",
    maxWidth: "90%",
    padding: 20,
    position: "relative",
  },
  overlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  topLeft: {
    left: 8,
  },
  topRight: {
    right: 8,
  },
});

export default BaseOverlay;
