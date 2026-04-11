import React from "react";
import { View, Modal, TouchableOpacity } from "react-native";
import CloseButton from "../buttons/CloseButton";
import { styles } from "../../styles";
import { CLOSE_BUTTON_SIZE } from "../../constants/layout";

/**
 * Shared props for lightweight full-screen overlays.
 */
interface BaseOverlayProps {
  /** Controls whether the overlay modal is mounted and visible. */
  visible: boolean;
  /** Called when backdrop or close button is pressed. */
  onClose: () => void;
  /** Overlay content rendered in the centered panel. */
  children: React.ReactNode;
  /** When true, renders the default top-right close button. */
  showCloseButton?: boolean;
  /** Backdrop color override. */
  backgroundColor?: string;
  /** Additional styles applied to the full-screen backdrop container. */
  overlayStyle?: object;
  /** Additional styles applied to the content card container. */
  contentStyle?: object;
}

/**
 * Reusable modal overlay wrapper with optional built-in close affordance.
 *
 * @param props Overlay visibility, handlers, and style/content customizations.
 * @returns Modal wrapper that captures backdrop presses.
 */
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
