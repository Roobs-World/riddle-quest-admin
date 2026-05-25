/**
 * Responsive Padding Utility Function
 * Creates responsive padding based on device type
 */

import {SPACING} from "../tokens/spacing";

export const createResponsivePadding = (basePadding: number = SPACING.md) => ({
  paddingHorizontal: basePadding,
  paddingVertical: basePadding * 0.75,
});
