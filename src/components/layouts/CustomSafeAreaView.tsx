/**
 * @fileoverview CustomSafeAreaView component for consistent layout structure.
 *
 * This component provides a standardized SafeAreaView wrapper with predefined
 * styling that ensures consistent layout behavior across different screens
 * and device types. It handles safe area insets while maintaining the app's
 * visual design language.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { SafeAreaView, ViewProps } from "react-native";

/**
 * Props interface for the CustomSafeAreaView component.
 *
 * Extends React Native's ViewProps to include children and optional
 * className styling while maintaining compatibility with all standard
 * View properties.
 *
 * @extends ViewProps
 * @property {React.ReactNode} children - Content to be rendered within the safe area
 * @property {string} [className] - Optional NativeWind class names for additional styling
 */
interface CustomSafeAreaViewProps extends ViewProps {
  /** The content to be rendered within the safe area view */
  children: React.ReactNode;

  /**
   * Optional NativeWind class names to apply additional styling.
   * These classes will be combined with the default styling.
   */
  className?: string;
}

/**
 * CustomSafeAreaView Component
 *
 * A standardized SafeAreaView wrapper that provides consistent layout
 * structure across the Qwordly app. This component ensures proper safe
 * area handling while applying the app's design system styling.
 *
 * Default Styling:
 * - Background: Cream/off-white color (#FCFAF4)
 * - Layout: Full flex with centered content
 * - Padding: 6 units (24px) on all sides
 * - Content alignment: Center both horizontally and vertically
 *
 * Features:
 * - Safe area inset handling for all device types
 * - Consistent background color matching app theme
 * - Flexible content alignment and spacing
 * - Extensible styling through className prop
 * - Full ViewProps compatibility for advanced use cases
 *
 * Usage Examples:
 * ```tsx
 * // Basic usage with default styling
 * <CustomSafeAreaView>
 *   <Text>Your content here</Text>
 * </CustomSafeAreaView>
 *
 * // With additional custom styling
 * <CustomSafeAreaView className="bg-blue-500 p-2">
 *   <Text>Custom styled content</Text>
 * </CustomSafeAreaView>
 *
 * // With style prop for complex styling
 * <CustomSafeAreaView style={{ backgroundColor: 'red' }}>
 *   <Text>Content with style prop</Text>
 * </CustomSafeAreaView>
 * ```
 *
 * @param {CustomSafeAreaViewProps} props - Component props
 * @returns {JSX.Element} Rendered SafeAreaView with consistent styling
 */
const CustomSafeAreaView: React.FC<CustomSafeAreaViewProps> = ({
  children,
  style,
  className,
  ...rest
}) => {
  /**
   * Combines default styling classes with optional custom className.
   * The default classes provide the app's standard safe area appearance,
   * while custom classes can override or extend this styling.
   */
  const combinedClassName = `bg-[#FCFAF4] flex-1 justify-center items-center p-6 ${
    className || ""
  }`;

  return (
    <SafeAreaView className={combinedClassName} style={style} {...rest}>
      {children}
    </SafeAreaView>
  );
};

export default CustomSafeAreaView;
