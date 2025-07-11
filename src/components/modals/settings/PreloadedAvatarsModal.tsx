import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useAuth } from "../../../contexts/AuthContext";
import CloseButton from "../../buttons/CloseButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { scale } from "src/utils/responsive";
import { TYPOGRAPHY } from "src/styles";
import WideButton from "../../buttons/WideButton";

// Placeholder array of preloaded avatar URLs
const preloadedAvatars = [
  "https://firebasestorage.googleapis.com/v0/b/your-project-id.appspot.com/o/avatars%2Fpreloaded%2Favatar1.png?alt=media",
  "https://firebasestorage.googleapis.com/v0/b/your-project-id.appspot.com/o/avatars%2Fpreloaded%2Favatar2.png?alt=media",
  "https://firebasestorage.googleapis.com/v0/b/your-project-id.appspot.com/o/avatars%2Fpreloaded%2Favatar3.png?alt=media",
];

interface PreloadedAvatarsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCloseAvatarOptions: () => void;
}

const PreloadedAvatarsModal: React.FC<PreloadedAvatarsModalProps> = ({
  isVisible,
  onClose,
  onCloseAvatarOptions,
}) => {
  const { updatePlayerData } = useAuth();

  const handlePreloadedAvatarSelect = async (avatarUrl: string) => {
    try {
      await updatePlayerData({ avatarUrl });
      Alert.alert("Success", "Avatar updated successfully!");
      onClose();
      onCloseAvatarOptions();
    } catch {
      Alert.alert("Error", "Could not update avatar. Please try again.");
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <View
          style={{
            width: 335,
            height: 423,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg style={{ position: "absolute" }} />
          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 20,
            }}
          >
            <CloseButton
              onPress={onClose}
              size={20}
              style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}
            />
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: scale(24),
                color: "white",
                textAlign: "center",
              }}
            >
              Select Avatar
            </Text>
            <ScrollView
              style={{ flex: 1, width: "100%", maxHeight: 280 }}
              contentContainerStyle={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                paddingVertical: 10,
              }}
            >
              {preloadedAvatars.map((url, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handlePreloadedAvatarSelect(url)}
                  style={{ margin: 8 }}
                >
                  <Image
                    source={{ uri: url }}
                    style={{ width: 64, height: 64, borderRadius: 32 }}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <WideButton
              buttonText="Cancel"
              onPress={onClose}
              buttonColor="bg-gray-500"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default PreloadedAvatarsModal;
