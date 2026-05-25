/**
 * Riddle Quest Design System
 * Modular styles architecture for the React Native app
 *
 * This is the main entry point for all styles, design tokens, and utilities.
 * Import patterns:
 * - import { styles, COLORS } from "../styles" (for backward compatibility)
 * - import { TYPOGRAPHY, SPACING } from "../styles" (for specific tokens)
 * - import { createButtonStyle } from "../styles" (for utilities)
 */

// =============================================================================
// DESIGN TOKENS
// =============================================================================
export {COLORS} from "./tokens/colors";
export {TYPOGRAPHY} from "./tokens/typography";
export {SPACING} from "./tokens/spacing";
export {SIZING} from "./tokens/sizing";
export {BORDER_RADIUS} from "./tokens/borderRadius";
export {SHADOWS} from "./tokens/shadows";

// =============================================================================
// COMPONENT STYLES
// =============================================================================
export {styles} from "./components";
export {
  layoutStyles,
  buttonStyles,
  textStyles,
  modalStyles,
  gameStyles,
  formStyles,
  animationStyles,
} from "./components";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
export {createShadow} from "./utils/createShadow";
export {createButtonStyle} from "./utils/createButtonStyle";
export {createResponsivePadding} from "./utils/createResponsivePadding";

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================
// Maintain backward compatibility with existing imports
export * from "./components";
export * from "./tokens/colors";
