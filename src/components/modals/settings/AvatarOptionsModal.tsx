import React from "react";
import { View, Text, Modal, SafeAreaView, Alert } from "react-native";
import * as ImagePicker from "react-native-image-picker";
import {
  getStorage,
  FirebaseStorageTypes,
} from "@react-native-firebase/storage";
import { getAuth } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import { useAuth } from "../../../contexts/AuthContext";
import WideButton from "../../buttons/WideButton";

/**
 * Props for the AvatarOptionsModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {() => void} onClose - Function to call when the modal is closed.
 * @property {() => void} onOpenPreloadedAvatars - Function to open the preloaded avatars modal.
 * @property {string | null} userId - The user's ID for avatar upload.
 */
interface AvatarOptionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onOpenPreloadedAvatars: () => void;
  userId: string | null;
}

/**
 * Modal component for avatar update options.
 * Provides options to upload from photo library, choose from preloaded avatars, or use Facebook photo.
 */
const AvatarOptionsModal: React.FC<AvatarOptionsModalProps> = ({
  isVisible,
  onClose,
  onOpenPreloadedAvatars,
  userId,
}) => {
  const { updatePlayerData } = useAuth();

  // Function to get Facebook photo URL from provider data
  const getFacebookPhotoUrl = () => {
    const facebookProviderData = getAuth(
      getApp()
    ).currentUser?.providerData.find((p) => p.providerId === "facebook.com");
    return facebookProviderData?.photoURL || null;
  };

  const handleUploadAvatar = async () => {
    onClose(); // Close options modal
    try {
      const result = await ImagePicker.launchImageLibrary({
        mediaType: "photo",
        maxHeight: 200,
        maxWidth: 200,
        includeBase64: false,
      });

      if (result.didCancel) {
        console.log("User cancelled image picker");
      } else if (result.errorMessage) {
        console.log("ImagePicker Error: ", result.errorMessage);
      } else if (result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        if (selectedAsset.uri && userId) {
          const uploadUri = selectedAsset.uri;
          const filename = uploadUri.substring(uploadUri.lastIndexOf("/") + 1);
          const storageRef = getStorage(getApp()).ref(
            `avatars/${userId}/${filename}`
          );

          const task = storageRef.putFile(uploadUri);

          task.on(
            "state_changed",
            (snapshot: FirebaseStorageTypes.TaskSnapshot) => {
              const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log("Upload is " + progress + "% done");
            }
          );

          task.then(async () => {
            console.log("Image uploaded to the bucket!");
            const downloadURL = await storageRef.getDownloadURL();
            console.log("File available at", downloadURL);

            // Update the avatarUrl in the user's Firestore document
            await updatePlayerData({ avatarUrl: downloadURL });

            Alert.alert("Success", "Avatar updated successfully!");
            console.log("Avatar URL updated successfully.");
          });
        }
      }
    } catch (error) {
      console.error("Avatar selection or upload error:", error);
      Alert.alert("Error", "Could not update avatar. Please try again.");
    }
  };

  const handleUseFacebookAvatar = async () => {
    onClose(); // Close options modal
    const facebookPhotoUrl = getFacebookPhotoUrl();

    if (facebookPhotoUrl) {
      try {
        await updatePlayerData({ avatarUrl: facebookPhotoUrl });
        Alert.alert("Success", "Avatar updated to Facebook photo!");
      } catch (error) {
        console.error("Error setting Facebook avatar:", error);
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
      <SafeAreaView className="flex-1 justify-end bg-black/50">
        <View className="bg-white p-6 rounded-t-lg w-full">
          <Text className="text-xl font-bold text-gray-800 mb-6 text-center">
            Update Avatar
          </Text>

          {/* Option: Upload from Library */}
          <WideButton
            buttonText="Upload from Photo Library"
            onPress={handleUploadAvatar}
          />

          {/* Option: Choose from Preloaded */}
          <WideButton
            buttonText="Choose from Our Avatars"
            onPress={handleChoosePreloadedAvatars}
          />

          {/* Option: Use Facebook Photo (Conditional) */}
          {getFacebookPhotoUrl() && (
            <WideButton
              buttonText="Use Facebook Photo"
              onPress={handleUseFacebookAvatar}
            />
          )}

          {/* Cancel Button */}
          <WideButton buttonText="Cancel" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default AvatarOptionsModal;
