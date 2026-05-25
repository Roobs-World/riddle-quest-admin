/**
 * Form Component Styles
 * Input fields, form elements, and form-related styling
 */

import {StyleSheet, TextStyle, ViewStyle} from "react-native";
import {SPACING} from "../tokens/spacing";
import {verticalScale} from "../../utils/responsive";
import {BORDER_RADIUS} from "../tokens/borderRadius";
import {COLORS} from "../tokens/colors";
import {TYPOGRAPHY} from "../tokens/typography";

export const formStyles = StyleSheet.create({
  debugContainer: {
    backgroundColor: `${COLORS.white}E6`, // 90% opacity white
    borderRadius: BORDER_RADIUS.sm,
    bottom: verticalScale(100),
    padding: SPACING.md,
    position: "absolute",
    right: SPACING.sm,
  } as ViewStyle,

  debugTitle: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "600",
    marginBottom: SPACING.sm,
  } as TextStyle,

  errorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  } as ViewStyle,

  errorMessage: {
    fontFamily: TYPOGRAPHY.fontSecondary,
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
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "600",
    marginBottom: SPACING.sm,
  } as TextStyle,

  textInput: {
    fontFamily: TYPOGRAPHY.fontSecondary,
  } as TextStyle,
});
