/**
 * Text Component Styles
 * Typography and text-related styling
 */

import {StyleSheet, TextStyle} from "react-native";
import {COLORS} from "../tokens/colors";
import {TYPOGRAPHY} from "../tokens/typography";

export const textStyles = StyleSheet.create({
  creditsLink: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
  } as TextStyle,

  creditsSubtitle: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
  } as TextStyle,

  creditsTitle: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    fontWeight: "400",
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
    lineHeight: TYPOGRAPHY.fontSize["2xl"] * TYPOGRAPHY.lineHeight.tight,
  } as TextStyle,

  errorText: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
  } as TextStyle,

  forgotPasswordText: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
  } as TextStyle,

  labelText: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "600",
  } as TextStyle,

  letterText: {
    color: COLORS.gray700,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.display,
    fontWeight: "400",
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
    lineHeight: TYPOGRAPHY.fontSize.display * TYPOGRAPHY.lineHeight.tight,
  } as TextStyle,

  memberName: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: "400",
  } as TextStyle,

  memberRole: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
  } as TextStyle,

  screenTitle: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    fontWeight: "400",
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
    lineHeight: TYPOGRAPHY.fontSize["2xl"] * TYPOGRAPHY.lineHeight.tight,
  } as TextStyle,

  separatorText: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
  } as TextStyle,

  subtitle: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
  } as TextStyle,

  thankYouText: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
  } as TextStyle,

  thankYouTitle: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: "400",
  } as TextStyle,

  tileText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    fontWeight: "400",
    textTransform: "uppercase",
  } as TextStyle,

  title: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    fontWeight: "400",
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
    lineHeight: TYPOGRAPHY.fontSize["2xl"] * TYPOGRAPHY.lineHeight.tight,
  } as TextStyle,
});
