import type {JestNotificationAsset} from "../types";

/** Jest's maximum decoded inline image size. */
const MAX_INLINE_ASSET_BYTES = 2 * 1024 * 1024;

/** Existing localized strings reused by a generated reminder card. */
type NotificationCardContent = {
  /** Localized game or race title. */
  title: string;
  /** Already rendered, personalized notification body. */
  body: string;
  /** Localized call to action. */
  ctaText: string;
};

/** Checks the supported base64 encoding and decoded size before SDK dispatch. */
export function isValidNotificationAsset(asset: string): boolean {
  /** Supported MIME type and standard base64 payload. */
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(asset);
  if (!match) return false;
  /** Base64 bytes excluding the data URL header. */
  const encoded = match[1];
  if (encoded.length % 4 !== 0) return false;
  /** Decoded size accounts for both padding forms. */
  const bytes = encoded.length * 3 / 4 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
  return bytes > 0 && bytes <= MAX_INLINE_ASSET_BYTES;
}

/** Renders translated notification content at 3:2 without external images or fonts. */
export function createNotificationAsset(content: NotificationCardContent): string | null {
  if (typeof document === "undefined") return null;
  try {
    /** Fixed 3:2 surface satisfies notification cropping requirements. */
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 600;
    /** Missing or disabled canvas causes the configured asset fallback. */
    const context = canvas.getContext("2d");
    if (!context) return null;
    /** Game palette rendered without fetching external assets. */
    const gradient = context.createLinearGradient(0, 0, 900, 600);
    gradient.addColorStop(0, "#142128");
    gradient.addColorStop(1, "#254e70");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 900, 600);
    context.fillStyle = "#f4b83f";
    context.font = "700 46px system-ui, sans-serif";
    context.fillText(content.title, 60, 100, 780);
    context.fillStyle = "#fffdf7";
    context.font = "36px system-ui, sans-serif";
    // Keep words together, splitting long names and scripts without spaces by code point.
    /** Current text row, including scripts that have no spaces. */
    let line = "";
    /** Baseline advances by a fixed line height. */
    let y = 195;
    for (const token of content.body.match(/\S+\s*/gu) ?? []) {
      if (line && context.measureText(line + token.trimEnd()).width > 780) {
        context.fillText(line.trim(), 60, y, 780);
        line = "";
        y += 52;
      }
      for (const character of token) {
        if (!line && /\s/u.test(character)) continue;
        /** Candidate row measured using the active system font. */
        const candidate = line + character;
        if (context.measureText(candidate).width > 780 && line) {
          context.fillText(line.trim(), 60, y, 780);
          line = character.trimStart();
          y += 52;
        } else line = candidate;
      }
    }
    // Preserve the notification fallback if localized text cannot fit above the CTA.
    if (y > 455) return null;
    if (line) context.fillText(line.trim(), 60, y, 780);
    context.fillStyle = "#f4b83f";
    context.fillRect(60, 490, 780, 64);
    context.fillStyle = "#142128";
    context.font = "700 30px system-ui, sans-serif";
    context.fillText(content.ctaText, 84, 532, 732);
    /** Encoded image must fit the same boundary applied before SDK dispatch. */
    const asset = canvas.toDataURL("image/png");
    return isValidNotificationAsset(asset) ? asset : null;
  } catch {
    return null;
  }
}

/** Selects inline content when rendering succeeds, otherwise the configured library/Hero fallback. */
export function notificationAsset(content: NotificationCardContent, assetReference?: string): JestNotificationAsset {
  /** A failed render preserves library/Hero scheduling. */
  const asset = createNotificationAsset(content);
  return asset ? {asset} : assetReference ? {assetReference} : {};
}
