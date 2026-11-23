import {isPlayerReducedMotionEnabled} from "../../settings/browser/playerPreferences";

/** Describes mobile capabilities. */
export type MobileCapabilities = {
  /** Stores device memory. */
  deviceMemory?: number;
  /** Stores hardware concurrency. */
  hardwareConcurrency?: number;
  /** Stores save data. */
  saveData?: boolean;
  /** Stores effective type. */
  effectiveType?: string;
  /** Stores reduced motion. */
  reducedMotion: boolean;
  /** Stores web gl available. */
  webGlAvailable: boolean;
};

/** Indicates whether should load decorative web gl. */
export function shouldLoadDecorativeWebGl(capabilities: MobileCapabilities): boolean {
  if (!capabilities.webGlAvailable || capabilities.reducedMotion || capabilities.saveData) return false;
  if (capabilities.deviceMemory !== undefined && capabilities.deviceMemory <= 4) return false;
  if (capabilities.hardwareConcurrency !== undefined && capabilities.hardwareConcurrency <= 4) return false;
  return capabilities.effectiveType !== "slow-2g" && capabilities.effectiveType !== "2g";
}

/** Gets mobile capabilities. */
export function getMobileCapabilities(): MobileCapabilities {
  /** Provides runtime navigator behavior. */
  const runtimeNavigator = navigator as Navigator & {
    /** Stores device memory. */
    deviceMemory?: number;
    /** Stores connection. */
    connection?: {
      /** Stores save data. */
      saveData?: boolean; /** Stores effective type. */
      /** Stores effective type. */
      effectiveType?: string;
    };
  };
  /** Provides web gl available behavior. */
  let webGlAvailable = false;
  if (typeof WebGLRenderingContext !== "undefined") {
    if (typeof document === "undefined") {
      webGlAvailable = true;
    } else {
      try {
        /** Provides canvas behavior. */
        const canvas = document.createElement("canvas");
        /** The capability probe must not retain a second context beside the real scene. */
        const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
        webGlAvailable = Boolean(context);
        try { context?.getExtension("WEBGL_lose_context")?.loseContext(); } catch {
          /* Availability is already known; optional probe cleanup does not change it. */
        }
      } catch {
        webGlAvailable = false;
      }
    }
  }
  return {
    deviceMemory: runtimeNavigator.deviceMemory,
    hardwareConcurrency: runtimeNavigator.hardwareConcurrency,
    saveData: runtimeNavigator.connection?.saveData,
    effectiveType: runtimeNavigator.connection?.effectiveType,
    reducedMotion: isPlayerReducedMotionEnabled(),
    webGlAvailable,
  };
}
