/**
 * Game Component Styles
 * Game-specific UI elements including tiles, keyboard, and game layout
 */

import { StyleSheet, ViewStyle, TextStyle } from "react-native";
import { SPACING } from "../tokens/spacing";
import { BORDER_RADIUS } from "../tokens/borderRadius";
import { COLORS } from "../tokens/colors";
import { SIZING } from "../tokens/sizing";
import { SHADOWS } from "../tokens/shadows";

export const gameStyles = StyleSheet.create({
  backspaceKey: {
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: COLORS.gray300,
    shadowColor: COLORS.black,
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  } as ViewStyle,

  keyText: {
    fontWeight: "bold",
    textTransform: "uppercase",
    color: COLORS.black,
  } as TextStyle,

  keyboardContainer: {
    alignItems: "center",
    position: "relative",
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

  pulseCircle: {
    backgroundColor: COLORS.primaryOrange,
    position: "absolute",
    ...SHADOWS.lg,
    shadowColor: COLORS.primaryOrange,
    shadowOpacity: 0.3,
    shadowRadius: SPACING.sm,
  } as ViewStyle,

  pulseContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
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
