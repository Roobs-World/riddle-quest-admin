import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import WideButton from "../buttons/WideButton";
import { AppStrings } from "../../constants/AppStrings";
import Icon from "react-native-vector-icons/Ionicons";
import { styles } from "../../styles";

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
