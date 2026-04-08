/**
 * @fileoverview PulsingSpinner component - Advanced loading indicator with pulsing dot animation.
 *
 * This component provides a sophisticated loading spinner using SVG and React Native
 * animations. It features configurable pulsing dots arranged in a circle with
 * staggered animation timing for smooth visual feedback. The component is highly
 * optimized for performance with memoization and can be used as both an inline
 * component and a full-screen overlay.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React, { useState, useEffect, useMemo } from "react";
import { Animated, Easing, View, Modal } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { styles, COLORS } from "../../styles";

// Turn the SVG <Circle> into an Animated component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Props interface for the PulsingSpinner component.
 *
 * @property {number} [size] - Overall spinner diameter in pixels
 * @property {number} [dotCount] - Number of dots arranged in a circle
 * @property {number} [dotRadius] - Base radius of each individual dot
 * @property {number} [duration] - Total animation loop duration in milliseconds
 * @property {boolean} [visible] - Whether to show as a modal overlay
 * @property {number} [opacity] - Background opacity when used as overlay
 */
interface PulsingSpinnerProps {
  /** Overall spinner size (diameter) in pixels */
  size?: number;

  /** Number of dots arranged around the circular path */
  dotCount?: number;

  /** Base radius of each dot before animation scaling */
  dotRadius?: number;

  /** Total animation loop duration in milliseconds */
  duration?: number;

  /** Whether to render as a full-screen modal overlay */
  visible?: boolean;

  /** Background overlay opacity (0-1) when visible is true */
  opacity?: number;
}

/**
 * PulsingSpinner Component
 *
 * A highly customizable and performant loading spinner featuring animated dots
 * arranged in a circle. Each dot pulses in sequence with configurable timing
 * to create a smooth, engaging loading animation.
 *
 * Animation Design:
 * - Dots are arranged in a perfect circle
 * - Each dot pulses (shrinks and fades) in sequence
 * - Staggered timing creates a wave-like effect
 * - Continuous loop with customizable duration
 * - Smooth easing for natural motion
 *
 * Performance Optimizations:
 * - React.memo wrapper prevents unnecessary re-renders
 * - useMemo for expensive calculations (positions, interpolations)
 * - useRef for stable animated values across renders
 * - Native driver for 60fps animations
 * - Memoized interpolated values to prevent recreation
 *
 * Features:
 * - Dual rendering modes: inline component or modal overlay
 * - Fully configurable size, timing, and dot count
 * - Responsive design with automatic positioning
 * - Smooth 60fps animations using native driver
 * - Memory efficient with proper cleanup
 * - SVG-based for crisp rendering at any size
 *
 * Usage Examples:
 * ```tsx
 * // Basic inline spinner
 * <PulsingSpinner />
 *
 * // Custom sized spinner with more dots
 * <PulsingSpinner size={300} dotCount={12} duration={1500} />
 *
 * // Full-screen loading overlay
 * <PulsingSpinner visible={isLoading} opacity={0.8} />
 *
 * // Small compact spinner for buttons
 * <PulsingSpinner size={40} dotCount={6} dotRadius={3} duration={800} />
 * ```
 *
 * @param {PulsingSpinnerProps} props - Component configuration props
 * @returns {JSX.Element | null} Rendered spinner component or null when hidden
 */
const PulsingSpinner = React.memo(function PulsingSpinner({
  size = 200, // overall spinner size
  dotCount = 8, // number of dots around the ring
  dotRadius = 15, // base radius of each dot
  duration = 1000, // total loop time (ms)
  // Overlay defaults
  visible,
  opacity = 0.5,
}: PulsingSpinnerProps) {
  /**
   * Stable animated values that persist across renders.
   * Each dot has its own Animated.Value for independent animation control.
   * useState with lazy init so refs are not read during render (satisfies react-hooks/refs).
   */
  const [animValues] = useState(() =>
    Array.from({ length: dotCount }, () => new Animated.Value(0))
  );

  /**
   * Memoized geometric calculations for dot positioning.
   * Prevents recalculation on every render for better performance.
   *
   * Calculates:
   * - Center point of the spinner
   * - Ring radius (distance from center to dots)
   * - X,Y coordinates for each dot around the circle
   */
  const calculations = useMemo(() => {
    const center = size / 2;
    const ringRadius = center - dotRadius;

    // Pre-calculate all dot positions to avoid recalculation during render
    const dotPositions = Array.from({ length: dotCount }, (_, i) => {
      const angle = (2 * Math.PI * i) / dotCount - Math.PI / 2;
      return {
        cx: center + ringRadius * Math.cos(angle),
        cy: center + ringRadius * Math.sin(angle),
      };
    });

    return { center, ringRadius, dotPositions };
  }, [size, dotCount, dotRadius]);

  /**
   * Memoized interpolated animation values.
   * Creates smooth transitions between animation states without
   * recreating interpolation functions on every render.
   */
  const interpolatedValues = useMemo(() => {
    return animValues.map((val) => ({
      radius: val.interpolate({
        inputRange: [0, 1],
        outputRange: [dotRadius, dotRadius * 0.5],
      }),
      opacity: val.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.2],
      }),
    }));
  }, [animValues, dotRadius]);

  /**
   * Animation setup effect.
   * Creates a staggered animation sequence where each dot pulses
   * in turn, creating a wave-like visual effect around the circle.
   */
  useEffect(() => {
    // Only recreate animation if dependencies actually change
    const dotAnimationDuration = (duration * 2) / dotCount;
    const staggerDelay = duration / dotCount;

    /**
     * Individual dot pulse animation sequence.
     * Each dot: grows to full size → shrinks and fades → resets instantly
     */
    const pulseSequences = animValues.map((val) =>
      Animated.sequence([
        Animated.timing(val, {
          toValue: 1,
          duration: dotAnimationDuration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(val, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    /**
     * Calculate tail delay to ensure total loop duration matches
     * the requested duration parameter.
     */
    const totalPulseTime = staggerDelay * (dotCount - 1) + dotAnimationDuration;
    const tailDelay = Math.max(0, duration - totalPulseTime);

    /**
     * Main animation loop: stagger all dot pulses, then wait for tail delay
     * before repeating. This creates the continuous pulsing wave effect.
     */
    const loopAnimation = Animated.loop(
      Animated.sequence([
        Animated.stagger(staggerDelay, pulseSequences),
        Animated.delay(tailDelay),
      ])
    );

    loopAnimation.start();
    return () => loopAnimation.stop();
  }, [animValues, duration, dotCount]);

  /**
   * Memoized spinner content to prevent recreation unless dependencies change.
   * This optimization ensures the SVG and animated circles are only recreated
   * when necessary, improving performance significantly.
   */
  const spinnerContent = useMemo(
    () => (
      <View
        style={[
          styles.spinnerContainer,
          {
            width: size,
            height: size,
            minWidth: size,
            minHeight: size,
            maxWidth: size,
            maxHeight: size,
          },
        ]}
        accessibilityLabel="Loading"
        accessibilityRole="progressbar"
      >
        <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={[styles.svgContainer, { width: size, height: size }]}
        >
          {calculations.dotPositions.map((position, i) => (
            <AnimatedCircle
              key={i}
              cx={position.cx}
              cy={position.cy}
              r={interpolatedValues[i].radius}
              fill={COLORS.primaryOrangeLight}
              opacity={interpolatedValues[i].opacity}
            />
          ))}
        </Svg>
      </View>
    ),
    [size, calculations.dotPositions, interpolatedValues]
  );

  /**
   * Modal overlay rendering mode.
   * When visible prop is provided, renders the spinner as a full-screen
   * modal with semi-transparent background overlay.
   */
  if (visible !== undefined) {
    if (!visible) {
      return null;
    }

    return (
      <Modal
        transparent={true}
        visible={visible}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View
          style={[
            styles.spinnerWrapper,
            {
              backgroundColor: `rgba(0, 0, 0, ${opacity})`,
            },
          ]}
        >
          {spinnerContent}
        </View>
      </Modal>
    );
  }

  /**
   * Inline component rendering mode.
   * Returns the spinner content directly for embedding within other components.
   */
  return spinnerContent;
});

export default PulsingSpinner;
