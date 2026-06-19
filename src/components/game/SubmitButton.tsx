import React, {ReactElement} from "react";
import {Text, TouchableOpacity, View} from "react-native";
import {SPACING, TYPOGRAPHY} from "../../styles";
import {SUBMIT_BUTTON_PADDING_H} from "../../constants/layout";
import {t} from "../../i18n";

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
export const SubmitButton = React.forwardRef<View, SubmitButtonProps>(
  ({isSubmitDisabled, gameOver, handleKeyPress}, ref): ReactElement => {
    return (
      <TouchableOpacity
        ref={ref}
        className={`rounded-full ${isSubmitDisabled || gameOver ? "bg-gray-300" : "bg-primary-orange"}`}
        style={{
          paddingHorizontal: SUBMIT_BUTTON_PADDING_H,
          paddingVertical: SPACING.md,
          flex: 1.15,
          minWidth: 0,
          alignItems: "center",
          marginBottom: SPACING.sm,
        }}
        onPress={() => {
          if (!isSubmitDisabled && !gameOver) {
            handleKeyPress("ENTER");
          }
        }}
        disabled={isSubmitDisabled || gameOver}
        testID="submit-button"
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={t("Accessibility.SUBMIT_GUESS")}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={{
            fontSize: TYPOGRAPHY.fontSize.lg,
            fontFamily: TYPOGRAPHY.fontPrimary,
            color: "black",
          }}
        >
          {t("GameScreenAlerts.SUBMIT_BUTTON")}
        </Text>
      </TouchableOpacity>
    );
  },
);

SubmitButton.displayName = "SubmitButton";
