/**
 * @fileoverview ReusableTextInput component for consistent text input styling in Qwordly.
 *
 * This component provides a standardized text input wrapper that applies the
 * app's consistent styling while maintaining full TextInput API compatibility.
 * It serves as the foundation for all text input fields throughout the application.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { TextInput, TextInputProps } from "react-native";
import { styles } from "../../styles";

/**
 * Props interface for the ReusableTextInput component.
 *
 * Extends React Native's TextInputProps to include all standard TextInput
 * functionality while adding optional className styling support.
 *
 * @extends TextInputProps
 * @property {string} [className] - Optional NativeWind class names for additional styling
 */
interface ReusableTextInputProps extends TextInputProps {
  /**
   * Optional NativeWind class names to apply additional styling.
   * These classes will be combined with the default input styling.
   */
  className?: string;
}

/**
 * ReusableTextInput Component
 *
 * A foundational text input component that provides consistent styling and
 * behavior across all text input fields in the Qwordly application. This
 * component wraps React Native's TextInput with standardized styling while
 * maintaining full API compatibility.
 *
 * Features:
 * - Consistent styling across all app text inputs
 * - Full TextInput API compatibility and prop forwarding
 * - Extensible styling through className prop
 * - Integration with app's design system
 * - NativeWind styling support
 * - Maintains focus, selection, and keyboard behavior
 *
 * Default Styling:
 * - Applied through styles.input from the app's style system
 * - Consistent padding, borders, and typography
 * - Platform-appropriate keyboard and interaction behavior
 * - Proper focus states and accessibility
 *
 * Usage Examples:
 * ```tsx
 * // Basic text input with default styling
 * <ReusableTextInput
 *   placeholder="Enter your name"
 *   value={name}
 *   onChangeText={setName}
 * />
 *
 * // Password input with custom styling
 * <ReusableTextInput
 *   placeholder="Password"
 *   secureTextEntry
 *   className="border-red-500"
 *   value={password}
 *   onChangeText={setPassword}
 * />
 *
 * // Email input with keyboard type
 * <ReusableTextInput
 *   placeholder="Email address"
 *   keyboardType="email-address"
 *   autoCapitalize="none"
 *   value={email}
 *   onChangeText={setEmail}
 * />
 *
 * // Multiline text input
 * <ReusableTextInput
 *   placeholder="Enter your message"
 *   multiline
 *   numberOfLines={4}
 *   className="h-24"
 *   value={message}
 *   onChangeText={setMessage}
 * />
 * ```
 *
 * @param {ReusableTextInputProps} props - Component props including all TextInput props
 * @returns {JSX.Element} Rendered text input with consistent styling
 */
const ReusableTextInput: React.FC<ReusableTextInputProps> = ({
  className,
  ...props
}) => {
  return <TextInput style={styles.input} className={className} {...props} />;
};

export default ReusableTextInput;

