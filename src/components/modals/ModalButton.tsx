/**
 * @fileoverview ModalButton component - Standardized button for modal interactions.
 *
 * This component provides a consistent button design for use within modal dialogs
 * throughout the Qwordly application. It handles different visual states (enabled/disabled)
 * and maintains consistent styling, typography, and accessibility features across
 * all modal interfaces.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import { Text, TouchableOpacity } from "react-native";
import { TYPOGRAPHY } from "src/styles";

/**
 * Props interface for the ModalButton component.
 *
 * @property {string} text - Button label text to display
 * @property {() => void} callback - Function to execute when button is pressed
 * @property {boolean} isDisabled - Whether the button should be disabled
 */
type ModalButtonProps = {
  /** The text content to display on the button */
  text: string;

  /** Function called when the button is pressed (if not disabled) */
  callback: () => void;

  /** Whether the button is disabled and non-interactive */
  isDisabled: boolean;
};

/**
 * ModalButton Component
 *
 * A standardized button component designed specifically for use within modal
 * dialogs. Provides consistent visual styling, typography, and interaction
 * behavior across all modal interfaces in the application.
 *
 * Visual Design:
 * - Rounded button with consistent padding
 * - Orange background when enabled, gray when disabled
 * - Fixed height for uniform appearance
 * - Horizontal margin for spacing between multiple buttons
 * - Black text with primary typography font
 *
 * States:
 * - Enabled: Orange background, touchable, executes callback
 * - Disabled: Gray background, non-touchable, no interaction
 *
 * Features:
 * - Automatic state-based styling
 * - Consistent typography using app font system
 * - Proper touch target sizing (48pt height)
 * - Accessibility support with disabled state handling
 * - Responsive text centering and sizing
 *
 * Accessibility:
 * - Respects disabled state for screen readers
 * - Proper touch target size for accessibility guidelines
 * - Clear visual distinction between enabled/disabled states
 * - Readable text contrast in both states
 *
 * Usage Examples:
 * ```tsx
 * // Enabled button for primary actions
 * <ModalButton
 *   text="Continue"
 *   callback={handleContinue}
 *   isDisabled={false}
 * />
 *
 * // Disabled button when conditions not met
 * <ModalButton
 *   text="Submit"
 *   callback={handleSubmit}
 *   isDisabled={!formValid}
 * />
 *
 * // In a button group within a modal
 * <View className="flex-row">
 *   <ModalButton text="Cancel" callback={handleCancel} isDisabled={false} />
 *   <ModalButton text="Confirm" callback={handleConfirm} isDisabled={loading} />
 * </View>
 * ```
 *
 * @param {ModalButtonProps} props - Component props
 * @returns {JSX.Element} Rendered modal button with appropriate styling and state
 */
export const ModalButton = ({
  text,
  callback,
  isDisabled,
}: ModalButtonProps): JSX.Element => {
  return (
    <TouchableOpacity
      disabled={isDisabled}
      className={`${
        isDisabled ? "bg-gray-400" : "bg-secondary-orange"
      } px-4 py-2 rounded-full h-12 mx-2 items-center justify-center`}
      onPress={callback}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: isDisabled }}
      accessibilityHint={
        isDisabled ? "Button is disabled" : `Tap to ${text.toLowerCase()}`
      }
    >
      <Text
        style={{
          fontFamily: TYPOGRAPHY.fontPrimary,
          color: "black",
          fontSize: 18,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
};
