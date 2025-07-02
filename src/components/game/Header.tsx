import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import CoinsDisplay from "./CoinsDisplay";
import HintIcon from "../icons/HintIcon";
import { AppStrings } from "../../constants/AppStrings";

/**
 * Props for the Header component.
 * @property {number} userCoins - The current user's coin balance.
 * @property {() => void} onHintPress - Function to call when the Hint button is pressed.
 * @property {() => void} onCoinsPress - Function to call when the coins are pressed (opens shop).
 */
interface HeaderProps {
  userCoins: number;
  onHintPress: () => void;
  onCoinsPress: () => void;
}

/**
 * The header component for the game screen.
 * Displays the hint button and coins in the top left corner.
 *
 * @param {HeaderProps} props - The props for the component.
 * @returns {React.FC<HeaderProps>} The rendered Header component.
 */
const Header: React.FC<HeaderProps> = ({
  userCoins,
  onHintPress,
  onCoinsPress,
}) => {
  return (
    <View
      className="w-full flex-row items-center justify-between p-4"
      testID="header"
      accessible={true}
      accessibilityRole="none"
      accessibilityLabel="Game header with hint button and coin balance"
    >
      {/* Left side: Hint button */}
      <View
        className="flex-row items-center space-x-3"
        testID="header-left-side"
      >
        <TouchableOpacity
          onPress={onHintPress}
          className="items-center p-2"
          testID="hint-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Get hint for current riddle"
        >
          <HintIcon width={24} height={24} color="#ffffff" />
          <Text className="text-xs mt-1 text-white">
            {AppStrings.Navigation.HINT_BUTTON}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Right side: Coins */}
      <View testID="header-right-side">
        <CoinsDisplay coins={userCoins} onPress={onCoinsPress} />
      </View>
    </View>
  );
};

export default Header;
