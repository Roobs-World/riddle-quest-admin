import { ReactElement } from "react";
import { Text, TouchableOpacity } from "react-native";
import { SPACING, TYPOGRAPHY } from "../../styles";
import { SUBMIT_BUTTON_PADDING_H } from "../../constants/layout";

/**
 * Props for the primary guess-submit control.
 */
type SubmitButtonProps = {
  /** True when the current guess cannot be submitted yet. */
  isSubmitDisabled: boolean;
  /** True once the current riddle has ended. */
  gameOver: boolean;
  /** Keyboard-style callback invoked with `"ENTER"` when submitted. */
  handleKeyPress: (key: string) => void;
};

/**
 * Renders the submit button used to send the current guess.
 *
 * @param props Submit state flags and keyboard submit callback.
 * @returns Styled submit button with disabled-state handling.
 */
export const SubmitButton = ({
  isSubmitDisabled,
  gameOver,
  handleKeyPress,
}: SubmitButtonProps): ReactElement => {
  return (
    <TouchableOpacity
      className={`rounded-full ${
        isSubmitDisabled || gameOver
          ? "bg-secondary-orange"
          : "bg-primary-orange"
      }`}
      style={{ paddingHorizontal: SUBMIT_BUTTON_PADDING_H, paddingVertical: SPACING.md }}
      onPress={() => {
        if (!isSubmitDisabled && !gameOver) {
          handleKeyPress("ENTER");
        }
      }}
      disabled={isSubmitDisabled || gameOver}
      testID="submit-button"
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Submit current guess"
    >
      <Text style={{ fontSize: TYPOGRAPHY.fontSize.lg, fontFamily: TYPOGRAPHY.fontPrimary, color: "black" }}>SUBMIT</Text>
    </TouchableOpacity>
  );
};
