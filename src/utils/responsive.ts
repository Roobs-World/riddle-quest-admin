import { Dimensions } from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Device breakpoints
const TABLET_MIN_WIDTH = 600; // Common tablet minimum width in portrait
const LARGE_TABLET_MIN_WIDTH = 768; // iPad size in portrait

// Detect device type
export const isTablet = screenWidth >= TABLET_MIN_WIDTH;
export const isLargeTablet = screenWidth >= LARGE_TABLET_MIN_WIDTH;
export const isPhone = screenWidth < TABLET_MIN_WIDTH;

// Get device type string
export const getDeviceType = (): "phone" | "tablet" | "largeTablet" => {
  if (isLargeTablet) return "largeTablet";
  if (isTablet) return "tablet";
  return "phone";
};

// Responsive scaling functions
export const scale = (size: number): number => {
  // Base scale on iPhone 14 width (390px)
  const baseWidth = 390;
  const scaleFactor = screenWidth / baseWidth;

  // Limit scaling for tablets to prevent elements from becoming too large
  const maxScaleFactor = isTablet ? 1.5 : scaleFactor;
  const appliedScaleFactor = Math.min(scaleFactor, maxScaleFactor);

  return Math.round(size * appliedScaleFactor);
};

// Vertical scaling (for heights, margins, paddings)
export const verticalScale = (size: number): number => {
  // Base scale on iPhone 14 height (844px)
  const baseHeight = 844;
  const scaleFactor = screenHeight / baseHeight;

  // Limit scaling for tablets
  const maxScaleFactor = isTablet ? 1.5 : scaleFactor;
  const appliedScaleFactor = Math.min(scaleFactor, maxScaleFactor);

  return Math.round(size * appliedScaleFactor);
};

// Moderate scaling (for fonts, border radius, etc.)
export const moderateScale = (size: number, factor = 0.5): number => {
  return size + (scale(size) - size) * factor;
};

// Responsive value based on device type
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

// Responsive dimensions
export const dimensions = {
  screenWidth,
  screenHeight,
  isTablet,
  isLargeTablet,
  isPhone,
};

// Common responsive sizes
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

// Orientation change listener setup
export const addOrientationChangeListener = (callback: () => void) => {
  const subscription = Dimensions.addEventListener("change", callback);
  return () => subscription?.remove();
};
