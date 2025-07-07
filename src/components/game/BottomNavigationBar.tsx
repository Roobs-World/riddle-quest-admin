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
 * @property {() => void} onHintPress - Function to call when the Hint button is pressed.
 * @property {() => void} onSkipPress - Function to call when the Skip button is pressed.
 */
interface BottomNavigationBarProps {
  onProfilePress: () => void;
  onSettingsPress: () => void;
  onHintPress: () => void;
}

/**
 * A navigation bar component displayed at the bottom of the screen.
 * It provides navigation links to profile and settings sections, plus a hint button for gameplay.
 * @param {BottomNavigationBarProps} props - The props for the component.
 * @returns {React.FC<BottomNavigationBarProps>} The rendered BottomNavigationBar component.
 */
const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  onProfilePress,
  onSettingsPress,
  onHintPress,
}) => {
  return (
    <View
      className="flex-row justify-between items-center bg-white px-4 w-full"
      style={{
        height: "10%",
        minHeight: "10%",
        maxHeight: "10%",
      }}
    >
      <TouchableOpacity
        className="ml-10"
        onPress={() => onProfilePress()}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
      >
        <ProfileIcon />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onHintPress()}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Show hint"
      >
        <LetsPlayIcon />
      </TouchableOpacity>

      <TouchableOpacity
        className="mr-10"
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
