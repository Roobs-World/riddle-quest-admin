export type ResponsiveDeviceTier = "phone" | "tablet" | "largeTablet" | "desktop";

export interface ResponsiveTestProfile {
  name: string;
  screenWidth: number;
  screenHeight: number;
  expectedTier: ResponsiveDeviceTier;
}

export const responsiveTestProfiles = {
  smallPhone: {
    name: "Pixel 4a-class small phone",
    screenWidth: 360,
    screenHeight: 780,
    expectedTier: "phone",
  },
  standardPhone: {
    name: "Pixel 7-class standard phone",
    screenWidth: 390,
    screenHeight: 844,
    expectedTier: "phone",
  },
  largePhone: {
    name: "Pixel 8 Pro-class large phone",
    screenWidth: 430,
    screenHeight: 932,
    expectedTier: "phone",
  },
  foldableOuter: {
    name: "Foldable outer display",
    screenWidth: 412,
    screenHeight: 915,
    expectedTier: "phone",
  },
  foldableUnfolded: {
    name: "Foldable unfolded/tablet display",
    screenWidth: 673,
    screenHeight: 841,
    expectedTier: "tablet",
  },
  smallTablet: {
    name: "7-8 inch small tablet",
    screenWidth: 600,
    screenHeight: 960,
    expectedTier: "tablet",
  },
  largeTablet: {
    name: "10-11 inch large tablet",
    screenWidth: 834,
    screenHeight: 1194,
    expectedTier: "largeTablet",
  },
  lowDensityTablet: {
    name: "Low-density tablet",
    screenWidth: 800,
    screenHeight: 1280,
    expectedTier: "largeTablet",
  },
} as const satisfies Record<string, ResponsiveTestProfile>;

export const responsiveTestProfileList = Object.values(responsiveTestProfiles);

export const getResponsiveFlagsForProfile = (profile: ResponsiveTestProfile) => {
  const isDesktop = profile.screenWidth >= 1024;
  const isLargeTablet = profile.screenWidth >= 768;
  const isTablet = profile.screenWidth >= 600;
  const isPhone = !isTablet;

  return {
    isPhone,
    isTablet,
    isLargeTablet,
    isDesktop,
  };
};

export const getDeviceTypeForProfile = (profile: ResponsiveTestProfile): ResponsiveDeviceTier => {
  const flags = getResponsiveFlagsForProfile(profile);
  if (flags.isDesktop) return "desktop";
  if (flags.isLargeTablet) return "largeTablet";
  if (flags.isTablet) return "tablet";
  return "phone";
};

const getScaleCap = (profile: ResponsiveTestProfile): number => {
  const flags = getResponsiveFlagsForProfile(profile);
  if (flags.isDesktop) return 1.6;
  if (flags.isLargeTablet) return 1.5;
  if (flags.isTablet) return 1.3;
  return Infinity;
};

const getVerticalScaleCap = (profile: ResponsiveTestProfile): number => {
  const flags = getResponsiveFlagsForProfile(profile);
  if (flags.isDesktop) return 1.4;
  if (flags.isLargeTablet) return 1.3;
  if (flags.isTablet) return 1.2;
  return Infinity;
};

export const createResponsiveMockForProfile = (profile: ResponsiveTestProfile) => {
  const flags = getResponsiveFlagsForProfile(profile);
  const widthScale = Math.min(profile.screenWidth / 390, getScaleCap(profile));
  const heightScale = Math.min(profile.screenHeight / 844, getVerticalScaleCap(profile));
  const scale = (size: number): number => Math.round(size * widthScale);
  const verticalScale = (size: number): number => Math.round(size * heightScale);
  const moderateScale = (size: number, factor = 0.5): number => Math.round(size + (scale(size) - size) * factor);
  const getDeviceType = (): ResponsiveDeviceTier => getDeviceTypeForProfile(profile);
  const responsiveValue = <T>(values: {phone: T; tablet?: T; largeTablet?: T; desktop?: T}): T => {
    const tier = getDeviceType();
    if (tier === "desktop" && values.desktop !== undefined) return values.desktop;
    if ((tier === "desktop" || tier === "largeTablet") && values.largeTablet !== undefined) return values.largeTablet;
    if (tier !== "phone" && values.tablet !== undefined) return values.tablet;
    return values.phone;
  };

  return {
    ...flags,
    dimensions: {
      screenWidth: profile.screenWidth,
      screenHeight: profile.screenHeight,
      ...flags,
    },
    scale,
    verticalScale,
    moderateScale,
    clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    getDeviceType,
    responsiveValue,
    responsiveSizes: {
      textXs: moderateScale(12),
      textSm: moderateScale(14),
      textBase: moderateScale(16),
      textLg: moderateScale(18),
      textXl: moderateScale(20),
      text2xl: moderateScale(24),
      text3xl: moderateScale(30),
      text4xl: moderateScale(36),
      textTitle: moderateScale(28),
      textDisplay: moderateScale(32),
      textTile: moderateScale(28),
      spacingXs: scale(4),
      spacingSm: scale(8),
      spacingMd: scale(16),
      spacingLg: scale(24),
      spacingXl: scale(32),
      spacing2xl: scale(48),
      buttonHeight: verticalScale(48),
      inputHeight: verticalScale(48),
      headerHeight: verticalScale(60),
      tabBarHeight: verticalScale(60),
      radiusSm: moderateScale(4),
      radiusMd: moderateScale(8),
      radiusLg: moderateScale(12),
      radiusXl: moderateScale(16),
      radiusXxl: moderateScale(20),
      radiusFull: 9999,
    },
    addOrientationChangeListener: jest.fn(() => jest.fn()),
  };
};

export const withResponsiveProfile = <T>(profile: ResponsiveTestProfile, loadModule: () => T): T => {
  let result: T | undefined;

  jest.isolateModules(() => {
    jest.doMock("../utils/responsive", () => createResponsiveMockForProfile(profile));
    result = loadModule();
  });

  if (result === undefined) {
    throw new Error(`Responsive profile ${profile.name} did not load a module result.`);
  }

  return result;
};
