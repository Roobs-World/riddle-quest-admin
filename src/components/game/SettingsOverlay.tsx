import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Switch, // Import Switch component for toggles
  Alert, // Import Alert component
  StyleSheet, // Import StyleSheet
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import auth from "@react-native-firebase/auth"; // Correct import for auth module
import crashlytics from "@react-native-firebase/crashlytics"; // Import Firebase Crashlytics
import Constants from "expo-constants"; // Import Constants for environment variables
import { AppStrings } from "../..//constants/AppStrings";
import CloseButton from "../buttons/CloseButton";

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
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm items-center relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          <Text className="text-2xl font-bold text-gray-800 mb-6 text-center">
            {AppStrings.Settings.TITLE}
          </Text>

          {/* Sound Toggle */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg text-gray-800">
              {AppStrings.Settings.SOUND_TOGGLE}
            </Text>
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
            <Text className="text-lg text-gray-800">
              {AppStrings.Settings.HAPTICS_TOGGLE}
            </Text>
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
              style={styles.iconSpacing}
            />
            <Text className="text-gray-800 font-semibold">
              {AppStrings.Settings.HELP_BUTTON}
            </Text>
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
              style={styles.iconSpacing}
            />
            <Text className="text-white font-semibold">
              {AppStrings.Settings.LOGOUT_BUTTON}
            </Text>
          </TouchableOpacity>

          {/* Test Crash Button - Development Only */}
          {Constants.expoConfig?.extra?.ENABLE_CRASH_TESTING === "true" && (
            <TouchableOpacity
              className="bg-orange-500 px-4 py-3 rounded-md mb-3 w-full items-center flex-row justify-center mt-3"
              onPress={() => {
                Alert.alert(
                  AppStrings.Settings.TEST_CRASH_ALERT_TITLE,
                  AppStrings.Settings.TEST_CRASH_ALERT_MESSAGE,
                  [
                    {
                      text: AppStrings.Settings.TEST_CRASH_ALERT_CANCEL,
                      style: "cancel",
                    },
                    {
                      text: AppStrings.Settings.TEST_CRASH_ALERT_CRASH,
                      style: "destructive",
                      onPress: () => {
                        console.log("Forcing a test crash for Crashlytics...");
                        crashlytics().crash(); // Force a crash to test Crashlytics
                      },
                    },
                  ]
                );
              }}
            >
              <Icon
                name="bug-report"
                size={20}
                color="#ffffff"
                style={styles.iconSpacing}
              />
              <Text className="text-white font-semibold">
                {AppStrings.Settings.TEST_CRASH_BUTTON}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  iconSpacing: {
    marginRight: 8,
  },
});

export default SettingsOverlay;
