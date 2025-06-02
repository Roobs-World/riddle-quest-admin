/**
 * Qwordly Styles (Legacy Compatibility)
 *
 * This file maintains backward compatibility with existing imports while
 * using the new modular design system architecture.
 *
 * The actual implementation is now split across:
 * - src/styles/tokens/ (design tokens)
 * - src/styles/components/ (component styles)
 * - src/styles/utils/ (utility functions)
 *
 * For new development, prefer importing directly from the modular system:
 * - import { COLORS, TYPOGRAPHY } from "../styles"
 * - import { layoutStyles, buttonStyles } from "../styles"
 * - import { createButtonStyle } from "../styles"
 */

// Re-export everything from the modular design system
export * from "./index";

// Ensure specific exports are available for backward compatibility
export { styles, COLORS } from "./index";
