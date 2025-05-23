import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { GameScreenOverlayState } from "../../types/OverlayTypes";

/**
 * Props for the BottomNavigationBar component.
 * @property {() => void} onHomePress - Function to call when the Home icon is pressed.
 * @property {() => void} onPlayPress - Function to call when the Play icon is pressed.
 * @property {() => void} onProfilePress - Function to call when the Profile icon is pressed.
 * @property {() => void} onSettingsPress - Function to call when the Settings icon is pressed.
 * @property {keyof GameScreenOverlayState | undefined} activeOverlay - The key of the currently active overlay, or undefined.
 */
interface BottomNavigationBarProps {
  onHomePress: () => void;
  onPlayPress: () => void;
  onProfilePress: () => void;
  onSettingsPress: () => void;
  activeOverlay: keyof GameScreenOverlayState | undefined;
}

/**
 * A navigation bar component displayed at the bottom of the screen.
 * It provides navigation links to different sections of the application.
 * @param {BottomNavigationBarProps} props - The props for the component.
 * @returns {React.FC<BottomNavigationBarProps>} The rendered BottomNavigationBar component.
 */
const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  onPlayPress,
  onProfilePress,
  onSettingsPress,
}) => {
  return (
    <View className="w-full flex-row justify-around items-center bg-gray-300 p-2">
      <TouchableOpacity onPress={onPlayPress} className="items-center">
        {/* Placeholder: Play Icon will go here */}
        <Text>Play</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onProfilePress} className="items-center">
        {/* Placeholder: Profile Icon will go here */}
        <Text>Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSettingsPress} className="items-center">
        {/* Placeholder: Settings Icon will go here */}
        <Text>Settings</Text>
      </TouchableOpacity>
    </View>
  );
};

export default BottomNavigationBar;
