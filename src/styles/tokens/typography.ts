/**
 * Typography Design Tokens
 * Font families, sizes, and text styling for the Qwordly app
 */

import { responsiveSizes } from "../../utils/responsive";

export const TYPOGRAPHY = {
  // Font families
  fontPrimary: "PoetsenOne",
  fontSecondary: "Poppins",
  fontSecondaryBold: "PoppinsSemiBold",

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
  },
} as const;
