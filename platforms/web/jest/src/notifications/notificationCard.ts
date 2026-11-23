/** Existing localized strings reused by a generated reminder card. */
export type NotificationCardContent = {
  /** Localized game or race title. */
  title: string;
  /** Already rendered, personalized notification body. */
  body: string;
  /** Localized call to action. */
  ctaText: string;
};

/** Renders translated notification content at 3:2 without external images or fonts. */
export function renderNotificationCard(content: NotificationCardContent): string | null {
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
    /** JPEG keeps seven inline reminder cards below Jest's batched request limit. */
    const asset = canvas.toDataURL("image/jpeg", 0.82);
    return asset;
  } catch {
    return null;
  }
}
