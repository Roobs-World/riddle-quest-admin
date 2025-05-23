import React from "react";
import { View, Text } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

/**
 * Props for the CoinsDisplay component.
 * @property {number} coins - The number of coins to display.
 */
interface CoinsDisplayProps {
  coins: number;
}

/**
 * A component to display the current player's coin balance.
 *
 * @param {CoinsDisplayProps} props - The props for the component.
 * @returns {React.FC<CoinsDisplayProps>} The rendered CoinsDisplay component.
 */
const CoinsDisplay: React.FC<CoinsDisplayProps> = ({ coins }) => {
  return (
    <View className="flex-row items-center">
      <Icon name="attach-money" size={24} color="#FDBA74" />
      <Text className="text-lg font-bold text-gray-800">{coins}</Text>
    </View>
  );
};

export default CoinsDisplay;
