import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { Player } from "../../validation/firestoreSchemas";
import * as ImagePicker from "react-native-image-picker";
import storage from "@react-native-firebase/storage";
import type { FirebaseStorageTypes } from "@react-native-firebase/storage";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Props for the ProfileOverlay component.
 * @property {boolean} isVisible - Controls the visibility of the profile overlay.
 * @property {() => void} onClose - Function to call when the overlay is closed.
 * @property {Player | null} playerData - The player data to display.
 * @property {() => void} onShowFullProfile - Function to call when the 'View Full Profile' button is pressed.
 */
interface ProfileOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  playerData: Player | null;
  onShowFullProfile: () => void;
}

// @ts-ignore - Placeholder for now, will be implemented in Full Profile Page
const preloadedAvatars: { url: string; name: string }[] = [];

/**
 * Overlay component for displaying the user's profile information and stats.
 * It shows profile details and provides a way to close the overlay.
 * @param {ProfileOverlayProps} props - The props for the component.
 * @returns {React.FC<ProfileOverlayProps>} The rendered ProfileOverlay component.
 */
const ProfileOverlay: React.FC<ProfileOverlayProps> = ({
  isVisible,
  onClose,
  playerData,
  onShowFullProfile,
}) => {
  if (!playerData) {
    return null;
  }

  const { updatePlayerData } = useAuth();

  const currentXp = 0;
  const maxXp = 100;
  const xpProgress = (currentXp / maxXp) * 100;

  const handleAvatarSelect = async () => {
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

            await updatePlayerData({ avatarUrl: downloadURL });

            console.log("Avatar URL updated successfully.");
          });
        }
      }
    } catch (error) {
      console.error("Avatar selection or upload error:", error);
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
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm">
          <View className="flex-row items-center mb-6">
            <TouchableOpacity onPress={handleAvatarSelect}>
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
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-800">
                {playerData.username || "Guest"}
              </Text>
              <View className="mt-2 w-full bg-gray-300 rounded-full h-2">
                <View
                  className="bg-primary-orange h-2 rounded-full"
                  style={{ width: `${xpProgress}%` }}
                />
              </View>
              <Text className="text-sm text-gray-600 mt-1 text-right">
                {currentXp}/{maxXp} XP
              </Text>
            </View>
          </View>

          <View className="grid grid-cols-2 gap-4 mb-6">
            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-800">
                {playerData.progress?.dailyChallengeIndex || 0}
              </Text>
              <Text className="text-sm text-gray-600">Daily Puzzles</Text>
            </View>

            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-800">
                {(playerData.stats?.bestStreak as number) || 0}
              </Text>
              <Text className="text-sm text-gray-600">Best Streak</Text>
            </View>

            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-800">
                {(playerData.stats?.totalWordsGuessed as number) || 0}
              </Text>
              <Text className="text-sm text-gray-600">Words Guessed</Text>
            </View>

            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-800">{`${
                (playerData.stats?.winRate as number) || 0
              }%`}</Text>
              <Text className="text-sm text-gray-600">Win Rate</Text>
            </View>

            {/* Add Total Score, Highest Level, and Games Played */}
            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-800">
                {(playerData.stats?.totalScore as number) || 0}
              </Text>
              <Text className="text-sm text-gray-600">Total Score</Text>
            </View>

            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-800">
                {(playerData.stats?.highestLevelClassic as number) || 0}
              </Text>
              <Text className="text-sm text-gray-600">Highest Level</Text>
            </View>

            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-800">
                {(playerData.stats?.gamesPlayed as number) || 0}
              </Text>
              <Text className="text-sm text-gray-600">Games Played</Text>
            </View>
          </View>

          {/* Coins Display with Treasure Chest Icon */}
          <View className="flex-row items-center justify-center mb-6">
            {/* Placeholder for Treasure Chest Icon */}
            <View className="w-8 h-8 bg-yellow-500 rounded-sm mr-2" />{" "}
            {/* Placeholder View for the icon */}
            <Text className="text-2xl font-bold text-gray-800 mr-2">
              {playerData.coins || 0}
            </Text>
            <Text className="text-lg text-gray-600">Coins</Text>
          </View>

          {/* Update Profile Options */}
          <View className="w-full mt-6 border-t border-gray-200 pt-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">
              Account Settings
            </Text>

            {/* Update Username Button */}
            <TouchableOpacity
              className="bg-gray-200 px-4 py-3 rounded-md mb-3 w-full items-center"
              onPress={() => console.log("Update Username Pressed")}
            >
              <Text className="text-gray-800 font-semibold">
                Update Username
              </Text>
            </TouchableOpacity>

            {/* Change Password Button */}
            <TouchableOpacity
              className="bg-gray-200 px-4 py-3 rounded-md mb-3 w-full items-center"
              onPress={() => console.log("Change Password Pressed")}
            >
              <Text className="text-gray-800 font-semibold">
                Change Password
              </Text>
            </TouchableOpacity>

            {/* Link Account Button (Placeholder) */}
            <TouchableOpacity
              className="bg-gray-200 px-4 py-3 rounded-md w-full items-center"
              onPress={() => console.log("Link Account Pressed")}
            >
              <Text className="text-gray-800 font-semibold">Link Accounts</Text>
            </TouchableOpacity>
          </View>

          {/* Add a button to navigate to the Full Profile Details Overlay */}
          <TouchableOpacity
            className="bg-blue-500 px-4 py-3 rounded-md mt-6 w-full items-center"
            onPress={onShowFullProfile}
          >
            <Text className="text-white font-semibold">View Full Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            className="bg-gray-500 px-4 py-2 rounded w-full items-center mt-4"
          >
            <Text className="text-white font-bold">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ProfileOverlay;
