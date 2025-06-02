/**
 * Game Component Styles
 * Game-specific UI elements including tiles, keyboard, and game layout
 */

import { StyleSheet, ViewStyle } from "react-native";
import { SPACING } from "../tokens/spacing";
import { BORDER_RADIUS } from "../tokens/borderRadius";
import { COLORS } from "../tokens/colors";
import { SIZING } from "../tokens/sizing";
import { SHADOWS } from "../tokens/shadows";

export const gameStyles = StyleSheet.create({
  iconColor: {
    color: COLORS.activeTextColor,
  } as ViewStyle,

  iconSpacing: {
    marginRight: SPACING.sm,
  } as ViewStyle,

  keyboardContainer: {
    alignItems: "center",
    position: "relative",
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
