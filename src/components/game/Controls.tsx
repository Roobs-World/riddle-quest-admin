import React from "react";
import { View, TouchableOpacity, Text } from "react-native";

interface ControlsProps {
  onNextPress: () => void;
  isWin: boolean;
}

const Controls: React.FC<ControlsProps> = ({ onNextPress, isWin }) => {
  const isNextVisible = isWin;

  return (
    <View className="flex-row justify-center w-full mt-4">
      {/* Next Button (only visible after win) */}
      {isNextVisible && (
        <TouchableOpacity
          className="p-3 bg-green-500 rounded-lg"
          onPress={onNextPress}
        >
          <Text className="text-white font-bold">Next Level</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default Controls;
