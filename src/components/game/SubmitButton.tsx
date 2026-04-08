import { ReactElement } from "react";
import { Text, TouchableOpacity } from "react-native";
import { SPACING, TYPOGRAPHY } from "../../styles";
import { SUBMIT_BUTTON_PADDING_H } from "../../constants/layout";

type SubmitButtonProps = {
  isSubmitDisabled: boolean;
  gameOver: boolean;
  handleKeyPress: (key: string) => void;
};

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
