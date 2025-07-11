import React from "react";
import { View, TouchableOpacity } from "react-native";
import CoinsDisplay from "./CoinsDisplay";
import LogoIcon from "../icons/LogoIcon";

/**
 * Props for the Header component.
 * @property {number} userCoins - The current user's coin balance.
 * @property {() => void} onCoinsPress - Function to call when the coins are pressed (opens shop).
 * @property {() => void} onHintPress - Function to call when the hint button is pressed.
 */
interface HeaderProps {
  userCoins: number;
  onCoinsPress: () => void;
  onHintPress?: () => void;
}

/**
 * The header component for the game screen.
 * Displays the logo icon in the top left and coins in the top right corner.
 *
 * @param {HeaderProps} props - The props for the component.
 * @returns {React.FC<HeaderProps>} The rendered Header component.
 */
const Header: React.FC<HeaderProps> = ({
  userCoins,
  onCoinsPress,
  onHintPress,
}) => {
  return (
    <View
      className="w-full flex-row items-center justify-between px-4 relative"
      style={{
        minHeight: "8%",
        maxHeight: "8%",
        height: "8%",
      }}
      testID="header"
      accessible={true}
      accessibilityRole="none"
      accessibilityLabel="Game header with logo and coin balance"
    >
      {/* Logo Icon in top-left corner - positioned absolutely like CloseButton */}
      <View className="absolute top-4 left-4 z-10">
        <TouchableOpacity
          className="items-center"
          testID="logo-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="logo"
          onPress={onHintPress}
        >
          <LogoIcon width={48} height={48} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Right side: Coins */}
      <View className="absolute top-4 right-4 z-10" testID="header-right-side">
        <CoinsDisplay coins={userCoins} onPress={onCoinsPress} />
      </View>
    </View>
  );
};

export default React.memo(Header);
