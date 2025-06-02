/**
 * Button Component Styles
 * All button-related styling including back buttons, close buttons, etc.
 */

import { StyleSheet, ViewStyle, TextStyle } from "react-native";
import { SPACING } from "../tokens/spacing";
import { BORDER_RADIUS } from "../tokens/borderRadius";
import { COLORS } from "../tokens/colors";
import { TYPOGRAPHY } from "../tokens/typography";

export const buttonStyles = StyleSheet.create({
  backButton: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 10,
  } as ViewStyle,

  buttonOpacity: {
    width: "100%",
  } as ViewStyle,

  buttonText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: "400",
    textAlign: "center",
  } as TextStyle,

  closeButtonContainer: {
    alignSelf: "flex-end",
    marginBottom: SPACING.sm,
    marginRight: SPACING.sm,
  } as ViewStyle,

  debugButton: {
    alignItems: "center",
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  } as ViewStyle,

  debugButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "bold",
    textAlign: "center",
  } as TextStyle,

  riddleRegenerationButton: {
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  } as ViewStyle,

  riddleRegenerationButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "bold",
  } as TextStyle,

  signUpButtonText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "400",
  } as TextStyle,

  socialButtonText: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.base,
  } as TextStyle,
});
