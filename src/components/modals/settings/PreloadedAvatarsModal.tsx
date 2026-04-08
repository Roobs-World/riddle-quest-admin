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
import { TYPOGRAPHY } from "src/styles";
import WideButton from "../../buttons/WideButton";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_SCROLLABLE_MAX_HEIGHT,
  CLOSE_BUTTON_INSET,
  CLOSE_BUTTON_SIZE,
  AVATAR_SIZE_MEDIUM,
  AVATAR_THUMBNAIL_MARGIN,
} from "../../../constants/layout";
import { SPACING } from "../../../styles";

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
      testID="modal"
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
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              padding: MODAL_CONTENT_PADDING,
            }}
          >
            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={{
                position: "absolute",
                top: CLOSE_BUTTON_INSET,
                right: CLOSE_BUTTON_INSET,
                zIndex: 10,
              }}
            />
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize["2xl"],
                color: "black",
                textAlign: "center",
              }}
            >
              Select Avatar
            </Text>
            <ScrollView
              style={{ flex: 1, width: "100%", maxHeight: MODAL_SCROLLABLE_MAX_HEIGHT }}
              contentContainerStyle={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                paddingVertical: SPACING.sm,
              }}
            >
              {preloadedAvatars.map((url, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handlePreloadedAvatarSelect(url)}
                  style={{ margin: AVATAR_THUMBNAIL_MARGIN }}
                >
                  <Image
                    source={{ uri: url }}
                    style={{
                      width: AVATAR_SIZE_MEDIUM,
                      height: AVATAR_SIZE_MEDIUM,
                      borderRadius: AVATAR_SIZE_MEDIUM / 2,
                    }}
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
