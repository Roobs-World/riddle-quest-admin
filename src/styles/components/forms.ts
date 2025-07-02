/**
 * Form Component Styles
 * Input fields, form elements, and form-related styling
 */

import { StyleSheet, TextStyle, ViewStyle } from "react-native";
import { SPACING } from "../tokens/spacing";
import { BORDER_RADIUS } from "../tokens/borderRadius";
import { COLORS } from "../tokens/colors";
import { TYPOGRAPHY } from "../tokens/typography";

export const formStyles = StyleSheet.create({
  debugContainer: {
    backgroundColor: `${COLORS.white}E6`, // 90% opacity white
    borderRadius: BORDER_RADIUS.sm,
    bottom: 100,
    padding: SPACING.md,
    position: "absolute",
    right: SPACING.sm,
  } as ViewStyle,

  debugTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "bold",
    marginBottom: SPACING.sm,
  } as TextStyle,

  errorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  } as ViewStyle,

  errorMessage: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.fontSize.base,
  } as TextStyle,

  input: {
    fontFamily: TYPOGRAPHY.fontSecondary,
  } as TextStyle,

  riddleRegenerationContainer: {
    backgroundColor: COLORS.gray100,
    borderRadius: BORDER_RADIUS.md,
    margin: SPACING.sm,
    padding: SPACING.md,
  } as ViewStyle,

  riddleRegenerationTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "bold",
    marginBottom: SPACING.sm,
  } as TextStyle,

  textInput: {
    fontFamily: TYPOGRAPHY.fontSecondary,
  } as TextStyle,
});
