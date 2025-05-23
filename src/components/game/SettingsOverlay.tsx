import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Switch, // Import Switch component for toggles
  Alert, // Import Alert component
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import auth from "@react-native-firebase/auth"; // Correct import for auth module

/**
 * Props for the SettingsOverlay component.
 * @property {boolean} isVisible - Controls the visibility of the settings overlay.
 * @property {() => void} onClose - Function to call when the overlay is closed.
 * @property {boolean} isSoundEnabled - State of sound setting.
 * @property {(isEnabled: boolean) => void} onToggleSound - Callback to toggle sound.
 * @property {boolean} isHapticsEnabled - State of haptics setting.
 * @property {(isEnabled: boolean) => void} onToggleHaptics - Callback to toggle haptics.
 * @property {() => void} onPressHelp - Callback for the Help button.
 * @property {() => void} onPressLogout - Callback for the Logout button.
 * @property {() => void} onPressResetStats - Callback for the Reset Stats button.
 */
interface SettingsOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  isSoundEnabled: boolean;
  onToggleSound: (isEnabled: boolean) => void;
  isHapticsEnabled: boolean;
  onToggleHaptics: (isEnabled: boolean) => void;
  onPressHelp: () => void;
  onPressLogout: () => void;
  onPressResetStats: () => void;
}

/**
 * Overlay component for displaying game settings.
 */
const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
  isVisible,
  onClose,
  isSoundEnabled,
  onToggleSound,
  isHapticsEnabled,
  onToggleHaptics,
  onPressHelp,
  onPressLogout,
  onPressResetStats,
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm">
          <Text className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Settings
          </Text>

          {/* Sound Toggle */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg text-gray-800">Sound</Text>
            <Switch
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={isSoundEnabled ? "#f5dd4b" : "#f4f3f4"}
              ios_backgroundColor="#3e3e3e"
              onValueChange={onToggleSound}
              value={isSoundEnabled}
            />
          </View>

          {/* Haptics Toggle */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-lg text-gray-800">Haptics</Text>
            <Switch
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={isHapticsEnabled ? "#f5dd4b" : "#f4f3f4"}
              ios_backgroundColor="#3e3e3e"
              onValueChange={onToggleHaptics}
              value={isHapticsEnabled}
            />
          </View>

          {/* Help Button */}
          <TouchableOpacity
            className="bg-gray-200 px-4 py-3 rounded-md mb-3 w-full items-center flex-row justify-center"
            onPress={onPressHelp}
          >
            <Icon
              name="help-outline"
              size={20}
              color="#4b5563"
              style={{ marginRight: 8 }}
            />
            <Text className="text-gray-800 font-semibold">Help</Text>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity
            className="bg-red-500 px-4 py-3 rounded-md mb-3 w-full items-center flex-row justify-center"
            onPress={async () => {
              try {
                console.log("Attempting to log out...");
                await auth().signOut();
                console.log("User logged out successfully.");
                // The onAuthStateChanged listener in AuthContext should handle navigation
                if (onPressLogout) onPressLogout(); // Call any provided callback
              } catch (error) {
                console.error("Error logging out:", error);
                Alert.alert("Error", "Could not log out. Please try again.");
              }
            }}
          >
            <Icon
              name="logout"
              size={20}
              color="#ffffff"
              style={{ marginRight: 8 }}
            />
            <Text className="text-white font-semibold">Logout</Text>
          </TouchableOpacity>

          {/* Reset Stats Button */}
          <TouchableOpacity
            className="bg-yellow-500 px-4 py-3 rounded-md w-full items-center flex-row justify-center"
            onPress={() => {
              Alert.alert(
                "Reset Stats",
                "Are you sure you want to reset all your game statistics? This action cannot be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Reset",
                    style: "destructive",
                    onPress: onPressResetStats,
                  }, // Call the prop on confirmation
                ]
              );
              console.log("Reset Stats confirmation dialog shown.");
              // This should call a backend function to reset the user's stats in Firestore.
              // A confirmation dialog should be shown to the user before proceeding.
              console.log("Reset Stats button pressed");
              // if (onPressResetStats) onPressResetStats(); // Moved inside Alert.alert
            }}
          >
            <Icon
              name="refresh"
              size={20}
              color="#4b5563"
              style={{ marginRight: 8 }}
            />
            <Text className="text-gray-800 font-semibold">Reset Stats</Text>
          </TouchableOpacity>

          {/* Close Button */}
          <TouchableOpacity
            onPress={onClose}
            className="bg-gray-500 px-4 py-2 rounded w-full items-center mt-6"
          >
            <Text className="text-white font-bold">Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default SettingsOverlay;
