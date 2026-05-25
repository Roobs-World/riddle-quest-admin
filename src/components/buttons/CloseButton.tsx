/**
 * @fileoverview CloseButton component for dismissing modals and overlays in Riddle Quest.
 *
 * This component provides a standardized close button with customizable sizing
 * and styling. It uses the CloseIcon component and follows accessibility best
 * practices for dismissive actions.
 *
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import {TouchableOpacity, TouchableOpacityProps} from "react-native";
import CloseIcon from "../icons/CloseIcon";
import CloseIconWhite from "../icons/CloseIconWhite";
import {SPACING} from "../../styles";
import {CLOSE_BUTTON_SIZE_LG} from "../../constants/layout";
import {AppStrings} from "../../constants/AppStrings";

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
 * @property {"black" | "white"} [color] - Close icon color variant
 */
interface CloseButtonProps extends TouchableOpacityProps {
  /** Callback function called when the close button is pressed */
  onPress: () => void;

  /** Size of the close icon in pixels (default: 24) */
  size?: number;

  /** Optional NativeWind class names for custom styling */
  className?: string;

  /** Close icon color variant */
  color?: "black" | "white";
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
  size = CLOSE_BUTTON_SIZE_LG,
  className = "",
  color = "black",
  style,
  ...props
}: CloseButtonProps) => {
  const IconComponent = color === "white" ? CloseIconWhite : CloseIcon;

  return (
    <TouchableOpacity
      onPress={onPress}
      className={className}
      style={[
        {
          padding: SPACING.sm,
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
      hitSlop={{top: 8, right: 8, bottom: 8, left: 8}}
      accessibilityLabel={AppStrings.CommonAlerts.CLOSE_BUTTON}
      accessibilityRole="button"
      {...props}
    >
      <IconComponent width={size} height={size} />
    </TouchableOpacity>
  );
};

export default CloseButton;
