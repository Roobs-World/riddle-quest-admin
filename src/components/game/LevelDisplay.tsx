import React from "react";
import { View, Text } from "react-native";

/**
 * Props for the LevelDisplay component.
 * @property {number} level - The current game level to display.
 */
interface LevelDisplayProps {
  level: number;
}

/**
 * A component to display the current game level.
 *
 * @param {LevelDisplayProps} props - The props for the component.
 * @returns {React.FC<LevelDisplayProps>} The rendered LevelDisplay component.
 */
const LevelDisplay: React.FC<LevelDisplayProps> = ({ level }) => {
  return (
    <View className="flex-row items-center">
      {/* TODO: Add Level Icon if needed */}
      <Text className="text-lg font-bold text-gray-800">Level: {level}</Text>
    </View>
  );
};

export default LevelDisplay;
