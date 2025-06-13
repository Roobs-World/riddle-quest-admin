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
    backgroundColor: COLORS.black,
    shadowColor: COLORS.black,
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
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
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.sm,
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

  particleAsteroid: {
    backgroundColor: COLORS.gray300,
    transform: [{ rotate: "45deg" }],
    shadowColor: COLORS.black,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
  } as ViewStyle,

  particleAsteroidContainer: {
    position: "absolute",
  } as ViewStyle,

  particleLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  } as ViewStyle,

  particleStar: {
    backgroundColor: COLORS.primaryOrange,
    borderRadius: 1000, // Large value to ensure circular
    shadowColor: COLORS.primaryOrange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    elevation: 10,
  } as ViewStyle,

  particleStarContainer: {
    position: "absolute",
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
