/**
 * @fileoverview Error component for displaying error messages in Riddle Quest.
 *
 * This component provides a standardized way to display error messages with
 * consistent styling and accessibility features. It's designed to be used
 * throughout the app for form validation errors, API errors, and general
 * error messaging.
 *
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import {Text} from "react-native";
import {styles, SPACING} from "../../styles";

/**
 * Props interface for the Error component.
 *
 * @property {string} message - The error message text to display
 */
interface ErrorProps {
  /** The error message text to display to the user */
  message: string;
}

/**
 * Error Component
 *
 * A standardized error message component that displays text in a consistent
 * error styling with proper accessibility attributes. The component is designed
 * to draw attention to error states while maintaining readability.
 *
 * Features:
 * - Consistent red error color matching app theme
 * - Center-aligned text for prominent display
 * - Proper accessibility role for screen readers
 * - Integration with app's typography system
 * - Consistent spacing and margin
 *
 * Styling:
 * - Color: Red (#EF4444) for error indication
 * - Alignment: Center-aligned for prominence
 * - Spacing: Bottom margin for content separation
 * - Typography: Inherits from app's style system
 *
 * Accessibility:
 * - Uses "alert" role to announce errors to screen readers
 * - Error messages are automatically announced when displayed
 * - High contrast red color for visual accessibility
 *
 * Usage Examples:
 * ```tsx
 * // Form validation error
 * <Error message="Please enter a valid email address" />
 *
 * // API error message
 * <Error message="Unable to connect to server. Please try again." />
 *
 * // Conditional error display
 * {errorMessage && <Error message={errorMessage} />}
 *
 * // Dynamic error from state
 * <Error message={`Password must be at least ${minLength} characters`} />
 * ```
 *
 * @param {ErrorProps} props - Component props
 * @returns {JSX.Element} Rendered error message text
 */
const Error = ({message}: ErrorProps) => (
  <Text
    className="text-red-500 text-center"
    style={[styles.errorText, {marginBottom: SPACING.md}]}
    accessibilityRole="alert"
  >
    {message}
  </Text>
);

export default Error;
