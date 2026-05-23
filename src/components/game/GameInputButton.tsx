import React, { ReactElement } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { GAME_INPUT_BUTTON_HEIGHT } from "../../constants/layout";
import { SPACING, TYPOGRAPHY } from "../../styles";

/**
 * Props for a reusable circular action button in the game input row.
 */
type GameInputButtonProps = {
  /** Icon rendered on the left side of the label. */
  icon: ReactElement;
  /** Visible button label. */
  text: string;
  /** Handler invoked when the button is pressed. */
  callback: () => void;
};

/**
 * Small reusable button used by game input controls (e.g. hint/next).
 *
 * @param props Button content and press callback.
 * @returns Styled touchable action button.
 */
export const GameInputButton = React.forwardRef<View, GameInputButtonProps>(({
  text,
  icon,
  callback,
}, ref): ReactElement => {
  return (
    <TouchableOpacity
      ref={ref}
      className="rounded-full bg-key-bg flex-row items-center justify-center"
      style={{ height: GAME_INPUT_BUTTON_HEIGHT, paddingHorizontal: SPACING.md, gap: SPACING.sm }}
      onPress={callback}
    >
      {icon}
      <Text style={{ fontSize: TYPOGRAPHY.fontSize.lg, fontFamily: TYPOGRAPHY.fontPrimary, color: "black" }}>{text}</Text>
    </TouchableOpacity>
  );
});

GameInputButton.displayName = "GameInputButton";
