/**
 * Spacing Design Tokens
 * Consistent spacing values using responsive utilities
 */

import {responsiveSizes} from "../../utils/responsive";

export const SPACING = {
  xs: responsiveSizes.spacingXs,
  sm: responsiveSizes.spacingSm,
  md: responsiveSizes.spacingMd,
  lg: responsiveSizes.spacingLg,
  xl: responsiveSizes.spacingXl,
  "2xl": responsiveSizes.spacing2xl,
} as const;
