import React from "react";
import { View, Text } from "react-native";

interface RiddleTextProps {
  riddle: string;
}

const RiddleText: React.FC<RiddleTextProps> = ({ riddle }) => {
  return (
    <View className="w-full p-4 items-center justify-center">
      <Text className="text-lg text-gray-700 text-center">{riddle}</Text>
    </View>
  );
};

export default RiddleText;
