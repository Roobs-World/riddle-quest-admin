/**
 * Typography Design Tokens
 * Font families, sizes, and text styling for the Riddle Quest app
 */

import { responsiveSizes, moderateScale } from "../../utils/responsive";

export const TYPOGRAPHY = {
  // Font families
  fontPrimary: "PoetsenOne",
  fontSecondary: "PoetsenOne",
  fontSecondaryBold: "PoetsenOne",

  // Font sizes (using responsive scaling)
  fontSize: {
    xs: responsiveSizes.textXs,
    sm: responsiveSizes.textSm,
    base: responsiveSizes.textBase,
    lg: responsiveSizes.textLg,
    xl: responsiveSizes.textXl,
    "2xl": responsiveSizes.text2xl,
    "3xl": responsiveSizes.text3xl,
    "4xl": responsiveSizes.text4xl,
    /** Modal / screen titles — 28 px at base. */
    title: responsiveSizes.textTitle,
    /** Hero / display text — 32 px at base. */
    display: responsiveSizes.textDisplay,
    /** Letter inside a game tile — 28 px at base. */
    tile: responsiveSizes.textTile,
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.104,
    normal: 0,
    wide: 0.025,
    /** Uppercase/caps tracking — 1pt at base, scales with device. */
    caps: moderateScale(1),
  },
} as const;
