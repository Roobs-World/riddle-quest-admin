import React from "react";
import { View, Text, Modal, StyleSheet, TouchableOpacity } from "react-native";
import WideButton from "../buttons/WideButton"; // Adjust path as needed
import { AppStrings } from "../../constants/AppStrings"; // Adjust path as needed
import Icon from "react-native-vector-icons/Ionicons";

const OVERLAY_BACKGROUND_COLOR = "rgba(0,0,0,0.5)";
const TEXT_COLOR_DARK_GREY = "#333";
const SHADOW_COLOR_BLACK = "#000";
const COLOR_WHITE = "#FFFFFF"; // Define constant for white color

interface WatchAdForChanceModalProps {
  visible: boolean;
  onClose: () => void;
  onWatchAd: () => void;
}

const styles = StyleSheet.create({
  centeredView: {
    alignItems: "center",
    backgroundColor: OVERLAY_BACKGROUND_COLOR,
    flex: 1,
    justifyContent: "center", // Semi-transparent background
  },
  closeButtonContainer: {
    position: "absolute",
    right: 8,
    top: 8,
    zIndex: 10,
  },
  modalText: {
    color: TEXT_COLOR_DARK_GREY, // Darker text color for readability
    fontSize: 16, // Adjusted font size
    marginBottom: 20, // Increased margin for better spacing
    textAlign: "center",
  },
  modalView: {
    alignItems: "center",
    backgroundColor: COLOR_WHITE,
    borderRadius: 20,
    elevation: 5,
    margin: 20,
    padding: 35,
    shadowColor: SHADOW_COLOR_BLACK,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: "80%", // Set a width for the modal
  },
  modalWrapper: {
    position: "relative",
  },
});

const WatchAdForChanceModal: React.FC<WatchAdForChanceModalProps> = ({
  visible,
  onClose,
  onWatchAd,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalWrapper}>
        <TouchableOpacity style={styles.closeButtonContainer} onPress={onClose}>
          <Icon name="close" size={24} color="#666" />
        </TouchableOpacity>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>
              {AppStrings.RewardedAdPrompts.OUT_OF_GUESSES_PROMPT}
            </Text>
            <WideButton
              buttonText={AppStrings.RewardedAdPrompts.WATCH_AD_BUTTON}
              onPress={onWatchAd}
              className="mb-4"
            />
            <WideButton
              buttonText={AppStrings.RewardedAdPrompts.NO_THANKS_BUTTON}
              onPress={onClose}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default WatchAdForChanceModal;
