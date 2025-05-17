import React from "react";
import { View, Text } from "react-native";

const GameScreen = () => {
  return (
    <View className="flex-1 items-center justify-center bg-cream-light">
      <Text className="text-2xl font-bold text-gray-800 mb-4">Game Screen</Text>
      {/* Placeholder for Header */}
      <View className="w-full h-16 bg-gray-200 items-center justify-center">
        <Text>Header Placeholder (Level, Score, Coins, Hint, Skip)</Text>
      </View>
      {/* Placeholder for Riddle Text */}
      <View className="w-full p-4 items-center justify-center">
        <Text className="text-lg text-gray-700">Riddle Text Placeholder</Text>
      </View>
      {/* Placeholder for Guess Grid (6x5) */}
      <View className="w-full flex-grow items-center justify-center">
        <Text>Guess Grid Placeholder (6x5)</Text>
      </View>
      {/* Placeholder for On-screen Keyboard */}
      <View className="w-full h-32 bg-gray-300 items-center justify-center">
        <Text>Keyboard Placeholder</Text>
      </View>
    </View>
  );
};

export default GameScreen;
