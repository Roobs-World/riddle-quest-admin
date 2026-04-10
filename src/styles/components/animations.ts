/**
 * Animation Component Styles
 * Animation, loading, and special effect styling
 */

import { StyleSheet, ViewStyle, TextStyle } from "react-native";
import { SHADOWS } from "../tokens/shadows";
import { COLORS } from "../tokens/colors";
import { TYPOGRAPHY } from "../tokens/typography";
import { SIZING } from "../tokens/sizing";

export const animationStyles = StyleSheet.create({
  overlay: {
    backgroundColor: `${COLORS.black}80`, // 50% opacity black
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  } as ViewStyle,

  shatteringContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,

  shatteringTile: {
    width: SIZING.tile.size,
    height: SIZING.tile.size,
    borderWidth: SIZING.tile.border,
    alignItems: "center",
    justifyContent: "center",
    // Default borderColor will be applied in component if not specified by tile data
  } as ViewStyle,

  shatteringTileText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.tile,
    fontWeight: "400",
    // Default color will be applied in component if not specified by tile data
  } as TextStyle,

  shatteringTilesContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,

  spinnerContainer: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  } as ViewStyle,

  spinnerWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: `${COLORS.black}80`, // 50% opacity black
    flex: 1,
    justifyContent: "center",
  } as ViewStyle,

  teamMemberCard: {
    ...SHADOWS.md,
  } as ViewStyle,
});
