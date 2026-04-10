import React from "react";
import { View, Modal, TouchableOpacity } from "react-native";
import CloseButton from "../buttons/CloseButton";
import { styles } from "../../styles";
import { CLOSE_BUTTON_SIZE } from "../../constants/layout";

interface BaseOverlayProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showCloseButton?: boolean;
  backgroundColor?: string;
  overlayStyle?: object;
  contentStyle?: object;
}

const BaseOverlay: React.FC<BaseOverlayProps> = ({
  visible,
  onClose,
  children,
  showCloseButton = true,
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
                styles.baseOverlayCloseButtonContainer,
                styles.topRight,
              ]}
            >
              <CloseButton onPress={onClose} size={CLOSE_BUTTON_SIZE} />
            </View>
          )}
          {children}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default BaseOverlay;

