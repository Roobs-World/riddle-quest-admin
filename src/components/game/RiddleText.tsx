import React from "react";
import { Text, View } from "react-native";
import { moderateScale } from "../../utils/responsive";

/**
 * Define the props for the RiddleText component.
 * @property {string} riddleText - The text of the riddle to display.
 */
type RiddleTextProps = {
  riddleText: string;
};

/**
 * The component that displays the riddle text for the Wordle-style game.
 *
 * @param {RiddleTextProps} props - The props for the component.
 * @returns {React.FC<RiddleTextProps>} The rendered RiddleText component.
 */
const RiddleText: React.FC<RiddleTextProps> = ({ riddleText }) => {
  return (
    <View className="px-4 py-2 mb-2 items-center z-10">
      <Text
        className="text-center text-gray-800 font-semibold"
        style={{
          fontSize: moderateScale(16),
          lineHeight: moderateScale(24),
        }}
      >
        {riddleText}
      </Text>
    </View>
  );
};

export default RiddleText;
