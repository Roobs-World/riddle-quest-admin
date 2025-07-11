/**
 * @fileoverview CloseButton component for dismissing modals and overlays in Qwordly.
 *
 * This component provides a standardized close button with customizable sizing
 * and styling. It uses the CloseIcon component and follows accessibility best
 * practices for dismissive actions.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";
import CloseIcon from "../icons/CloseIcon";

/**
 * Props interface for the CloseButton component.
 *
 * Extends TouchableOpacityProps to maintain compatibility with all TouchableOpacity
 * properties while adding close button specific functionality.
 *
 * @extends TouchableOpacityProps
 * @property {() => void} onPress - Callback function executed when button is pressed
 * @property {number} [size] - Size of the close icon in pixels
 * @property {string} [className] - Optional NativeWind class names for additional styling
 * @property {string} [color] - Optional color for the close icon
 */
interface CloseButtonProps extends TouchableOpacityProps {
  /** Callback function called when the close button is pressed */
  onPress: () => void;

  /** Size of the close icon in pixels (default: 24) */
  size?: number;

  /** Optional NativeWind class names for custom styling */
  className?: string;

  /** Optional color for the close icon */
  color?: string;
}

/**
 * CloseButton Component
 *
 * A reusable close button component designed for dismissing modals, overlays,
 * and other dismissible UI elements. The button features consistent styling,
 * proper accessibility attributes, and customizable icon sizing.
 *
 * Features:
 * - Standardized close icon with SVG rendering
 * - Customizable icon size for different UI contexts
 * - Built-in accessibility support with proper labels and roles
 * - Consistent padding and touch target sizing
 * - Extensible styling through className prop
 * - Full TouchableOpacity API compatibility
 *
 * Accessibility:
 * - Includes "Close" accessibility label
 * - Proper button role for screen readers
 * - Adequate touch target size with padding
 * - Clear visual feedback on interaction
 *
 * Usage Examples:
 * ```tsx
 * // Basic close button
 * <CloseButton onPress={handleClose} />
 *
 * // Larger close button for prominent modals
 * <CloseButton onPress={handleClose} size={32} />
 *
 * // Close button with custom styling
 * <CloseButton
 *   onPress={handleClose}
 *   className="bg-red-100 rounded-full"
 * />
 *
 * // Close button with additional TouchableOpacity props
 * <CloseButton
 *   onPress={handleClose}
 *   disabled={isProcessing}
 *   activeOpacity={0.7}
 * />
 * ```
 *
 * @param {CloseButtonProps} props - Component props
 * @returns {JSX.Element} Rendered close button with icon
 */
const CloseButton = ({
  onPress,
  size = 24,
  className = "",
  color,
  ...props
}: CloseButtonProps) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`p-2 ${className}`}
      accessibilityLabel="Close"
      accessibilityRole="button"
      {...props}
    >
      <CloseIcon width={size} height={size} color={color} />
    </TouchableOpacity>
  );
};

export default CloseButton;
