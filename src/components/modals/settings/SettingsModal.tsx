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
import Icon from "react-native-vector-icons/MaterialIcons";
import { getAuth } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
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
                await getAuth(getApp()).signOut();
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
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default SettingsModal;
