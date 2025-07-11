import React from "react";
import { View, Text, Modal, Alert } from "react-native";
import * as ImagePicker from "react-native-image-picker";
import { getStorage } from "@react-native-firebase/storage";
import { getAuth } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import { useAuth } from "../../../contexts/AuthContext";
import WideButton from "../../buttons/WideButton";
import { TYPOGRAPHY } from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { scale } from "src/utils/responsive";
import CloseButton from "../../buttons/CloseButton";

interface AvatarOptionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onOpenPreloadedAvatars: () => void;
  userId: string | null;
}

const AvatarOptionsModal: React.FC<AvatarOptionsModalProps> = ({
  isVisible,
  onClose,
  onOpenPreloadedAvatars,
  userId,
}) => {
  const { updatePlayerData } = useAuth();

  const getFacebookPhotoUrl = () => {
    const facebookProviderData = getAuth(
      getApp()
    ).currentUser?.providerData.find((p) => p.providerId === "facebook.com");
    return facebookProviderData?.photoURL || null;
  };

  const handleUploadAvatar = async () => {
    onClose();
    try {
      const result = await ImagePicker.launchImageLibrary({
        mediaType: "photo",
        maxHeight: 200,
        maxWidth: 200,
        includeBase64: false,
      });

      if (result.didCancel) {
        return;
      }
      if (result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        if (selectedAsset.uri && userId) {
          const uploadUri = selectedAsset.uri;
          const filename = uploadUri.substring(uploadUri.lastIndexOf("/") + 1);
          const storageRef = getStorage(getApp()).ref(
            `avatars/${userId}/${filename}`
          );

          const task = storageRef.putFile(uploadUri);
          task.on("state_changed", () => {});
          await task;
          const downloadURL = await storageRef.getDownloadURL();
          await updatePlayerData({ avatarUrl: downloadURL });

          Alert.alert("Success", "Avatar updated successfully!");
        }
      }
    } catch {
      Alert.alert("Error", "Could not update avatar. Please try again.");
    }
  };

  const handleUseFacebookAvatar = async () => {
    onClose();
    const facebookPhotoUrl = getFacebookPhotoUrl();
    if (facebookPhotoUrl) {
      try {
        await updatePlayerData({ avatarUrl: facebookPhotoUrl });
        Alert.alert("Success", "Avatar updated to Facebook photo!");
      } catch {
        Alert.alert(
          "Error",
          "Could not set Facebook avatar. Please try again."
        );
      }
    } else {
      Alert.alert(
        "Info",
        "No Facebook photo available. Please link your Facebook account first."
      );
    }
  };

  const handleChoosePreloadedAvatars = () => {
    onClose();
    onOpenPreloadedAvatars();
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
              width: "80%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseButton
              onPress={onClose}
              size={20}
              style={{ position: "absolute", top: -60, right: -20, zIndex: 10 }}
            />
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: scale(24),
                color: "white",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              Update Avatar
            </Text>

            <WideButton
              buttonText="Upload from Photo Library"
              onPress={handleUploadAvatar}
            />
            <View style={{ height: 10 }} />
            <WideButton
              buttonText="Choose from Our Avatars"
              onPress={handleChoosePreloadedAvatars}
            />
            {getFacebookPhotoUrl() && (
              <>
                <View style={{ height: 10 }} />
                <WideButton
                  buttonText="Use Facebook Photo"
                  onPress={handleUseFacebookAvatar}
                />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AvatarOptionsModal;
