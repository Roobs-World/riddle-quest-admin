/**
 * @fileoverview Responsive Utilities
 *
 * Scaling utilities for consistent layout across phone, tablet, and desktop.
 *
 * ## Scale caps by device tier
 * | Tier         | Width        | scale() cap | verticalScale() cap |
 * |--------------|--------------|-------------|---------------------|
 * | phone        | < 600 px     | none        | none                |
 * | tablet       | 600–767 px   | 1.3 ×       | 1.2 ×               |
 * | large tablet | 768–1023 px  | 1.5 ×       | 1.3 ×               |
 * | desktop      | ≥ 1024 px    | 1.6 ×       | 1.4 ×               |
 *
 * All caps are applied to the scale factor, not the output value, so the
 * relationship between scaled values is preserved at every tier.
 *
 * ## Functions
 * - `scale(n)`          — width-based scaling for layout dimensions
 * - `verticalScale(n)`  — height-based scaling for vertical dimensions
 * - `moderateScale(n)`  — blended scaling for typography / border-radius
 * - `clamp(v, min, max)`— generic numeric clamp helper
 * - `responsiveValue()`  — pick a value by device tier
 *
 * ## Usage
 * Import only what you need; tokens in `styles/tokens/` re-export the
 * pre-computed `responsiveSizes` values so most components never need to
 * call these functions directly.
 */

import { Dimensions } from "react-native";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Snapshot screen dimensions once at module load
// (safe: StyleSheet values are computed once; orientation is locked to portrait)
// ---------------------------------------------------------------------------

let _dims: { width: number; height: number } = { width: 390, height: 844 };
try {
  const _got = Dimensions.get("window");
  if (_got && typeof _got.width === "number") _dims = _got;
} catch {
  logger.error('dimensions not found');
}

const { width: screenWidth, height: screenHeight } = _dims;

// ---------------------------------------------------------------------------
// Reference device — iPhone 14
// ---------------------------------------------------------------------------

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

// ---------------------------------------------------------------------------
// Device-tier breakpoints
// ---------------------------------------------------------------------------

const TABLET_MIN_WIDTH = 600;
const LARGE_TABLET_MIN_WIDTH = 768;
const DESKTOP_MIN_WIDTH = 1024;

/**
 * True for any non-phone device (width ≥ 600 px).
 * Kept inclusive of largeTablet/desktop for backward compatibility.
 */
export const isTablet = screenWidth >= TABLET_MIN_WIDTH;

/** True for devices ≥ 768 px wide (iPads, large Android tablets, desktop). */
export const isLargeTablet = screenWidth >= LARGE_TABLET_MIN_WIDTH;

/** True for devices ≥ 1024 px wide (desktop browsers, large iPads). */
export const isDesktop = screenWidth >= DESKTOP_MIN_WIDTH;

/** True for phones (width < 600 px). */
export const isPhone = screenWidth < TABLET_MIN_WIDTH;

/** Returns a string identifier for the current device tier. */
export const getDeviceType = (): "phone" | "tablet" | "largeTablet" | "desktop" => {
  if (isDesktop) return "desktop";
  if (isLargeTablet) return "largeTablet";
  if (isTablet) return "tablet";
  return "phone";
};

// ---------------------------------------------------------------------------
// Tiered scale caps
// ---------------------------------------------------------------------------

/** Maximum width-scale factor allowed at the current device tier. */
const SCALE_CAP = isDesktop ? 1.6 : isLargeTablet ? 1.5 : isTablet ? 1.3 : Infinity;

/**
 * Maximum height-scale factor — gentler than width so vertically-fixed
 * components (buttons, headers) don't grow too tall on wide/tall screens.
 */
const V_SCALE_CAP = isDesktop ? 1.4 : isLargeTablet ? 1.3 : isTablet ? 1.2 : Infinity;

// ---------------------------------------------------------------------------
// Core scaling functions
// ---------------------------------------------------------------------------

/**
 * Scales a value proportionally to screen **width**.
 * Use for horizontal dimensions, padding, margins, widths, and icon sizes.
 *
 * @param size - Base size in logical pixels (designed at 390 px wide).
 */
export const scale = (size: number): number => {
  const factor = Math.min(screenWidth / BASE_WIDTH, SCALE_CAP);
  return Math.round(size * factor);
};

/**
 * Scales a value proportionally to screen **height**.
 * Use for component heights (buttons, inputs, headers) and vertical spacing
 * that must track available viewport height.
 *
 * @param size - Base size in logical pixels (designed at 844 px tall).
 */
export const verticalScale = (size: number): number => {
  const factor = Math.min(screenHeight / BASE_HEIGHT, V_SCALE_CAP);
  return Math.round(size * factor);
};

/**
 * Blended width-based scaling — grows more slowly than `scale`.
 * Default `factor=0.5` means the output meets scale() halfway, making it
 * ideal for typography and border radius where extreme growth looks wrong.
 *
 * Formula: `size + (scale(size) − size) × factor`
 *
 * @param size   - Base size in logical pixels.
 * @param factor - Blend factor in [0, 1]; 0 = no scaling, 1 = full `scale()`.
 */
export const moderateScale = (size: number, factor = 0.5): number => {
  return Math.round(size + (scale(size) - size) * factor);
};

/**
 * Clamps `value` to the inclusive range [min, max].
 *
 * @example
 * clamp(moderateScale(32), 28, 40) // never below 28 or above 40
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------------------
// Device-tier value selector
// ---------------------------------------------------------------------------

/**
 * Returns the most-specific value for the current device tier, falling back
 * toward `phone` when a more-specific value is not supplied.
 *
 * @example
 * const padding = responsiveValue({ phone: 16, tablet: 24, desktop: 32 });
 */
export const responsiveValue = <T>(values: {
  phone: T;
  tablet?: T;
  largeTablet?: T;
  desktop?: T;
}): T => {
  const tier = getDeviceType();
  if (tier === "desktop" && values.desktop !== undefined) return values.desktop;
  if ((tier === "desktop" || tier === "largeTablet") && values.largeTablet !== undefined)
    return values.largeTablet;
  if (tier !== "phone" && values.tablet !== undefined) return values.tablet;
  return values.phone;
};

// ---------------------------------------------------------------------------
// Convenience object — current screen dimensions + flags
// ---------------------------------------------------------------------------

/** Current screen dimensions and device-tier flags. */
export const dimensions = {
  screenWidth,
  screenHeight,
  isPhone,
  isTablet,
  isLargeTablet,
  isDesktop,
} as const;

// ---------------------------------------------------------------------------
// Pre-computed responsive sizes
// (consumed by design tokens in src/styles/tokens/)
// ---------------------------------------------------------------------------

/**
 * Pre-computed responsive sizes for all design tokens.
 * Consume via TYPOGRAPHY, SPACING, SIZING, and BORDER_RADIUS tokens rather
 * than importing this object directly.
 */
export const responsiveSizes = {
  // ── Typography ────────────────────────────────────────────────────────────
  textXs: moderateScale(12),
  textSm: moderateScale(14),
  textBase: moderateScale(16),
  textLg: moderateScale(18),
  textXl: moderateScale(20),
  text2xl: moderateScale(24),
  text3xl: moderateScale(30),
  text4xl: moderateScale(36),
  /** Modal / screen titles (e.g. "Credits", "Use a Hint?"). */
  textTitle: moderateScale(28),
  /** Hero / display text (e.g. "Victory!", "Oh no!", answer reveal). */
  textDisplay: moderateScale(32),
  /** Letter text inside a game tile — scales with tile size. */
  textTile: moderateScale(28),

  // ── Spacing ───────────────────────────────────────────────────────────────
  spacingXs: scale(4),
  spacingSm: scale(8),
  spacingMd: scale(16),
  spacingLg: scale(24),
  spacingXl: scale(32),
  spacing2xl: scale(48),

  // ── Component heights ─────────────────────────────────────────────────────
  buttonHeight: verticalScale(48),
  inputHeight: verticalScale(48),
  headerHeight: verticalScale(60),
  tabBarHeight: verticalScale(60),

  // ── Border radius ─────────────────────────────────────────────────────────
  radiusSm: moderateScale(4),
  radiusMd: moderateScale(8),
  radiusLg: moderateScale(12),
  radiusXl: moderateScale(16),
  radiusXxl: moderateScale(20),
  radiusFull: 9999,
} as const;

// ---------------------------------------------------------------------------
// Orientation change helper
// ---------------------------------------------------------------------------

/**
 * Registers a listener for device orientation / window-resize events.
 * Returns a cleanup function suitable for use in `useEffect`.
 *
 * Note: the app is currently portrait-locked, so this is provided for
 * completeness and future use only.
 *
 * @example
 * useEffect(() => addOrientationChangeListener(forceUpdate), []);
 */
export const addOrientationChangeListener = (callback: () => void): (() => void) => {
  const subscription = Dimensions.addEventListener("change", callback);
  return () => subscription?.remove();
};

