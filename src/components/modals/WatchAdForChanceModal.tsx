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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)", // Semi-transparent background
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "80%", // Set a width for the modal
  },
  modalText: {
    marginBottom: 20, // Increased margin for better spacing
    textAlign: "center",
    fontSize: 16, // Adjusted font size
    color: "#333", // Darker text color for readability
  },
});

export default WatchAdForChanceModal;
