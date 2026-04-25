/**
 * Shadow Design Tokens
 * Elevation and shadow definitions for the Riddle Quest app
 */

import { COLORS } from "./colors";
import { moderateScale } from "../../utils/responsive";

export const SHADOWS = {
  sm: {
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: moderateScale(1) },
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(2),
    elevation: moderateScale(1),
  },
  md: {
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(4),
    elevation: moderateScale(5),
  },
  lg: {
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: moderateScale(4) },
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(6),
    elevation: moderateScale(8),
  },
  xl: {
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: moderateScale(10) },
    shadowOpacity: 0.25,
    shadowRadius: moderateScale(15),
    elevation: moderateScale(15),
  },
} as const;
