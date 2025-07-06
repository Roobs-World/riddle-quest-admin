import React from "react";
import { View, TouchableOpacity } from "react-native";
import ProfileIcon from "../../../assets/images/profile-icon.svg";
import SettingsIcon from "../../../assets/images/settings-icon.svg";
import LetsPlayIcon from "../../../assets/images/lets-play.svg";

export type OverlayType = "profile" | "settings";

/**
 * Props for the BottomNavigationBar component.
 * @property {() => void} onProfilePress - Function to call when the Profile icon is pressed.
 * @property {() => void} onSettingsPress - Function to call when the Settings icon is pressed.
 * @property {() => void} onSubmitPress - Function to call when the Submit button is pressed.
 * @property {string[]} currentGuess - Current guess array to determine submit button state.
 * @property {number} answerLength - Expected answer length to validate submit button.
 * @property {boolean} gameOver - Whether the game is over to disable submit button.
 */
interface BottomNavigationBarProps {
  onProfilePress: () => void;
  onSettingsPress: () => void;
}

/**
 * A navigation bar component displayed at the bottom of the screen.
 * It provides navigation links to profile and settings sections, plus a submit button for gameplay.
 * @param {BottomNavigationBarProps} props - The props for the component.
 * @returns {React.FC<BottomNavigationBarProps>} The rendered BottomNavigationBar component.
 */
const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  onProfilePress,
  onSettingsPress,
}) => {
  return (
    <View
      className="flex-row justify-between items-center bg-white left-0 right-0 px-4 w-full"
      style={{
        height: "8%",
        minHeight: "8%",
        maxHeight: "8%",
      }}
    >
      <TouchableOpacity
        onPress={() => onProfilePress()}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
      >
        <ProfileIcon />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {}}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
      >
        <LetsPlayIcon />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onSettingsPress()}
        testID="settings-button"
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
      >
        <SettingsIcon />
      </TouchableOpacity>
    </View>
  );
};

export default BottomNavigationBar;
