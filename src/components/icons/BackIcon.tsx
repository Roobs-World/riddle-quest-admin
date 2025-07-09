/**
 * @fileoverview BackIcon component - Simple text-based back navigation icon.
 *
 * This component renders a minimalist back arrow icon using text characters.
 * It provides a lightweight alternative to SVG icons for back navigation,
 * maintaining consistent styling with the app's typography system.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { Text } from "react-native";

/**
 * BackIcon Component
 *
 * A simple, text-based back arrow icon that displays a left-pointing
 * angle bracket ("<") with consistent typography styling. This component
 * is designed to be lightweight and easily customizable through NativeWind
 * class names.
 *
 * Features:
 * - Lightweight text-based implementation
 * - Consistent typography using Poppins font
 * - Responsive sizing and color
 * - NativeWind styling integration
 *
 * Design Considerations:
 * - Uses text characters instead of SVG for minimal bundle size
 * - Styled with gray color for subtle visual hierarchy
 * - Large text size (5xl) for touch accessibility
 * - Light font weight for modern appearance
 *
 * Usage:
 * ```tsx
 * <BackIcon />
 * ```
 *
 * @returns {JSX.Element} Text-based back arrow icon
 */
const BackIcon = () => (
  <Text className="text-gray-700 text-5xl font-poppins-light">{"<"}</Text>
);

export default BackIcon;
