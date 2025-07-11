/**
 * Layout Component Styles
 * Container, positioning, and layout-related styles
 */

import { StyleSheet, ViewStyle, ImageStyle } from "react-native";
import { scale } from "../../utils/responsive";
import { SPACING } from "../tokens/spacing";
import { COLORS } from "../tokens/colors";

export const layoutStyles = StyleSheet.create({
  activityIndicator: {
    position: "absolute",
  } as ViewStyle,

  backgroundImage: {
    position: "absolute",
    top: "-5%",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  } as ImageStyle,

  centerContainer: {
    justifyContent: "flex-start",
    marginTop: -SPACING.sm,
  } as ViewStyle,

  centerContainerTablet: {
    alignSelf: "center",
    marginHorizontal: SPACING.xl,
    maxWidth: scale(600),
    width: "100%",
  } as ViewStyle,

  centeredView: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  } as ViewStyle,

  fill: {
    flex: 1,
  } as ViewStyle,

  gameContainer: {
    flex: 1,
    height: "100%",
    minHeight: "100%",
    maxHeight: "100%",
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,

  gameContainerTablet: {
    paddingHorizontal: SPACING.md,
  } as ViewStyle,

  gameInput: {
    width: "100%",
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
  } as ViewStyle,

  questionsBackground: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: scale(343),
    height: scale(95),
    marginTop: scale(12),
    zIndex: 0,
  } as ViewStyle,

  riddleContainer: {
    alignItems: "center",
    position: "relative",
    justifyContent: "center",
    minHeight: "20%",
  } as ViewStyle,

  riddleContainerTablet: {
    paddingHorizontal: SPACING.md,
    minHeight: "30%",
  } as ViewStyle,

  scrollViewContent: {
    paddingBottom: SPACING.xl,
  } as ViewStyle,

  signUpBackgroundSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  } as ViewStyle,

  signUpContainer: {
    flex: 1,
  } as ViewStyle,

  signUpSafeArea: {
    backgroundColor: COLORS.transparent,
  } as ViewStyle,

  svgContainer: {
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,

  topLeft: {
    left: SPACING.sm,
  } as ViewStyle,

  topRight: {
    right: SPACING.sm,
  } as ViewStyle,
});
