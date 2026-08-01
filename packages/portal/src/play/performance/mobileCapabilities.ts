export type MobileCapabilities = {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
  effectiveType?: string;
  reducedMotion: boolean;
  webGlAvailable: boolean;
};

export function shouldLoadDecorativeWebGl(capabilities: MobileCapabilities): boolean {
  if (!capabilities.webGlAvailable || capabilities.reducedMotion || capabilities.saveData) return false;
  if (capabilities.deviceMemory !== undefined && capabilities.deviceMemory <= 4) return false;
  if (capabilities.hardwareConcurrency !== undefined && capabilities.hardwareConcurrency <= 4) return false;
  return capabilities.effectiveType !== "slow-2g" && capabilities.effectiveType !== "2g";
}

export function getMobileCapabilities(): MobileCapabilities {
  const runtimeNavigator = navigator as Navigator & {
    deviceMemory?: number;
    connection?: {saveData?: boolean; effectiveType?: string};
  };
  return {
    deviceMemory: runtimeNavigator.deviceMemory,
    hardwareConcurrency: runtimeNavigator.hardwareConcurrency,
    saveData: runtimeNavigator.connection?.saveData,
    effectiveType: runtimeNavigator.connection?.effectiveType,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    webGlAvailable: typeof WebGLRenderingContext !== "undefined",
  };
}
