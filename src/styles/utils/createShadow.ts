/**
 * Shadow Utility Function
 * Creates a shadow style object with customizable parameters
 */

import { COLORS } from "../tokens/colors";
import { moderateScale } from "../../utils/responsive";

export const createShadow = (
  elevation: number = 5,
  shadowOpacity: number = 0.25,
  shadowRadius: number = moderateScale(4),
  shadowColor: string = COLORS.shadowColor
) => ({
  shadowColor,
  shadowOffset: { width: 0, height: elevation / 2 },
  shadowOpacity,
  shadowRadius,
  elevation,
});
