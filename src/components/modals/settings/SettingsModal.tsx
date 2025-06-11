import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Switch, // Import Switch component for toggles
  Alert, // Import Alert component
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage"; // Add AsyncStorage import
import Icon from "react-native-vector-icons/MaterialIcons";
import auth from "@react-native-firebase/auth"; // Correct import for auth module
import crashlytics from "@react-native-firebase/crashlytics"; // Import Firebase Crashlytics
import Constants from "expo-constants"; // Import Constants for environment variables
import { AppStrings } from "../../../constants/AppStrings";
import CloseButton from "../../buttons/CloseButton";
import { COLORS } from "../../../styles";

/**
 * Props for the SettingsModal component.
 * @property {boolean} isVisible - Controls the visibility of the settings modal.
 * @property {() => void} onClose - Function to call when the modal is closed.
 * @property {boolean} isSoundEnabled - State of sound setting.
 * @property {(isEnabled: boolean) => void} onToggleSound - Callback to toggle sound.
 * @property {boolean} isHapticsEnabled - State of haptics setting.
 * @property {(isEnabled: boolean) => void} onToggleHaptics - Callback to toggle haptics.
 * @property {() => void} onPressHelp - Callback for the Help button.
 * @property {() => void} onPressLogout - Callback for the Logout button.
 * @property {() => void} onPressCredits - Callback for the Credits button.
 */
interface SettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  isSoundEnabled: boolean;
  onToggleSound: (isEnabled: boolean) => void;
  isHapticsEnabled: boolean;
  onToggleHaptics: (isEnabled: boolean) => void;
  onPressHelp: () => void;
  onPressLogout: () => void;
  onPressCredits: () => void;
}

/**
 * Modal component for displaying game settings.
 */
const SettingsModal: React.FC<SettingsModalProps> = ({
  isVisible,
  onClose,
  isSoundEnabled,
  onToggleSound,
  isHapticsEnabled,
  onToggleHaptics,
  onPressHelp,
  onPressLogout,
  onPressCredits,
}) => {
  // Function to reset welcome panel
  const resetWelcomePanel = async () => {
    try {
      await AsyncStorage.removeItem("hasSeenWelcome");
      await AsyncStorage.removeItem("hasSeenInstructions");
      Alert.alert(
        "Reset Complete",
        "Welcome panel has been reset. Close settings and restart the game to see it again.",
        [{ text: "OK", onPress: onClose }]
      );
    } catch (error) {
      console.error("Error resetting welcome panel:", error);
      Alert.alert("Error", "Could not reset welcome panel. Please try again.");
    }
  };

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
              trackColor={{ false: COLORS.gray500, true: COLORS.info }}
              thumbColor={isSoundEnabled ? COLORS.warning : COLORS.gray200}
              ios_backgroundColor={COLORS.gray700}
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
              trackColor={{ false: COLORS.gray500, true: COLORS.info }}
              thumbColor={isHapticsEnabled ? COLORS.warning : COLORS.gray200}
              ios_backgroundColor={COLORS.gray700}
              onValueChange={onToggleHaptics}
              value={isHapticsEnabled}
            />
          </View>

          {/* Help Button */}
          <TouchableOpacity
            className="bg-gray-200 px-4 py-3 rounded-md mb-3 w-full items-center flex-row justify-center"
            onPress={onPressHelp}
          >
            <Icon name="help-outline" size={20} color={COLORS.gray600} />
            <Text className="text-gray-800 font-semibold ml-2">
              {AppStrings.Settings.HELP_BUTTON}
            </Text>
          </TouchableOpacity>

          {/* Credits Button */}
          <TouchableOpacity
            className="bg-gray-200 px-4 py-3 rounded-md mb-3 w-full items-center flex-row justify-center"
            onPress={onPressCredits}
          >
            <Icon name="info-outline" size={20} color={COLORS.gray600} />
            <Text className="text-gray-800 font-semibold ml-2">
              {AppStrings.Settings.CREDITS_BUTTON}
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
            <Icon name="logout" size={20} color={COLORS.white} />
            <Text className="text-white font-semibold ml-2">
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
              <Icon name="bug-report" size={20} color={COLORS.white} />
              <Text className="text-white font-semibold ml-2">
                {AppStrings.Settings.TEST_CRASH_BUTTON}
              </Text>
            </TouchableOpacity>
          )}

          {/* Reset Welcome Panel Button - Development Only */}
          {__DEV__ && (
            <TouchableOpacity
              className="bg-blue-500 px-4 py-3 rounded-md mb-3 w-full items-center flex-row justify-center mt-3"
              onPress={() => {
                Alert.alert(
                  "Reset Welcome Panel",
                  "This will reset the welcome panel so it appears again on next game load. Continue?",
                  [
                    {
                      text: "Cancel",
                      style: "cancel",
                    },
                    {
                      text: "Reset",
                      style: "default",
                      onPress: resetWelcomePanel,
                    },
                  ]
                );
              }}
            >
              <Icon name="refresh" size={20} color={COLORS.white} />
              <Text className="text-white font-semibold ml-2">
                Reset Welcome Panel
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default SettingsModal;
