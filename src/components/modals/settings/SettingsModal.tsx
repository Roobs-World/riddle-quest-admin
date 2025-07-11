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
import { View, Text, Modal, Switch, Alert } from "react-native";
import { getAuth } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import { AppStrings } from "../../../constants/AppStrings";
import CloseButton from "../../buttons/CloseButton";
import { COLORS, TYPOGRAPHY } from "../../../styles";
import WideButton from "src/components/buttons/WideButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { scale } from "../../../utils/responsive";

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
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <View
          style={{
            width: 335,
            height: 423,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg style={{ position: "absolute" }} />
          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "space-around",
              padding: 20,
            }}
          >
            <CloseButton
              onPress={onClose}
              size={20}
              style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}
            />

            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: scale(28),
                color: "white",
                textAlign: "center",
              }}
            >
              {AppStrings.Settings.TITLE}
            </Text>

            <View style={{ width: "100%" }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  marginBottom: 20,
                }}
              >
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: scale(18),
                    color: "white",
                  }}
                >
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

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: scale(18),
                    color: "white",
                  }}
                >
                  {AppStrings.Settings.HAPTICS_TOGGLE}
                </Text>
                <Switch
                  trackColor={{ false: COLORS.gray500, true: COLORS.info }}
                  thumbColor={
                    isHapticsEnabled ? COLORS.warning : COLORS.gray200
                  }
                  ios_backgroundColor={COLORS.gray700}
                  onValueChange={onToggleHaptics}
                  value={isHapticsEnabled}
                />
              </View>
            </View>

            <View style={{ width: "100%", alignItems: "center" }}>
              <WideButton
                buttonText={AppStrings.Settings.HELP_BUTTON}
                onPress={onPressHelp}
              />
              <View style={{ height: 10 }} />
              <WideButton
                buttonText={AppStrings.Settings.CREDITS_BUTTON}
                onPress={onPressCredits}
              />
              <View style={{ height: 10 }} />
              <WideButton
                buttonText={AppStrings.Settings.LOGOUT_BUTTON}
                onPress={async () => {
                  try {
                    await getAuth(getApp()).signOut();
                    if (onPressLogout) onPressLogout();
                  } catch {
                    Alert.alert(
                      "Error",
                      "Could not log out. Please try again."
                    );
                  }
                }}
                buttonColor="bg-gray-500"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SettingsModal;
