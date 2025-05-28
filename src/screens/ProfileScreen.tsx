import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import * as ImagePicker from "react-native-image-picker";
import storage from "@react-native-firebase/storage";
import { FirebaseStorageTypes } from "@react-native-firebase/storage";

// Define the structure for preloaded avatars (can be moved to a separate file later)
const preloadedAvatars = [
  {
    url: "https://via.placeholder.com/150/FF5733/FFFFFF?text=P1",
    name: "Preloaded 1",
  },
  {
    url: "https://via.placeholder.com/150/33FF57/FFFFFF?text=P2",
    name: "Preloaded 2",
  },
  {
    url: "https://via.placeholder.com/150/3357FF/FFFFFF?text=P3",
    name: "Preloaded 3",
  },
  // Add more preloaded avatars as needed
];

const ProfileScreen: React.FC = () => {
  const { playerData, updatePlayerData } = useAuth();
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(playerData?.username || "");
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);

  if (!playerData) {
    return (
      <View>
        <Text>Loading profile data...</Text>
      </View>
    ); // Or a loading indicator
  }

  const currentStats = playerData.stats || {};

  const handleUpdateUsername = async () => {
    if (newUsername.trim() === "") {
      Alert.alert("Error", "Username cannot be empty.");
      return;
    }
    if (newUsername === playerData.username) {
      setEditingUsername(false);
      return;
    }
    try {
      await updatePlayerData({ username: newUsername.trim() });
      Alert.alert("Success", "Username updated successfully!");
      setEditingUsername(false);
    } catch (error) {
      console.error("Error updating username:", error);
      Alert.alert("Error", "Failed to update username. Please try again.");
    }
  };

  // Placeholder functions for future implementation
  const handleChangePassword = () => {
    console.log("Navigate to Change Password Screen");
    // TODO: Implement navigation to Change Password screen/modal
  };

  const handleLinkAccounts = () => {
    console.log("Navigate to Link Accounts Screen");
    // TODO: Implement navigation to Link Accounts screen/modal
  };

  const handleAvatarSelect = async () => {
    // This logic is similar to ProfileOverlay, consider refactoring to a utility
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
          const storageRef = storage().ref(
            `avatars/${playerData.userId}/${filename}`
          );

          // Upload the image
          const task = storageRef.putFile(uploadUri);

          // Monitor upload progress (optional)
          task.on(
            "state_changed",
            (snapshot: FirebaseStorageTypes.TaskSnapshot) => {
              const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log("Upload is " + progress + "% done");
              // You could add state here to show upload progress to the user
            }
          );

          // Handle successful upload
          task.then(async () => {
            console.log("Image uploaded to the bucket!");
            // Get the download URL
            const downloadURL = await storageRef.getDownloadURL();
            console.log("File available at", downloadURL);

            // Update user's avatarUrl in Firestore
            await updatePlayerData({ avatarUrl: downloadURL });

            console.log("Avatar URL updated successfully.");
            Alert.alert("Success", "Avatar updated successfully!");
            setShowAvatarOptions(false); // Close options after upload
          });
        }
      }
    } catch (error) {
      console.error("Avatar selection error:", error);
      Alert.alert("Error", "Could not select avatar. Please try again.");
    }
  };

  const handleSelectPreloadedAvatar = async (avatarUrl: string) => {
    try {
      await updatePlayerData({ avatarUrl: avatarUrl });
      Alert.alert("Success", "Avatar updated successfully!");
      setShowAvatarOptions(false); // Close options after selection
    } catch (error) {
      console.error("Error selecting preloaded avatar:", error);
      Alert.alert(
        "Error",
        "Failed to select preloaded avatar. Please try again."
      );
    }
  };

  return (
    <View className="flex-1 p-6 bg-cream-light">
      <Text className="text-2xl font-bold text-gray-800 mb-6">Profile</Text>

      {/* Avatar Section */}
      <View className="items-center mb-8">
        <TouchableOpacity onPress={() => setShowAvatarOptions(true)}>
          {" "}
          {/* Show avatar options */}
          {playerData.avatarUrl ? (
            <Image
              source={{ uri: playerData.avatarUrl }}
              className="w-24 h-24 rounded-full mb-4"
            />
          ) : (
            <View className="w-24 h-24 rounded-full mb-4 bg-blue-500 items-center justify-center">
              <Text className="text-white text-5xl font-bold">
                {playerData.username
                  ? playerData.username.charAt(0).toUpperCase()
                  : ""}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {/* Avatar Options Modal */}
        <Modal
          visible={showAvatarOptions}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAvatarOptions(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/50">
            <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm">
              <Text className="text-xl font-bold text-gray-800 mb-4">
                Change Avatar
              </Text>

              {/* Preloaded Avatars */}
              <Text className="text-lg font-bold text-gray-800 mb-3">
                Select a Preloaded Avatar:
              </Text>
              <View className="flex-row flex-wrap justify-center mb-4">
                {preloadedAvatars.map((avatar, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleSelectPreloadedAvatar(avatar.url)}
                    className="m-2"
                  >
                    <Image
                      source={{ uri: avatar.url }}
                      className="w-16 h-16 rounded-full border-2 border-transparent"
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Upload Custom Avatar */}
              <Text className="text-lg font-bold text-gray-800 mb-3">
                Or Upload Your Own:
              </Text>
              <TouchableOpacity
                className="bg-gray-200 px-4 py-3 rounded-md w-full items-center mb-4"
                onPress={handleAvatarSelect} // This now specifically triggers the image picker
              >
                <Text className="text-gray-800 font-semibold">
                  Choose from Gallery
                </Text>
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                className="bg-red-500 px-4 py-3 rounded-md w-full items-center"
                onPress={() => setShowAvatarOptions(false)}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>

      {/* Username Section */}
      <View className="mb-6">
        <Text className="text-lg font-bold text-gray-800 mb-2">Username:</Text>
        {editingUsername ? (
          <View className="flex-row items-center">
            <TextInput
              className="border border-gray-300 rounded-md px-4 py-2 flex-1 mr-2"
              value={newUsername}
              onChangeText={setNewUsername}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={handleUpdateUsername}
              className="bg-primary-orange px-4 py-2 rounded-md"
            >
              <Text className="text-white font-semibold">Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row items-center">
            <Text className="text-xl text-gray-700 flex-1">
              {playerData.username}
            </Text>
            <TouchableOpacity
              onPress={() => setEditingUsername(true)}
              className="bg-gray-200 px-4 py-2 rounded-md"
            >
              <Text className="text-gray-800 font-semibold">Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Account Settings Buttons */}
      <View className="w-full border-t border-gray-200 pt-6 mb-6">
        <Text className="text-lg font-bold text-gray-800 mb-4">
          Account Settings
        </Text>
        <TouchableOpacity
          className="bg-gray-200 px-4 py-3 rounded-md mb-3 w-full items-center"
          onPress={handleChangePassword}
        >
          <Text className="text-gray-800 font-semibold">Change Password</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-gray-200 px-4 py-3 rounded-md w-full items-center"
          onPress={handleLinkAccounts}
        >
          <Text className="text-gray-800 font-semibold">Link Accounts</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Display */}
      <View className="w-full border-t border-gray-200 pt-6">
        <Text className="text-lg font-bold text-gray-800 mb-4">Stats</Text>
        <View className="grid grid-cols-2 gap-4">
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">
              {currentStats.dailyPuzzlesCompleted || 0}
            </Text>
            <Text className="text-sm text-gray-600">Daily Puzzles</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">
              {currentStats.bestStreak || 0}
            </Text>
            <Text className="text-sm text-gray-600">Best Streak</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">
              {currentStats.totalWordsGuessed || 0}
            </Text>
            <Text className="text-sm text-gray-600">Words Guessed</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">{`${
              currentStats.winRate || 0
            }%`}</Text>
            <Text className="text-sm text-gray-600">Win Rate</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">
              {currentStats.averageGuesses || 0}
            </Text>
            <Text className="text-sm text-gray-600">Avg. Guesses</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">
              {currentStats.totalScore || 0}
            </Text>
            <Text className="text-sm text-gray-600">Total Score</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">
              {currentStats.highestLevelClassic || 0}
            </Text>
            <Text className="text-sm text-gray-600">Highest Classic Level</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">
              {currentStats.gamesPlayed || 0}
            </Text>
            <Text className="text-sm text-gray-600">Games Played</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">
              {currentStats.totalWins || 0}
            </Text>
            <Text className="text-sm text-gray-600">Total Wins</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ProfileScreen;
