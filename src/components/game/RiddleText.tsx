import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { RIDDLE_TEXT_MAX_WIDTH } from "../../constants/layout";
import { TYPOGRAPHY, SPACING } from "../../styles";

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
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    lineHeight: TYPOGRAPHY.fontSize["2xl"] * TYPOGRAPHY.lineHeight.normal,
    maxWidth: RIDDLE_TEXT_MAX_WIDTH,
    color: "#1A1A1A",
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
    <View className="items-center z-10" style={{ paddingHorizontal: SPACING.lg }}>
      <Text
        className="text-center text-black"
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
