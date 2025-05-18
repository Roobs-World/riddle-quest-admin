import React from "react";
import { View, Text } from "react-native";

interface CoinsDisplayProps {
  coins: number;
}

const CoinsDisplay: React.FC<CoinsDisplayProps> = ({ coins }) => {
  return (
    <View className="flex-row items-center">
      {/* TODO: Add Coin Icon */}
      <Text className="text-lg font-bold text-gray-800">{coins}</Text>
    </View>
  );
};

export default CoinsDisplay;
