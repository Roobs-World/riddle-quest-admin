/**
 * Game Component Styles
 * Game-specific UI elements including tiles, keyboard, and game layout
 */

import {StyleSheet, ViewStyle, TextStyle} from "react-native";
import {SPACING} from "../tokens/spacing";
import {BORDER_RADIUS} from "../tokens/borderRadius";
import {COLORS} from "../tokens/colors";
import {SIZING} from "../tokens/sizing";
import {TYPOGRAPHY} from "../tokens/typography";

export const gameStyles = StyleSheet.create({
  backspaceKey: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.tileDefault,
    borderRadius: BORDER_RADIUS.sm,
  } as ViewStyle,

  iconColor: {
    color: COLORS.activeTextColor,
  } as ViewStyle,

  iconSpacing: {
    marginRight: SPACING.sm,
  } as ViewStyle,

  keyButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.transparent,
  } as ViewStyle,

  keyText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontWeight: "400",
    textTransform: "uppercase",
    color: COLORS.white,
  } as TextStyle,

  keyboardContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "100%",
    backgroundColor: COLORS.transparent,
  } as ViewStyle,

  keyboardLayer: {
    zIndex: 1,
    width: "100%",
    alignItems: "center",
  } as ViewStyle,

  keyboardRow: {
    flexDirection: "row",
    justifyContent: "center",
  } as ViewStyle,

  letterView: {
    position: "absolute",
  } as ViewStyle,

  logo: {
    marginBottom: SPACING.md,
  } as ViewStyle,

  tileView: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: SIZING.tile.size,
    height: SIZING.tile.size,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: SIZING.tile.border,
  } as ViewStyle,
});
