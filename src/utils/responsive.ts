/**
 * @fileoverview Responsive Utilities
 *
 * A comprehensive set of utilities for responsive design in React Native,
 * providing consistent scaling across different device sizes and orientations.
 * This module handles device type detection, responsive scaling, and provides
 * standardized dimensions for UI components.
 *
 * **Key Features:**
 * - Device type detection (phone, tablet, large tablet)
 * - Responsive scaling functions for different dimensions
 * - Device-specific value selection
 * - Standardized responsive sizes for typography and spacing
 * - Orientation change handling
 *
 * **Usage Patterns:**
 * - Import specific scaling functions for component dimensions
 * - Use responsiveValue for device-specific customization
 * - Access standardized sizes from responsiveSizes
 * - Register orientation change listeners when needed
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import { Dimensions } from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Device breakpoints
const TABLET_MIN_WIDTH = 600; // Common tablet minimum width in portrait
const LARGE_TABLET_MIN_WIDTH = 768; // iPad size in portrait

/**
 * Flag indicating if the current device is a tablet (width >= 600px)
 */
export const isTablet = screenWidth >= TABLET_MIN_WIDTH;

/**
 * Flag indicating if the current device is a large tablet (width >= 768px)
 */
export const isLargeTablet = screenWidth >= LARGE_TABLET_MIN_WIDTH;

/**
 * Flag indicating if the current device is a phone (width < 600px)
 */
export const isPhone = screenWidth < TABLET_MIN_WIDTH;

/**
 * Returns the current device type based on screen width.
 *
 * @returns {"phone" | "tablet" | "largeTablet"} The detected device type
 */
export const getDeviceType = (): "phone" | "tablet" | "largeTablet" => {
  if (isLargeTablet) return "largeTablet";
  if (isTablet) return "tablet";
  return "phone";
};

/**
 * Scales a size value proportionally based on screen width.
 * Uses iPhone 14 (390px) as the base width for scaling calculations.
 * Limits maximum scaling for tablets to prevent oversized elements.
 *
 * @param {number} size - The base size to scale
 * @returns {number} The scaled size value, rounded to nearest integer
 */
export const scale = (size: number): number => {
  // Base scale on iPhone 14 width (390px)
  const baseWidth = 390;
  const scaleFactor = screenWidth / baseWidth;

  // Limit scaling for tablets to prevent elements from becoming too large
  const maxScaleFactor = isTablet ? 1.5 : scaleFactor;
  const appliedScaleFactor = Math.min(scaleFactor, maxScaleFactor);

  return Math.round(size * appliedScaleFactor);
};

/**
 * Scales a size value proportionally based on screen height.
 * Uses iPhone 14 (844px) as the base height for scaling calculations.
 * Particularly useful for vertical dimensions like heights and margins.
 *
 * @param {number} size - The base size to scale
 * @returns {number} The vertically scaled size value, rounded to nearest integer
 */
export const verticalScale = (size: number): number => {
  // Base scale on iPhone 14 height (844px)
  const baseHeight = 844;
  const scaleFactor = screenHeight / baseHeight;

  // Limit scaling for tablets
  const maxScaleFactor = isTablet ? 1.5 : scaleFactor;
  const appliedScaleFactor = Math.min(scaleFactor, maxScaleFactor);

  return Math.round(size * appliedScaleFactor);
};

/**
 * Applies moderate scaling to a size value with a customizable factor.
 * Useful for elements that should scale but not as dramatically as with direct scaling.
 * Commonly used for typography, border radius, and other subtle dimensions.
 *
 * @param {number} size - The base size to scale
 * @param {number} [factor=0.5] - The scaling factor (0-1), where 0 means no scaling
 *                               and 1 means full scaling
 * @returns {number} The moderately scaled size value
 */
export const moderateScale = (size: number, factor = 0.5): number => {
  return size + (scale(size) - size) * factor;
};

/**
 * Returns a value based on the current device type.
 * Allows for device-specific customization with fallbacks.
 *
 * @template T - The type of value being returned
 * @param {Object} values - Object containing values for different device types
 * @param {T} values.phone - Value for phone devices (required)
 * @param {T} [values.tablet] - Value for tablet devices (optional)
 * @param {T} [values.largeTablet] - Value for large tablet devices (optional)
 * @returns {T} The appropriate value for the current device type
 *
 * @example
 * ```ts
 * const padding = responsiveValue({
 *   phone: 16,
 *   tablet: 24,
 *   largeTablet: 32
 * });
 * ```
 */
export const responsiveValue = <T>(values: {
  phone: T;
  tablet?: T;
  largeTablet?: T;
}): T => {
  const deviceType = getDeviceType();

  if (deviceType === "largeTablet" && values.largeTablet !== undefined) {
    return values.largeTablet;
  }
  if (deviceType === "tablet" && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.phone;
};

/**
 * Object containing current screen dimensions and device type flags.
 * Useful for component calculations and conditional rendering.
 */
export const dimensions = {
  screenWidth,
  screenHeight,
  isTablet,
  isLargeTablet,
  isPhone,
};

/**
 * Standardized responsive sizes for consistent UI elements.
 * Includes typography, spacing, component dimensions, and border radius values.
 * All values are automatically scaled based on device size.
 */
export const responsiveSizes = {
  // Font sizes
  textXs: moderateScale(12),
  textSm: moderateScale(14),
  textBase: moderateScale(16),
  textLg: moderateScale(18),
  textXl: moderateScale(20),
  text2xl: moderateScale(24),
  text3xl: moderateScale(30),
  text4xl: moderateScale(36),

  // Spacing
  spacingXs: scale(4),
  spacingSm: scale(8),
  spacingMd: scale(16),
  spacingLg: scale(24),
  spacingXl: scale(32),
  spacing2xl: scale(48),

  // Common component sizes
  buttonHeight: verticalScale(48),
  inputHeight: verticalScale(48),
  headerHeight: verticalScale(60),
  tabBarHeight: verticalScale(60),

  // Border radius
  radiusSm: moderateScale(4),
  radiusMd: moderateScale(8),
  radiusLg: moderateScale(12),
  radiusXl: moderateScale(16),
  radiusFull: 9999,
};

/**
 * Sets up a listener for orientation changes and returns a cleanup function.
 * Useful for components that need to respond to device rotation.
 *
 * @param {() => void} callback - Function to call when orientation changes
 * @returns {() => void} Cleanup function to remove the listener
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const cleanup = addOrientationChangeListener(() => {
 *     // Handle orientation change
 *     updateLayout();
 *   });
 *   return cleanup;
 * }, []);
 * ```
 */
export const addOrientationChangeListener = (callback: () => void) => {
  const subscription = Dimensions.addEventListener("change", callback);
  return () => subscription?.remove();
};
