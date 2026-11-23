export {captureVictoryShareImage} from "../../../../../src/sharing/browser/shareImages";
import type {ScreenshotProvider} from "../types";

/** Jest limits the complete ASCII data URL, including its prefix and base64 expansion. */
const MAX_SCREENSHOT_DATA_URL_BYTES = 2 * 1024 * 1024;

/** Returns a Jest-supported image only when its complete data URL fits the SDK limit. */
export function sizeCheckedShareImage(result: string | null): string | null {
  if (!result || !/^data:image\/png;base64,/.test(result)) return null;
  return result.length <= MAX_SCREENSHOT_DATA_URL_BYTES ? result : null;
}

/** Provides size checked screenshot provider behavior. */
export function sizeCheckedScreenshotProvider(provider: ScreenshotProvider): ScreenshotProvider {
  return async () => {
    /** Provides result behavior. */
    const result = await provider();
    return sizeCheckedShareImage(result);
  };
}

/** Loads DOM capture only when Jest requests a screenshot. */
export async function captureGameScreenshot(): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    return await (await import("./captureGameScreenshot")).captureGameScreenshot();
  } catch {
    return null;
  }
}
