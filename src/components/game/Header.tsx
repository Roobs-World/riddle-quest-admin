import React from "react";
import { View, Text } from "react-native";
import CoinsDisplay from "./CoinsDisplay";
import LevelDisplay from "./LevelDisplay";

/**
 * Props for the Header component.
 * @property {number} level - The current game level.
 * @property {number} [score] - The current player score (optional).
 * @property {number} userCoins - The current player coin balance.
 */
interface HeaderProps {
  level: number;
  score?: number;
  userCoins: number;
}

/**
 * The header component for the game screen.
 * Displays the current level and coins.
 *
 * @param {HeaderProps} props - The props for the component.
 * @returns {React.FC<HeaderProps>} The rendered Header component.
 */
const Header: React.FC<HeaderProps> = ({ level, score, userCoins }) => {
  return (
    <View className="w-full flex-row items-center justify-between p-4 bg-gray-200">
      {/* Level */}
      <LevelDisplay level={level} />

      {/* Score and Coins */}
      <View className="flex-row items-center">
        {/* Score (Optional for MVP) */}
        {score !== undefined && (
          <Text className="text-lg font-bold text-gray-800 mr-4">
            Score: {score}
          </Text>
        )}
        <CoinsDisplay coins={userCoins} />
      </View>
    </View>
  );
};

export default Header;
