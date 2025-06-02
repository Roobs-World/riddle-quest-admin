/**
 * Border Radius Design Tokens
 * Consistent border radius values using responsive utilities
 */

import { responsiveSizes } from "../../utils/responsive";

export const BORDER_RADIUS = {
  none: 0,
  sm: responsiveSizes.radiusSm,
  md: responsiveSizes.radiusMd,
  lg: responsiveSizes.radiusLg,
  xl: responsiveSizes.radiusXl,
  full: responsiveSizes.radiusFull,
} as const;
