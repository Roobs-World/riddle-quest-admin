/**
 * Button Style Utility Function
 * Creates button styles with consistent theming
 */

import { ViewStyle, TextStyle } from "react-native";
import { COLORS } from "../tokens/colors";
import { TYPOGRAPHY } from "../tokens/typography";
import { SPACING } from "../tokens/spacing";
import { BORDER_RADIUS } from "../tokens/borderRadius";
import { SIZING } from "../tokens/sizing";
import { SHADOWS } from "../tokens/shadows";

export const createButtonStyle = (
  backgroundColor: string = COLORS.primaryOrange,
  textColor: string = COLORS.white,
  variant: "solid" | "outline" | "ghost" = "solid"
) => {
  const baseButton: ViewStyle = {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    minHeight: SIZING.button.height,
  };

  const baseText: TextStyle = {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "400",
  };

  switch (variant) {
    case "outline":
      return {
        button: {
          ...baseButton,
          backgroundColor: COLORS.transparent,
          borderWidth: 2,
          borderColor: backgroundColor,
        },
        text: {
          ...baseText,
          color: backgroundColor,
        },
      };
    case "ghost":
      return {
        button: {
          ...baseButton,
          backgroundColor: COLORS.transparent,
        },
        text: {
          ...baseText,
          color: backgroundColor,
        },
      };
    default:
      return {
        button: {
          ...baseButton,
          backgroundColor,
          ...SHADOWS.sm,
        },
        text: {
          ...baseText,
          color: textColor,
        },
      };
  }
};
