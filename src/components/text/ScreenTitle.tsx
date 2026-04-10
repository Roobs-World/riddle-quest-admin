/**
 * @fileoverview ScreenTitle component for consistent page headings in Qwordly.
 *
 * This component provides standardized title text styling across all screens
 * in the application. It ensures consistent typography, spacing, and visual
 * hierarchy for screen headers and main page titles.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { Text } from "react-native";
import { styles, SPACING } from "../../styles";

/**
 * Props interface for the ScreenTitle component.
 *
 * @property {string} title - The text content to display as the screen title
 * @property {string} [className] - Optional NativeWind class names for custom styling
 */
interface ScreenTitleProps {
  /** The title text to display */
  title: string;

  /** Optional additional NativeWind classes for custom styling */
  className?: string;
}

/**
 * ScreenTitle Component
 *
 * A standardized title component that provides consistent typography and
 * styling for screen headers throughout the Qwordly application. This
 * component ensures visual hierarchy and maintains the app's design language.
 *
 * Default Styling:
 * - Typography: Large, bold text (3xl font size)
 * - Color: Dark gray (#374151)
 * - Alignment: Center-aligned
 * - Spacing: Bottom margin for proper content separation
 * - Font weight: Bold for emphasis and hierarchy
 *
 * Features:
 * - Consistent typography across all screens
 * - Extensible styling through className prop
 * - Integration with app's style system
 * - Responsive text sizing
 * - Proper accessibility semantics
 *
 * Usage Examples:
 * ```tsx
 * // Basic screen title
 * <ScreenTitle title="Welcome to Qwordly" />
 *
 * // With custom styling
 * <ScreenTitle
 *   title="Game Over"
 *   className="text-red-500 text-4xl"
 * />
 *
 * // Dynamic title from props
 * <ScreenTitle title={`Level ${currentLevel}`} />
 * ```
 *
 * @param {ScreenTitleProps} props - Component props
 * @returns {JSX.Element} Rendered title text with consistent styling
 */
const ScreenTitle = ({ title, className }: ScreenTitleProps) => (
  <Text
    className={`text-center font-bold text-white ${className || ""}`}
    style={[styles.screenTitle, { marginBottom: SPACING.sm }]}
    accessibilityRole="header"
  >
    {title}
  </Text>
);

export default ScreenTitle;

