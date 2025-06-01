import React from "react";
import { View, TouchableOpacity, Text } from "react-native";

interface ControlsProps {
  onHintPress: () => void;
  onSubmitPress: () => void;
  onNextPress: () => void;
  currentGuess: string[];
  gameOver: boolean;
  isWin: boolean;
  answerLength: number;
}

const Controls: React.FC<ControlsProps> = ({
  onHintPress,
  onSubmitPress,
  onNextPress,
  currentGuess,
  gameOver,
  isWin,
  answerLength,
}) => {
  const isSubmitDisabled = currentGuess.length !== answerLength;
  const isNextVisible = isWin;

  return (
    <View className="flex-row justify-around w-full mt-4">
      {/* Hint Button */}
      <TouchableOpacity
        className="p-2 bg-yellow-500 rounded mr-2"
        onPress={onHintPress}
        disabled={gameOver}
      >
        <Text className="text-white">Hint</Text>
      </TouchableOpacity>

      {/* Submit Button */}
      <TouchableOpacity
        className="p-2 bg-blue-500 rounded"
        onPress={onSubmitPress}
        disabled={isSubmitDisabled || gameOver}
      >
        <Text className="text-white">Submit</Text>
      </TouchableOpacity>

      {/* Next Button (initially hidden or disabled until win) */}
      {isNextVisible && (
        <TouchableOpacity
          className="p-2 bg-green-500 rounded ml-2"
          onPress={onNextPress}
        >
          <Text className="text-white">Next</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default Controls;
