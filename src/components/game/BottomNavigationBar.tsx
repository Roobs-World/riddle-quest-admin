import React from "react";
import { View, TouchableOpacity, Text } from "react-native";

/**
 * Props for the BottomNavigationBar component.
 * @property {() => void} onPlayPress - Function to call when the Play icon is pressed.
 * @property {() => void} onProfilePress - Function to call when the Profile icon is pressed.
 * @property {() => void} onSettingsPress - Function to call when the Settings icon is pressed.
 */
interface BottomNavigationBarProps {
  onPlayPress: () => void;
  onProfilePress: () => void;
  onSettingsPress: () => void;
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
        {/* TODO: Replace with Play Icon */}
        <Text>Play</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onProfilePress} className="items-center">
        {/* TODO: Replace with Profile Icon */}
        <Text>Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSettingsPress} className="items-center">
        {/* TODO: Replace with Settings Icon */}
        <Text>Settings</Text>
      </TouchableOpacity>
    </View>
  );
};

export default BottomNavigationBar;
