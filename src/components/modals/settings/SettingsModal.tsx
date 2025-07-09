/**
 * @fileoverview SettingsModal component - Game settings and preferences modal for Qwordly.
 *
 * This modal provides access to game preferences including sound and haptics
 * toggles, help documentation, credits, and logout functionality. It serves
 * as the central hub for player preferences and account management within
 * the game.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { View, Text, Modal, SafeAreaView, Switch, Alert } from "react-native";
import { getAuth } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import { AppStrings } from "../../../constants/AppStrings";
import CloseButton from "../../buttons/CloseButton";
import { COLORS, TYPOGRAPHY } from "../../../styles";
import WideButton from "src/components/buttons/WideButton";

/**
 * Props interface for the SettingsModal component.
 *
 * @property {boolean} isVisible - Controls the visibility of the settings modal
 * @property {() => void} onClose - Function to call when the modal is closed
 * @property {boolean} isSoundEnabled - Current state of sound setting
 * @property {(isEnabled: boolean) => void} onToggleSound - Callback to toggle sound on/off
 * @property {boolean} isHapticsEnabled - Current state of haptics setting
 * @property {(isEnabled: boolean) => void} onToggleHaptics - Callback to toggle haptics on/off
 * @property {() => void} onPressHelp - Callback for the Help button press
 * @property {() => void} onPressLogout - Callback for the Logout button press
 * @property {() => void} onPressCredits - Callback for the Credits button press
 */
interface SettingsModalProps {
  /** Controls whether the modal is visible */
  isVisible: boolean;

  /** Function called when the modal should be closed */
  onClose: () => void;

  /** Current state of the sound setting (enabled/disabled) */
  isSoundEnabled: boolean;

  /** Function called when sound setting is toggled */
  onToggleSound: (isEnabled: boolean) => void;

  /** Current state of the haptics setting (enabled/disabled) */
  isHapticsEnabled: boolean;

  /** Function called when haptics setting is toggled */
  onToggleHaptics: (isEnabled: boolean) => void;

  /** Function called when Help button is pressed */
  onPressHelp: () => void;

  /** Function called when Logout button is pressed (additional callback) */
  onPressLogout: () => void;

  /** Function called when Credits button is pressed */
  onPressCredits: () => void;
}

/**
 * SettingsModal Component
 *
 * A comprehensive settings modal that provides access to game preferences,
 * help documentation, and account management. The modal uses a clean, organized
 * layout with toggle switches for preferences and buttons for navigation actions.
 *
 * Modal Content:
 * - Settings title header
 * - Sound toggle switch with visual feedback
 * - Haptics toggle switch with visual feedback
 * - Help button for accessing game instructions
 * - Credits button for viewing app credits
 * - Logout button with confirmation and error handling
 *
 * Visual Design:
 * - Fade animation for smooth appearance
 * - Semi-transparent background overlay
 * - White rounded modal with shadow
 * - Consistent typography and spacing
 * - Close button in top-right corner
 * - Color-coded toggle switches
 *
 * Features:
 * - Toggle switches with visual feedback colors
 * - Automatic Firebase authentication logout
 * - Error handling for logout failures
 * - Responsive layout for different screen sizes
 * - Accessible components with proper roles
 * - Integration with app string constants
 *
 * Toggle States:
 * - Sound: Controls game audio and sound effects
 * - Haptics: Controls vibration feedback for actions
 * - Visual feedback: Green when enabled, gray when disabled
 *
 * Account Management:
 * - Logout functionality with Firebase integration
 * - Error handling with user-friendly alerts
 * - Automatic navigation handling via auth context
 *
 * Usage Example:
 * ```tsx
 * <SettingsModal
 *   isVisible={showSettings}
 *   onClose={hideSettings}
 *   isSoundEnabled={soundEnabled}
 *   onToggleSound={setSoundEnabled}
 *   isHapticsEnabled={hapticsEnabled}
 *   onToggleHaptics={setHapticsEnabled}
 *   onPressHelp={showHelp}
 *   onPressLogout={handleLogout}
 *   onPressCredits={showCredits}
 * />
 * ```
 *
 * @param {SettingsModalProps} props - Component props
 * @returns {JSX.Element} Rendered settings modal with preferences and actions
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

          {/* Settings Title */}
          <Text
            className="text-2xl text-gray-800 mb-6 text-center"
            style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
          >
            {AppStrings.Settings.TITLE}
          </Text>

          {/* Sound Toggle Setting */}
          <View className="flex-row items-center justify-between w-full mb-4">
            <Text
              className="text-lg text-gray-800 flex-shrink-0"
              style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
            >
              {AppStrings.Settings.SOUND_TOGGLE}
            </Text>
            <View className="ml-auto">
              <Switch
                trackColor={{ false: COLORS.gray500, true: COLORS.info }}
                thumbColor={isSoundEnabled ? COLORS.warning : COLORS.gray200}
                ios_backgroundColor={COLORS.gray700}
                onValueChange={onToggleSound}
                value={isSoundEnabled}
                accessibilityLabel="Toggle sound effects"
                accessibilityHint="Enable or disable game sound effects and audio"
              />
            </View>
          </View>

          {/* Haptics Toggle Setting */}
          <View className="flex-row items-center justify-between w-full mb-6">
            <Text
              className="text-lg text-gray-800 flex-shrink-0"
              style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
            >
              {AppStrings.Settings.HAPTICS_TOGGLE}
            </Text>
            <View className="ml-auto">
              <Switch
                trackColor={{ false: COLORS.gray500, true: COLORS.info }}
                thumbColor={isHapticsEnabled ? COLORS.warning : COLORS.gray200}
                ios_backgroundColor={COLORS.gray700}
                onValueChange={onToggleHaptics}
                value={isHapticsEnabled}
                accessibilityLabel="Toggle haptic feedback"
                accessibilityHint="Enable or disable vibration feedback for game actions"
              />
            </View>
          </View>

          {/* Help Navigation Button */}
          <WideButton
            buttonText={AppStrings.Settings.HELP_BUTTON}
            onPress={onPressHelp}
          />

          {/* Credits Navigation Button */}
          <WideButton
            buttonText={AppStrings.Settings.CREDITS_BUTTON}
            onPress={onPressCredits}
          />

          {/* Logout Button with Firebase Integration */}
          <WideButton
            buttonText={AppStrings.Settings.LOGOUT_BUTTON}
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
            buttonColor="bg-gray-500"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default SettingsModal;
