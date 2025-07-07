import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Alert,
  TextInput,
  SafeAreaView,
} from "react-native";
import { Player } from "../../../validation/firestoreSchemas"; // Updated import path
import { useAuth } from "../../../contexts/AuthContext"; // Updated import path
import * as ImagePicker from "react-native-image-picker";
import {
  getStorage,
  FirebaseStorageTypes,
} from "@react-native-firebase/storage";
import { getFunctions } from "@react-native-firebase/functions";
import { getAuth, EmailAuthProvider } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import WideButton from "../../buttons/WideButton"; // Updated import path
import CloseButton from "../../buttons/CloseButton"; // Updated import path

// Placeholder array of preloaded avatar URLs
const preloadedAvatars = [
  "https://firebasestorage.googleapis.com/v0/b/your-project-id.appspot.com/o/avatars%2Fpreloaded%2Favatar1.png?alt=media", // Replace with actual URLs
  "https://firebasestorage.googleapis.com/v0/b/your-project-id.appspot.com/o/avatars%2Fpreloaded%2Favatar2.png?alt=media",
  "https://firebasestorage.googleapis.com/v0/b/your-project-id.appspot.com/o/avatars%2Fpreloaded%2Favatar3.png?alt=media",
  // Add more preloaded avatar URLs here
];

/**
 * Props for the FullProfileDetailsModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {() => void} onClose - Function to call when the modal is closed.
 * @property {Player | null} playerData - The player data to display.
 */
interface FullProfileDetailsModalProps {
  isVisible: boolean;
  onClose: () => void;
  playerData: Player | null;
}

// Define proper error interface for Firebase errors
interface FirebaseError {
  code: string;
  message: string;
  email?: string;
}

/**
 * Modal component for displaying comprehensive user profile details and settings.
 * Accessible from the basic Profile Modal.
 */
const FullProfileDetailsModal: React.FC<FullProfileDetailsModalProps> = ({
  isVisible,
  onClose,
  playerData,
}) => {
  // Move all hooks to the top, before any conditional returns
  const { updatePlayerData } = useAuth(); // Get updatePlayerData from auth context

  const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState(playerData?.username || "");
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isPreloadedAvatarsModalVisible, setIsPreloadedAvatarsModalVisible] =
    useState(false); // State for preloaded avatars modal
  const [isAvatarOptionsModalVisible, setIsAvatarOptionsModalVisible] = // State for avatar options modal
    useState(false);

  // Now handle the conditional return after all hooks are called
  if (!playerData) {
    return null; // Or render a loading/error state
  }

  // Access stats directly from playerData.stats, ensuring they are treated as numbers
  const { stats } = playerData;

  // Function to get Facebook photo URL from provider data
  const getFacebookPhotoUrl = () => {
    const facebookProviderData = getAuth(
      getApp()
    ).currentUser?.providerData.find((p) => p.providerId === "facebook.com");
    return facebookProviderData?.photoURL || null;
  };

  const handleUploadAvatar = async () => {
    setIsAvatarOptionsModalVisible(false); // Close options modal
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
        if (selectedAsset.uri && playerData?.userId) {
          const uploadUri = selectedAsset.uri;
          const filename = uploadUri.substring(uploadUri.lastIndexOf("/") + 1);
          const storageRef = getStorage(getApp()).ref(
            `avatars/${playerData.userId}/${filename}`
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

  const handlePreloadedAvatarSelect = async (avatarUrl: string) => {
    try {
      // Update the avatarUrl in the user's Firestore document
      await updatePlayerData({ avatarUrl });
      Alert.alert("Success", "Avatar updated successfully!");
      setIsPreloadedAvatarsModalVisible(false); // Close modal on selection
      setIsAvatarOptionsModalVisible(false); // Also close the options modal if open
    } catch (error) {
      console.error("Error updating avatar:", error);
      Alert.alert("Error", "Could not update avatar. Please try again.");
    }
  };

  const handleUseFacebookAvatar = async () => {
    setIsAvatarOptionsModalVisible(false); // Close options modal
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

  const handleUpdateAvatarPress = () => {
    setIsAvatarOptionsModalVisible(true); // Open avatar options modal
  };

  const handleCloseAvatarOptionsModal = () => {
    setIsAvatarOptionsModalVisible(false);
  };

  const handleUpdateUsername = async () => {
    if (newUsername.trim() === "") {
      Alert.alert("Error", "Username cannot be empty.");
      return;
    }

    // Add a check for minimum length, e.g., 3 characters
    if (newUsername.trim().length < 3) {
      Alert.alert("Error", "Username must be at least 3 characters long.");
      return;
    }

    try {
      const processFormSubmissionCallable = getFunctions(
        getApp()
      ).httpsCallable("processFormSubmission");
      const result = await processFormSubmissionCallable({
        formType: "profileUpdate",
        formData: {
          displayName: newUsername, // Use displayName as per backend function
        },
      });

      const responseData = result.data as { success: boolean; message: string }; // Explicit type casting

      if (responseData.success) {
        Alert.alert("Success", responseData.message);
        // Update client-side player data with the new username
        // NOTE: The backend updates 'displayName', assuming client uses 'username'
        // Ensure consistency between backend and frontend field names or map them.
        updatePlayerData({ username: newUsername }); // Assuming username is the correct field to update
        setIsUsernameModalVisible(false);
      } else {
        // This else block might not be reached if backend throws HttpsError
        Alert.alert("Error", responseData.message || "Username update failed.");
      }
    } catch (error) {
      const firebaseError = error as FirebaseError;
      console.error("Error updating username:", firebaseError);
      let errorMessage = "An error occurred.";
      if (firebaseError.code === "invalid-argument") {
        errorMessage = "Invalid username data provided.";
      } else if (firebaseError.code === "internal") {
        errorMessage = "Server error updating username.";
      } else if (firebaseError.message) {
        // Catch other potential errors with a message
        errorMessage = firebaseError.message;
      }
      Alert.alert("Error", errorMessage);
    }
  };

  const handleChangePassword = async () => {
    // 1. Validate inputs (currentPassword, newPassword, confirmNewPassword)
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert("Error", "Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters long.");
      return;
    }

    const user = getAuth(getApp()).currentUser;

    if (!user || !user.email) {
      Alert.alert("Error", "User not logged in or email not available.");
      return;
    }

    try {
      // 3. Re-authenticate user if necessary
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await user.reauthenticateWithCredential(credential);

      // 4. Call user.updatePassword(newPassword) with current user instance
      await user.updatePassword(newPassword);

      // 5. Handle success
      Alert.alert("Success", "Password updated successfully!");
      setIsPasswordModalVisible(false); // Close modal on completion
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      const firebaseError = error as FirebaseError;
      console.error("Error changing password:", firebaseError);
      let errorMessage = "An error occurred while changing password.";

      if (firebaseError.code === "auth/requires-recent-login") {
        errorMessage = "Please log in again to change your password.";
      } else if (firebaseError.code === "auth/invalid-credential") {
        errorMessage = "Invalid current password.";
      } else if (firebaseError.code === "auth/weak-password") {
        errorMessage = "New password is too weak.";
      } else if (firebaseError.message) {
        errorMessage = firebaseError.message;
      }

      Alert.alert("Error", errorMessage);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View
          className="bg-white rounded-lg m-4 w-11/12 max-w-sm relative"
          style={{ height: "85%" }}
          pointerEvents="box-none"
        >
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          <ScrollView
            className="p-6 pt-12"
            showsVerticalScrollIndicator={true}
            bounces={true}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            alwaysBounceVertical={true}
            scrollEnabled={true}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
          >
            <Text className="text-2xl font-bold text-gray-800 mb-4">
              Full Profile
            </Text>

            {/* Basic Info (similar to ProfileOverlay but can add more detail) */}
            <View className="flex-row items-center mb-6">
              {/* Avatar Display - Reusing logic or component from ProfileOverlay */}
              {playerData.avatarUrl ? (
                <Image
                  source={{ uri: playerData.avatarUrl }}
                  className="w-16 h-16 rounded-full mr-4"
                />
              ) : (
                <View className="w-16 h-16 rounded-full mr-4 bg-blue-500 items-center justify-center">
                  <Text className="text-white text-3xl font-bold">
                    {playerData.username
                      ? playerData.username.charAt(0).toUpperCase()
                      : ""}
                  </Text>
                </View>
              )}
              <View className="flex-1">
                <Text className="text-xl font-bold text-gray-800">
                  {playerData.username || "Guest"}
                </Text>
                {/* Additional basic info if needed */}
              </View>
            </View>

            {/* Comprehensive Stats Grid */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">
                Statistics
              </Text>
              <View className="flex-row flex-wrap justify-between">
                {/* Row 1 */}
                <View className="w-1/2 items-center mb-4 pr-2">
                  <Text className="text-2xl font-bold text-gray-800">
                    {(playerData.progress?.dailyChallengeIndex || 0).toString()}
                  </Text>
                  <Text className="text-sm text-gray-600 text-center">
                    Daily Puzzles
                  </Text>
                </View>
                <View className="w-1/2 items-center mb-4 pl-2">
                  <Text className="text-2xl font-bold text-gray-800">
                    {(stats?.bestStreak || 0).toString()}
                  </Text>
                  <Text className="text-sm text-gray-600 text-center">
                    Best Streak
                  </Text>
                </View>

                {/* Row 2 */}
                <View className="w-1/2 items-center mb-4 pr-2">
                  <Text className="text-2xl font-bold text-gray-800">
                    {(stats?.totalWordsGuessed || 0).toString()}
                  </Text>
                  <Text className="text-sm text-gray-600 text-center">
                    Words Guessed
                  </Text>
                </View>
                <View className="w-1/2 items-center mb-4 pl-2">
                  <Text className="text-2xl font-bold text-gray-800">
                    {`${(stats?.winRate || 0).toString()}%`}
                  </Text>
                  <Text className="text-sm text-gray-600 text-center">
                    Win Rate
                  </Text>
                </View>

                {/* Row 3 */}
                <View className="w-1/2 items-center mb-4 pr-2">
                  <Text className="text-2xl font-bold text-gray-800">
                    {(stats?.totalScore || 0).toString()}
                  </Text>
                  <Text className="text-sm text-gray-600 text-center">
                    Total Score
                  </Text>
                </View>
                <View className="w-1/2 items-center mb-4 pl-2">
                  <Text className="text-2xl font-bold text-gray-800">
                    {(stats?.highestLevelClassic || 0).toString()}
                  </Text>
                  <Text className="text-sm text-gray-600 text-center">
                    Highest Level
                  </Text>
                </View>

                {/* Row 4 */}
                <View className="w-1/2 items-center mb-4 pr-2">
                  <Text className="text-2xl font-bold text-gray-800">
                    {(stats?.gamesPlayed || 0).toString()}
                  </Text>
                  <Text className="text-sm text-gray-600 text-center">
                    Games Played
                  </Text>
                </View>
                <View className="w-1/2 items-center mb-4 pl-2">
                  <View className="w-8 h-8 bg-yellow-500 rounded-sm mb-1" />
                  <Text className="text-2xl font-bold text-gray-800">
                    {(playerData.coins || 0).toString()}
                  </Text>
                  <Text className="text-sm text-gray-600 text-center">
                    Coins
                  </Text>
                </View>
              </View>
            </View>

            {/* Update Avatar Options */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-gray-800 mb-3">
                Avatar
              </Text>
              <WideButton
                buttonText="Update Avatar"
                onPress={handleUpdateAvatarPress}
              />
            </View>

            {/* Account Settings / Update Options */}
            <View className="w-full mt-4 border-t border-gray-200 pt-4">
              <Text className="text-lg font-bold text-gray-800 mb-3">
                Account Settings
              </Text>

              {/* Update Username Button */}
              <TouchableOpacity
                className="bg-gray-200 px-4 py-3 rounded-md mb-3 w-full items-center"
                onPress={() => setIsUsernameModalVisible(true)}
              >
                <Text className="text-gray-800 font-semibold">
                  Update Username
                </Text>
              </TouchableOpacity>

              {/* Change Password Button */}
              <TouchableOpacity
                className="bg-gray-200 px-4 py-3 rounded-md mb-3 w-full items-center"
                onPress={() => setIsPasswordModalVisible(true)}
              >
                <Text className="text-gray-800 font-semibold">
                  Change Password
                </Text>
              </TouchableOpacity>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              className="bg-gray-500 px-4 py-2 rounded w-full items-center mt-6"
            >
              <Text className="text-white font-bold">Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Change Password Modal */}
      <Modal
        visible={isPasswordModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm relative">
            {/* Close Button in top-right corner */}
            <View className="absolute top-2 right-2 z-10">
              <CloseButton
                onPress={() => setIsPasswordModalVisible(false)}
                size={20}
              />
            </View>

            <Text className="text-lg font-bold text-gray-800 mb-4">
              Change Password
            </Text>
            <TextInput
              className="border border-gray-300 p-3 rounded-md mb-4 text-gray-800"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current Password"
              secureTextEntry
            />
            <TextInput
              className="border border-gray-300 p-3 rounded-md mb-4 text-gray-800"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              secureTextEntry
            />
            <TextInput
              className="border border-gray-300 p-3 rounded-md mb-4 text-gray-800"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder="Confirm New Password"
              secureTextEntry
            />
            <TouchableOpacity
              className="bg-blue-500 px-4 py-3 rounded-md mb-3 w-full items-center"
              onPress={handleChangePassword}
            >
              <Text className="text-white font-semibold">Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-gray-300 px-4 py-3 rounded-md w-full items-center"
              onPress={() => setIsPasswordModalVisible(false)}
            >
              <Text className="text-gray-800 font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Update Username Modal */}
      <Modal
        visible={isUsernameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsUsernameModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm relative">
            {/* Close Button in top-right corner */}
            <View className="absolute top-2 right-2 z-10">
              <CloseButton
                onPress={() => setIsUsernameModalVisible(false)}
                size={20}
              />
            </View>

            <Text className="text-lg font-bold text-gray-800 mb-4">
              Update Username
            </Text>
            <TextInput
              className="border border-gray-300 p-3 rounded-md mb-4 text-gray-800"
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Enter new username"
              autoCapitalize="none"
            />
            <TouchableOpacity
              className="bg-blue-500 px-4 py-3 rounded-md mb-3 w-full items-center"
              onPress={handleUpdateUsername}
            >
              <Text className="text-white font-semibold">Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-gray-300 px-4 py-3 rounded-md w-full items-center"
              onPress={() => setIsUsernameModalVisible(false)}
            >
              <Text className="text-gray-800 font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Avatar Options Modal */}
      <Modal
        visible={isAvatarOptionsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseAvatarOptionsModal}
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
              onPress={() => {
                setIsAvatarOptionsModalVisible(false);
                setIsPreloadedAvatarsModalVisible(true);
              }}
            />

            {/* Option: Use Facebook Photo (Conditional) */}
            {getFacebookPhotoUrl() && (
              <WideButton
                buttonText="Use Facebook Photo"
                onPress={handleUseFacebookAvatar}
              />
            )}

            {/* Cancel Button */}
            <WideButton
              buttonText="Cancel"
              onPress={handleCloseAvatarOptionsModal}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Preloaded Avatars Modal */}
      <Modal
        visible={isPreloadedAvatarsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPreloadedAvatarsModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm relative">
            {/* Close Button in top-right corner */}
            <View className="absolute top-2 right-2 z-10">
              <CloseButton
                onPress={() => setIsPreloadedAvatarsModalVisible(false)}
                size={20}
              />
            </View>

            <Text className="text-lg font-bold text-gray-800 mb-4">
              Select Avatar
            </Text>
            <ScrollView className="max-h-60 mb-4">
              <View className="flex-row flex-wrap justify-center">
                {preloadedAvatars.map((url, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handlePreloadedAvatarSelect(url)}
                    className="m-2"
                  >
                    <Image
                      source={{ uri: url }}
                      className="w-16 h-16 rounded-full"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              className="bg-gray-300 px-4 py-3 rounded-md w-full items-center"
              onPress={() => setIsPreloadedAvatarsModalVisible(false)}
            >
              <Text className="text-gray-800 font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

export default FullProfileDetailsModal;
