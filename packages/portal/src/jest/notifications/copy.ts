export type NotificationCopy = {
  dailyBody: string;
  dailyCta: string;
  streakBody: string;
  streakCta: string;
  weeklyBody: string;
  weeklyCta: string;
  raceTitle: string;
  raceBody: string;
  raceCta: string;
};

const COPY_FIELDS: Array<keyof NotificationCopy> = [
  "dailyBody",
  "dailyCta",
  "streakBody",
  "streakCta",
  "weeklyBody",
  "weeklyCta",
  "raceTitle",
  "raceBody",
  "raceCta",
];

const BODY_FIELDS = new Set<keyof NotificationCopy>(["dailyBody", "streakBody", "weeklyBody", "raceBody"]);
const CTA_FIELDS = new Set<keyof NotificationCopy>(["dailyCta", "streakCta", "weeklyCta", "raceCta"]);
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const UNSAFE_NAME_CHARACTERS = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u200D\uFE0F]/gu;

const maxLengthFor = (field: keyof NotificationCopy) => {
  if (BODY_FIELDS.has(field)) return 100;
  if (CTA_FIELDS.has(field)) return 50;
  return 200;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

export const parseNotificationCopyDocument = (data: unknown, locale: string): NotificationCopy => {
  const document = asRecord(data);
  const locales = asRecord(document?.locales);
  const defaultLocale = typeof document?.defaultLocale === "string" ? document.defaultLocale : "en";
  const selected = asRecord(locales?.[locale]) ?? asRecord(locales?.[defaultLocale]);
  if (!selected) throw new Error(`Notification copy is unavailable for locale ${locale}.`);

  return Object.fromEntries(COPY_FIELDS.map((field) => {
    const value = selected[field];
    if (
      typeof value !== "string"
      || value.trim().length === 0
      || [...value.trim()].length > maxLengthFor(field)
      || EMOJI_PATTERN.test(value)
    ) {
      throw new Error(`Notification copy field ${field} is invalid for locale ${locale}.`);
    }
    return [field, value.trim()];
  })) as NotificationCopy;
};

export const renderNotificationTemplate = (
  template: string,
  values: Record<string, string | number>,
) => template.replace(/\{([a-zA-Z0-9_]+)\}/g, (token, key: string) =>
  Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : token);

export const renderNotificationBody = (
  template: string,
  values: Record<string, string | number>,
) => {
  const body = renderNotificationTemplate(template, values).trim();
  if ([...body].length > 100 || EMOJI_PATTERN.test(body)) {
    throw new Error("Rendered notification body is not safe for message delivery.");
  }
  return body;
};

export const notificationPlayerName = (value: string | undefined, fallback: string) => {
  const clean = (candidate: string) => candidate
    .replace(UNSAFE_NAME_CHARACTERS, "")
    .replace(/\s+/g, " ")
    .trim();
  const selected = clean(value ?? "") || clean(fallback) || "Solver";
  return [...selected].slice(0, 24).join("");
};

export const MOCK_NOTIFICATION_COPY: NotificationCopy = {
  dailyBody: "{name}, today's Cosmic Riddle is live. Solve it for {coins}+ coins.",
  dailyCta: "Solve it",
  streakBody: "You have {wins} wins and a {streak}-day best streak. Today's riddle pays {coins}+ coins.",
  streakCta: "Start a streak",
  weeklyBody: "Level {level} solver: a fresh Daily Cosmic Riddle is ready. Claim {coins}+ coins.",
  weeklyCta: "Claim coins",
  raceTitle: "Race to 10",
  raceBody: "Your recorded race is ready to share.",
  raceCta: "Accept challenge",
};
