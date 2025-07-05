import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { moderateScale } from "../../utils/responsive";
import { COLORS, TYPOGRAPHY } from "../../styles";

/**
 * Define the props for the RiddleText component.
 * @property {string} riddleText - The text of the riddle to display.
 */
type RiddleTextProps = {
  riddleText: string;
};

const styles = StyleSheet.create({
  riddleText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: moderateScale(24),
    lineHeight: moderateScale(32),
    maxWidth: moderateScale(300),
    textShadowColor: COLORS.textShadowDark,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

/**
 * The component that displays the riddle text for the Wordle-style game.
 *
 * @param {RiddleTextProps} props - The props for the component.
 * @returns {React.FC<RiddleTextProps>} The rendered RiddleText component.
 */
const RiddleText: React.FC<RiddleTextProps> = ({ riddleText }) => {
  return (
    <View className="px-6 items-center z-10">
      <Text
        className="text-center text-white text-2xl"
        style={styles.riddleText}
        numberOfLines={3}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {riddleText}
      </Text>
    </View>
  );
};

export default RiddleText;
