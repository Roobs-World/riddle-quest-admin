/**
 * @fileoverview ProgressBar component for visual progress indication in Qwordly.
 *
 * This component renders a horizontal progress bar using individual step indicators.
 * It supports custom colors for each step and provides visual feedback for
 * multi-step processes like tutorials, game levels, or form completion.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { View } from "react-native";
import { SPACING } from "../../styles";
import { scale, verticalScale } from "../../utils/responsive";

/**
 * Props interface for the ProgressBar component.
 *
 * @property {number} activeStep - Current active step (1-based index)
 * @property {number} totalSteps - Total number of steps in the progress
 * @property {string[]} [stepColors] - Optional array of custom colors for each step
 */
interface ProgressBarProps {
  /** Current active step (1-based indexing) */
  activeStep: number;

  /** Total number of steps in the progress sequence */
  totalSteps: number;

  /**
   * Optional array of custom NativeWind color classes for each step.
   * If provided, should contain a class for each step. If not provided,
   * uses default orange for active/completed and gray for inactive steps.
   */
  stepColors?: string[];
}

/**
 * ProgressBar Component
 *
 * A visual progress indicator that displays a series of step markers to show
 * completion progress through a multi-step process. Each step is represented
 * by a rounded rectangle that changes color based on completion status.
 *
 * Visual Design:
 * - Individual step indicators (rounded rectangles)
 * - Horizontal layout with consistent spacing
 * - Color-coded progress indication
 * - Responsive sizing and spacing
 *
 * Default Color Scheme:
 * - Active/Completed steps: Primary orange color
 * - Inactive steps: Light gray color
 * - Custom colors: Can be overridden via stepColors prop
 *
 * Features:
 * - Dynamic step generation based on totalSteps
 * - Custom color support for advanced use cases
 * - Responsive layout and spacing
 * - Clean, minimal visual design
 * - Progress indication for accessibility
 *
 * Usage Examples:
 * ```tsx
 * // Basic progress bar with default colors
 * <ProgressBar activeStep={3} totalSteps={5} />
 *
 * // With custom colors for each step
 * <ProgressBar
 *   activeStep={2}
 *   totalSteps={4}
 *   stepColors={["bg-green-500", "bg-blue-500", "bg-red-500", "bg-purple-500"]}
 * />
 *
 * // Tutorial progress indication
 * <ProgressBar activeStep={currentTutorialStep} totalSteps={tutorialSteps.length} />
 * ```
 *
 * @param {ProgressBarProps} props - Component props
 * @returns {JSX.Element} Rendered progress bar with step indicators
 */
const ProgressBar = ({
  activeStep,
  totalSteps,
  stepColors,
}: ProgressBarProps) => (
  <View className="flex-row items-center mx-auto" style={{ marginBottom: SPACING.xl }}>
    {Array.from({ length: totalSteps }).map((_, index) => (
      <View
        key={index}
        className={`rounded-full ${
          stepColors && stepColors[index]
            ? stepColors[index]
            : index <= activeStep - 1
            ? "bg-primary-orange"
            : "bg-gray-300"
        }`}
        style={{ height: verticalScale(8), width: scale(64), marginHorizontal: SPACING.sm }}
        accessibilityLabel={`Step ${index + 1} of ${totalSteps}${
          index <= activeStep - 1 ? " completed" : " pending"
        }`}
      />
    ))}
  </View>
);

export default ProgressBar;
