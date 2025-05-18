import React from "react";
import { View, Text } from "react-native";

interface LevelDisplayProps {
  level: number;
}

const LevelDisplay: React.FC<LevelDisplayProps> = ({ level }) => {
  return (
    <View className="flex-row items-center">
      {/* TODO: Add Level Icon if needed */}
      <Text className="text-lg font-bold text-gray-800">Level: {level}</Text>
    </View>
  );
};

export default LevelDisplay;
