import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import CoinsDisplay from "./CoinsDisplay";
import LevelDisplay from "./LevelDisplay";

/**
 * Props for the Header component.
 * @property {number} level - The current game level.
 * @property {number} score - The current player score (may be optional or TBD for display).
 * @property {number} coins - The current player coin balance.
 * @property {() => void} onHintPress - Function to call when the Hint button is pressed.
 * @property {() => void} onSkipPress - Function to call when the Skip button is pressed.
 */
interface HeaderProps {
  level: number;
  score: number; // Assuming score will be displayed in the header eventually
  coins: number;
  onHintPress: () => void;
  onSkipPress: () => void;
}

/**
 * The header component for the game screen.
 * Displays the current level, coins, and provides buttons for hints and skipping.
 *
 * @param {HeaderProps} props - The props for the component.
 * @returns {React.FC<HeaderProps>} The rendered Header component.
 */
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
