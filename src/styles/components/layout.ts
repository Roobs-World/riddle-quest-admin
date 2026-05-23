/**
 * Layout Component Styles
 * Container, positioning, and layout-related styles
 *
 * Device-tier styles follow a progressive enhancement pattern:
 *   base style            — phone (< 600 px)
 *   + gameContainerTablet — small tablet (600–767 px)
 *   + gameContainerLargeTablet — large tablet / iPad (768–1023 px)
 *   + gameContainerDesktop — desktop / wide viewport (≥ 1024 px)
 *
 * Apply them in JSX with the isTablet / isLargeTablet / isDesktop flags:
 *   style={[
 *     styles.gameContainer,
 *     isTablet      && styles.gameContainerTablet,
 *     isLargeTablet && styles.gameContainerLargeTablet,
 *     isDesktop     && styles.gameContainerDesktop,
 *   ]}
 */

import { StyleSheet, ViewStyle, ImageStyle } from "react-native";
import { SPACING } from "../tokens/spacing";
import { COLORS } from "../tokens/colors";
import { AUTH_CONTENT_MAX_WIDTH, MAX_CONTENT_WIDTH } from "../../constants/layout";

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

  /**
   * Constrains and centres content on large screens.
   * Used by screens that render a scrollable content column (e.g. auth screens).
   */
  centerContainerTablet: {
    alignSelf: "center",
    maxWidth: MAX_CONTENT_WIDTH,
    width: "100%",
  } as ViewStyle,

  authContentContainer: {
    alignSelf: "center",
    maxWidth: AUTH_CONTENT_MAX_WIDTH,
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

  // ── Game container — phone baseline ──────────────────────────────────────

  gameContainer: {
    flex: 1,
    height: "100%",
    minHeight: "100%",
    maxHeight: "100%",
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,


    /**
 * Desktop (≥ 1024 px): same centring approach with slightly more padding
 * for a comfortable click/keyboard target feel.
 */
  gameContainerDesktop: {
    paddingHorizontal: SPACING.xl,
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
    width: "100%",
  } as ViewStyle,

    /**
   * Large tablet / iPad (768–1023 px): caps and centres the game column so
   * it doesn't stretch uncomfortably across the full iPad width.
   */
  gameContainerLargeTablet: {
    paddingHorizontal: SPACING.lg,
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
    width: "100%",
  } as ViewStyle,




  /** Small tablet (600–767 px): adds a touch of horizontal breathing room. */
  gameContainerTablet: {
    paddingHorizontal: SPACING.md,
  } as ViewStyle,

  gameInput: {
    width: "100%",
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    flexShrink: 0,
  } as ViewStyle,

  // ── Riddle container ──────────────────────────────────────────────────────

  riddleContainer: {
    alignItems: "center",
    position: "relative",
    justifyContent: "center",
    minHeight: "20%",
  } as ViewStyle,

   /** Large tablet / desktop: more padding and a taller minimum slot. */
  riddleContainerLargeTablet: {
    paddingHorizontal: SPACING.lg,
    minHeight: "30%",
  } as ViewStyle,

  /** Small tablet: add horizontal padding so the riddle text has room. */
  riddleContainerTablet: {
    paddingHorizontal: SPACING.md,
    minHeight: "25%",
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

