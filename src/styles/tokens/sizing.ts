/**
 * Sizing Design Tokens
 * Component sizing standards for buttons, inputs, tiles, and icons
 */

import { scale, verticalScale, responsiveSizes } from "../../utils/responsive";

export const SIZING = {
  button: {
    height: responsiveSizes.buttonHeight,
    minWidth: scale(120),
  },
  input: {
    height: responsiveSizes.inputHeight,
    minHeight: verticalScale(44),
  },
  tile: {
    size: scale(56),
    border: scale(1),
  },
  icon: {
    xs: scale(16),
    sm: scale(20),
    md: scale(24),
    lg: scale(32),
    xl: scale(40),
  },
} as const;
