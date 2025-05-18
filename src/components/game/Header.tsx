import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import CoinsDisplay from "./CoinsDisplay";
import LevelDisplay from "./LevelDisplay";

interface HeaderProps {
  level: number;
  score: number; // Assuming score will be displayed in the header eventually
  coins: number;
  onHintPress: () => void;
  onSkipPress: () => void;
}

const Header: React.FC<HeaderProps> = ({
  level,
  score,
  coins,
  onHintPress,
  onSkipPress,
}) => {
  return (
    <View className="w-full flex-row items-center justify-between p-4 bg-gray-200">
      {/* Level */}
      <LevelDisplay level={level} />

      {/* Score and Coins */}
      <View className="flex-row items-center">
        {/* Score (Optional for MVP) */}
        {/* <Text className="text-lg font-bold text-gray-800 mr-4">Score: {score}</Text> */}
        <CoinsDisplay coins={coins} />
      </View>

      {/* Hint and Skip Buttons */}
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={onHintPress}
          className="mr-4 p-2 bg-blue-500 rounded"
        >
          <Text className="text-white font-bold">Hint</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSkipPress}
          className="p-2 bg-red-500 rounded"
        >
          <Text className="text-white font-bold">Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Header;
