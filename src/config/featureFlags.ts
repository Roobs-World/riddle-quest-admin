import { Platform } from "react-native";

export const featureFlags = {
  /**
   * Shared Animation Backend requires RN 0.85.1+ with experimental release channel.
   * Keep disabled by default; enable only for targeted experimental builds.
   */
  sharedAnimationBackendExperimental:
    process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND === "true",
};

const getReactNativeVersion = (): { major: number; minor: number; patch: number } => {
  const fallback = { major: 0, minor: 0, patch: 0 };
  const version = Platform.constants?.reactNativeVersion;
  if (!version) {
    return fallback;
  }
  return {
    major: version.major ?? 0,
    minor: version.minor ?? 0,
    patch: version.patch ?? 0,
  };
};

const isRn0851OrHigher = (): boolean => {
  const v = getReactNativeVersion();
  if (v.major > 0) return true;
  if (v.minor > 85) return true;
  return v.minor === 85 && v.patch >= 1;
};

export const isSharedAnimationBackendEnabled = (): boolean =>
  featureFlags.sharedAnimationBackendExperimental && isRn0851OrHigher();

export const isSharedAnimationBackendFlagRequested = (): boolean =>
  featureFlags.sharedAnimationBackendExperimental;
