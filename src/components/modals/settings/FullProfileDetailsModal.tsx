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
import { TYPOGRAPHY } from "../../../styles";

const { height: screenHeight } = Dimensions.get("window");

// Import SVG directly
import AvatarBgSvg from "../../../../assets/images/avatar-bg.svg";

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
          <ScrollView
            className="flex-1 px-6"
            showsVerticalScrollIndicator={true}
            bounces={true}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            alwaysBounceVertical={false}
            scrollEnabled={true}
            contentContainerStyle={{
              paddingTop: 20,
              paddingBottom: Math.max(30, insets.bottom + 20),
              flexGrow: 1,
            }}
          >
            {/* Basic Info with background flush to top */}
            <View
              className="items-center mb-6 relative"
              style={{ height: 200, marginTop: -20 }}
            >
              {/* Avatar Background SVG - flush to top */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: [{ translateX: -175.5 }], // Half of SVG width (351/2)
                  zIndex: 0,
                }}
              >
                <AvatarBgSvg width={351} height={231} />
              </View>

              {/* Close Button - positioned over the background */}
              <View
                style={{
                  position: "absolute",
                  top: 20,
                  right: 0,
                  zIndex: 2,
                }}
              >
                <CloseButton onPress={onClose} size={20} />
              </View>

              {/* Avatar and Username - centered within the background */}
              <View
                style={{
                  zIndex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingTop: 40,
                }}
              >
                <TouchableOpacity
                  onPress={handleUpdateAvatarPress}
                  activeOpacity={0.8}
                >
                  {playerData.avatarUrl ? (
                    <Image
                      testID="avatar-image"
                      source={{ uri: playerData.avatarUrl }}
                      className="w-20 h-20 rounded-full"
                      style={{
                        borderWidth: 3,
                        borderColor: "#FCC070",
                      }}
                    />
                  ) : (
                    <View
                      className="w-20 h-20 rounded-full bg-blue-500 items-center justify-center"
                      style={{
                        borderWidth: 3,
                        borderColor: "#FCC070",
                      }}
                    >
                      <Text
                        className="text-white text-3xl font-bold"
                        style={{ fontFamily: TYPOGRAPHY.fontSecondaryBold }}
                      >
                        {playerData.username
                          ? playerData.username.charAt(0).toUpperCase()
                          : ""}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text
                  className="text-xl font-bold text-white mt-3"
                  style={{ fontFamily: TYPOGRAPHY.fontSecondaryBold }}
                >
                  {playerData.username || "Guest"}
                </Text>
              </View>
            </View>

            {/* Comprehensive Stats Grid */}
            <View className="mb-6">
              <View className="flex-row flex-wrap justify-between">
                {/* Row 1 */}
                <View className="w-1/2 items-center mb-4 pr-2">
                  <Text
                    className="text-2xl font-bold text-gray-800"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondaryBold }}
                  >
                    {(playerData.progress?.dailyChallengeIndex || 0).toString()}
                  </Text>
                  <Text
                    className="text-sm text-gray-600 text-center"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondary }}
                  >
                    Daily Puzzles
                  </Text>
                </View>
                <View className="w-1/2 items-center mb-4 pl-2">
                  <Text
                    className="text-2xl font-bold text-gray-800"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondaryBold }}
                  >
                    {(stats?.bestStreak || 0).toString()}
                  </Text>
                  <Text
                    className="text-sm text-gray-600 text-center"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondary }}
                  >
                    Best Streak
                  </Text>
                </View>

                {/* Row 2 */}
                <View className="w-1/2 items-center mb-4 pr-2">
                  <Text
                    className="text-2xl font-bold text-gray-800"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondaryBold }}
                  >
                    {(stats?.totalWordsGuessed || 0).toString()}
                  </Text>
                  <Text
                    className="text-sm text-gray-600 text-center"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondary }}
                  >
                    Words Guessed
                  </Text>
                </View>
                <View className="w-1/2 items-center mb-4 pl-2">
                  <Text
                    className="text-2xl font-bold text-gray-800"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondaryBold }}
                  >
                    {`${(stats?.winRate || 0).toString()}%`}
                  </Text>
                  <Text
                    className="text-sm text-gray-600 text-center"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondary }}
                  >
                    Win Rate
                  </Text>
                </View>

                {/* Row 3 */}
                <View className="w-1/2 items-center mb-4 pr-2">
                  <Text
                    className="text-2xl font-bold text-gray-800"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondaryBold }}
                  >
                    {(stats?.totalScore || 0).toString()}
                  </Text>
                  <Text
                    className="text-sm text-gray-600 text-center"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondary }}
                  >
                    Total Score
                  </Text>
                </View>
                <View className="w-1/2 items-center mb-4 pl-2">
                  <Text
                    className="text-2xl font-bold text-gray-800"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondaryBold }}
                  >
                    {(stats?.highestLevelClassic || 0).toString()}
                  </Text>
                  <Text
                    className="text-sm text-gray-600 text-center"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondary }}
                  >
                    Highest Level
                  </Text>
                </View>

                {/* Row 4 */}
                <View className="w-1/2 items-center mb-4 pr-2">
                  <Text
                    className="text-2xl font-bold text-gray-800"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondaryBold }}
                  >
                    {(stats?.gamesPlayed || 0).toString()}
                  </Text>
                  <Text
                    className="text-sm text-gray-600 text-center"
                    style={{ fontFamily: TYPOGRAPHY.fontSecondary }}
                  >
                    Games Played
                  </Text>
                </View>
              </View>
            </View>
            <TreasureChest coins={playerData.coins} />
            {/* Account Settings / Update Options */}
            <View className="w-full mt-4 pt-4">
              <Text
                className="text-lg text-gray-800 mb-3"
                style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
              >
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
