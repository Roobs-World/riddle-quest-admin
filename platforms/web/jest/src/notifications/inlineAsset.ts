import type {JestNotificationAsset} from "../types";
import type {NotificationCardContent} from "./notificationCard";

/** Jest limits the complete ASCII data URL, including its prefix and base64 expansion. */
const MAX_INLINE_ASSET_BYTES = 2 * 1024 * 1024;
/** HTTPS images are fetched and validated by the Jest platform. */
const MAX_ASSET_URL_CHARACTERS = 2048;

/** Checks HTTPS URLs or supported base64 data URLs before SDK dispatch. */
export function isValidNotificationAsset(asset: string): boolean {
  if (/^https:\/\/\S+$/.test(asset)) return asset.length <= MAX_ASSET_URL_CHARACTERS;
  if (asset.length > MAX_INLINE_ASSET_BYTES) return false;
  /** Supported MIME type and standard base64 payload. */
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(asset);
  if (!match) return false;
  /** Base64 bytes excluding the data URL header. */
  const encoded = match[1];
  return encoded.length % 4 === 0;
}

/** Loads the optional canvas renderer while preserving notification fallbacks. */
export async function createNotificationAsset(content: NotificationCardContent): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    /** The renderer chunk is unnecessary until a registered player's reminder is prepared. */
    const asset = (await import("./notificationCard")).renderNotificationCard(content);
    return asset && isValidNotificationAsset(asset) ? asset : null;
  } catch {
    return null;
  }
}

/** Selects inline content when rendering succeeds, otherwise the configured library/Hero fallback. */
export async function notificationAsset(content: NotificationCardContent, assetReference?: string): Promise<JestNotificationAsset> {
  /** A failed render preserves library/Hero scheduling. */
  const asset = await createNotificationAsset(content);
  return asset ? {asset} : assetReference ? {assetReference} : {};
}
