/**
 * Animation Component Styles
 * Animation, loading, and special effect styling
 */

import { StyleSheet, ViewStyle } from "react-native";
import { SHADOWS } from "../tokens/shadows";
import { COLORS } from "../tokens/colors";

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
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,

  shatteringTile: {
    width: 56, // TILE_SIZE
    height: 56, // TILE_SIZE
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    // Default borderColor will be applied in component if not specified by tile data
  } as ViewStyle,

  shatteringTileText: {
    fontSize: 28, // TILE_SIZE / 2
    fontWeight: "bold",
    // Default color will be applied in component if not specified by tile data
  } as ViewStyle,

  shatteringTilesContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,

  spinnerContainer: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  } as ViewStyle,

  spinnerWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: `${COLORS.black}80`, // 50% opacity black
    flex: 1,
    justifyContent: "center",
  } as ViewStyle,

  teamMemberCard: {
    ...SHADOWS.md,
  } as ViewStyle,
});
