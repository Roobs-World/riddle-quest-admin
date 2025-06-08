import React from "react";
import { View, Text, TouchableOpacity, Modal, Image } from "react-native";
import { Player } from "../../../validation/firestoreSchemas"; // Updated import path
import { useAuth } from "../../../contexts/AuthContext"; // Updated import path
import CloseButton from "../../buttons/CloseButton"; // Updated import path

/**
 * Props for the ProfileModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {() => void} onClose - Function to call when the modal is closed.
 * @property {Player | null} playerData - The player data to display.
 * @property {() => void} onFullProfilePress - Function to call when "Full Profile" button is pressed.
 */
interface ProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
  playerData: Player | null;
  onFullProfilePress: () => void;
}

/**
 * Modal component for displaying user profile information and stats.
 * Simple, minimal view with option to access more detailed profile.
 */
const ProfileModal: React.FC<ProfileModalProps> = ({
  isVisible,
  onClose,
  playerData,
  onFullProfilePress,
}) => {
  // Move useAuth hook before conditional return
  const { logout } = useAuth();

  if (!playerData) {
    return null; // Or render a loading/error state
  }

  // Access stats directly from playerData.stats, ensuring they are treated as numbers
  const { stats } = playerData;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
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
        <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          <Text className="text-2xl font-bold text-gray-800 mb-4">Profile</Text>

          {/* Basic Info */}
          <View className="flex-row items-center mb-6">
            {/* Avatar Display */}
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
              {/* Daily puzzles and streak info */}
              <Text className="text-sm text-gray-600">
                Day {(playerData.progress?.dailyChallengeIndex || 0).toString()}
                {" | "}
                Best Streak: {(stats?.bestStreak || 0).toString()}
              </Text>
            </View>
          </View>

          {/* Quick Stats */}
          <View className="flex-row justify-between mb-6">
            <View className="items-center">
              <Text className="text-lg font-bold text-gray-800">
                {(stats?.totalWordsGuessed || 0).toString()}
              </Text>
              <Text className="text-xs text-gray-600">Words</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-gray-800">
                {`${(stats?.winRate || 0).toString()}%`}
              </Text>
              <Text className="text-xs text-gray-600">Win Rate</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-gray-800">
                {(stats?.highestLevelClassic || 0).toString()}
              </Text>
              <Text className="text-xs text-gray-600">Level</Text>
            </View>
            <View className="items-center">
              {/* Placeholder for Treasure Chest Icon */}
              <View className="w-6 h-6 bg-yellow-500 rounded-sm mb-1" />
              <Text className="text-lg font-bold text-gray-800">
                {(playerData.coins || 0).toString()}
              </Text>
              <Text className="text-xs text-gray-600">Coins</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="space-y-3">
            {/* Full Profile Button */}
            <TouchableOpacity
              onPress={onFullProfilePress}
              className="bg-blue-500 px-4 py-3 rounded-md w-full items-center"
            >
              <Text className="text-white font-bold">Full Profile</Text>
            </TouchableOpacity>

            {/* Logout Button */}
            <TouchableOpacity
              onPress={handleLogout}
              className="bg-red-500 px-4 py-3 rounded-md w-full items-center"
            >
              <Text className="text-white font-bold">Logout</Text>
            </TouchableOpacity>

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              className="bg-gray-500 px-4 py-2 rounded w-full items-center"
            >
              <Text className="text-white font-bold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ProfileModal;
