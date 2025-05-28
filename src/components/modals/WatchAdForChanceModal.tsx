import React from "react";
import { View, Text, Modal, StyleSheet } from "react-native";
import WideButton from "../buttons/WideButton"; // Adjust path as needed
import { AppStrings } from "../../constants/AppStrings"; // Adjust path as needed

interface WatchAdForChanceModalProps {
  visible: boolean;
  onClose: () => void;
  onWatchAd: () => void;
}

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
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    flex: 1,
    justifyContent: "center", // Semi-transparent background
  },
  modalText: {
    color: "#333", // Darker text color for readability
    fontSize: 16, // Adjusted font size
    marginBottom: 20, // Increased margin for better spacing
    textAlign: "center",
  },
  modalView: {
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 20,
    elevation: 5,
    margin: 20,
    padding: 35,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: "80%", // Set a width for the modal
  },
});

export default WatchAdForChanceModal;
