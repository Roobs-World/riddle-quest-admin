import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Player } from "../../../validation/firestoreSchemas"; // Updated import path
import WideButton from "../../buttons/WideButton"; // Updated import path
import CloseButton from "../../buttons/CloseButton"; // Updated import path
import ChangePasswordModal from "./ChangePasswordModal";
import UpdateUsernameModal from "./UpdateUsernameModal";
import AvatarOptionsModal from "./AvatarOptionsModal";
import PreloadedAvatarsModal from "./PreloadedAvatarsModal";
import TreasureChest from "./TreasureChest";

const { height: screenHeight } = Dimensions.get("window");

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

/**
 * Modal component for displaying comprehensive user profile details and settings.
 * Accessible from the basic Profile Modal.
 */
const FullProfileDetailsModal: React.FC<FullProfileDetailsModalProps> = ({
  isVisible,
  onClose,
  playerData,
}) => {
  const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isPreloadedAvatarsModalVisible, setIsPreloadedAvatarsModalVisible] =
    useState(false); // State for preloaded avatars modal
  const [isAvatarOptionsModalVisible, setIsAvatarOptionsModalVisible] = // State for avatar options modal
    useState(false);

  // Get safe area insets for proper positioning
  const insets = useSafeAreaInsets();
  const availableHeight = screenHeight - insets.top - insets.bottom;
  const maxModalHeight = availableHeight * 0.85;

  // Now handle the conditional return after all hooks are called
  if (!playerData) {
    return null; // Or render a loading/error state
  }

  // Access stats directly from playerData.stats, ensuring they are treated as numbers
  const { stats } = playerData;

  const handleUpdateAvatarPress = () => {
    setIsAvatarOptionsModalVisible(true); // Open avatar options modal
  };

  const handleCloseAvatarOptionsModal = () => {
    setIsAvatarOptionsModalVisible(false);
  };

  const handleOpenPreloadedAvatars = () => {
    setIsPreloadedAvatarsModalVisible(true);
  };

  const handleClosePreloadedAvatars = () => {
    setIsPreloadedAvatarsModalVisible(false);
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        />

        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Fixed Modal Container */}
        <View
          style={{
            position: "absolute",
            top: insets.top + (availableHeight * 0.1) / 2,
            left: 16,
            right: 16,
            backgroundColor: "white",
            borderRadius: 20,
            height: maxModalHeight,
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: -4,
            },
            shadowOpacity: 0.25,
            shadowRadius: 5,
            elevation: 10,
          }}
        >
          {/* Close Button in top-right corner */}
          <View className="absolute top-4 right-4 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          <ScrollView
            className="flex-1 px-6"
            showsVerticalScrollIndicator={true}
            bounces={true}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            alwaysBounceVertical={false}
            scrollEnabled={true}
            contentContainerStyle={{
              paddingTop: 50, // Account for close button
              paddingBottom: Math.max(30, insets.bottom + 20),
              flexGrow: 1,
            }}
          >
            <Text className="text-2xl font-bold text-gray-800 mb-4">
              Full Profile
            </Text>

            {/* Basic Info (similar to ProfileOverlay but can add more detail) */}
            <View className="flex-row items-center mb-6">
              {/* Avatar Display - Reusing logic or component from ProfileOverlay */}
              {playerData.avatarUrl ? (
                <Image
                  testID="avatar-image"
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

            <TreasureChest coins={playerData.coins} />

            {/* Account Settings / Update Options */}
            <View className="w-full mt-4 border-t border-gray-200 pt-4">
              <Text className="text-lg font-bold text-gray-800 mb-3">
                Account Settings
              </Text>

              {/* Update Username Button */}
              <WideButton
                buttonText="Update Username"
                onPress={() => setIsUsernameModalVisible(true)}
              />

              {/* Change Password Button */}
              <WideButton
                buttonText="Change Password"
                onPress={() => setIsPasswordModalVisible(true)}
              />
            </View>

            {/* Close Button */}
            <WideButton
              buttonText="Close"
              onPress={onClose}
              buttonColor="bg-gray-500"
            />
          </ScrollView>
        </View>
      </View>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isVisible={isPasswordModalVisible}
        onClose={() => setIsPasswordModalVisible(false)}
      />

      {/* Update Username Modal */}
      <UpdateUsernameModal
        isVisible={isUsernameModalVisible}
        onClose={() => setIsUsernameModalVisible(false)}
        currentUsername={playerData?.username || ""}
      />

      {/* Avatar Options Modal */}
      <AvatarOptionsModal
        isVisible={isAvatarOptionsModalVisible}
        onClose={handleCloseAvatarOptionsModal}
        onOpenPreloadedAvatars={handleOpenPreloadedAvatars}
        userId={playerData?.userId || null}
      />

      {/* Preloaded Avatars Modal */}
      <PreloadedAvatarsModal
        isVisible={isPreloadedAvatarsModalVisible}
        onClose={handleClosePreloadedAvatars}
        onCloseAvatarOptions={handleCloseAvatarOptionsModal}
      />
    </Modal>
  );
};

export default FullProfileDetailsModal;
