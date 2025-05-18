import React from "react";
import { View, TouchableOpacity, Text } from "react-native";

interface BottomNavigationBarProps {
  onPlayPress: () => void;
  onProfilePress: () => void;
  onSettingsPress: () => void;
}

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
