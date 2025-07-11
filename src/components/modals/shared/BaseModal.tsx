import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import ModalBg from "../../../../assets/images/modal-bg.svg";

interface BaseModalProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

const BaseModal: React.FC<BaseModalProps> = ({ children, style }) => {
  return (
    <View style={[styles.modalContainer, style]}>
      <ModalBg style={StyleSheet.absoluteFill} />
      <View style={styles.contentContainer}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
    width: "100%",
  },
  modalContainer: {
    alignItems: "center",
    height: 423,
    justifyContent: "center",
    width: 335,
  },
});

export default BaseModal;
