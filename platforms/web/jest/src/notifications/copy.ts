/** Describes notification copy. */
export type NotificationCopy = {
  /** Stores daily body. */
  dailyBody: string;
  /** Stores daily cta. */
  dailyCta: string;
  /** Stores streak body. */
  streakBody: string;
  /** Stores streak cta. */
  streakCta: string;
  /** Stores weekly body. */
  weeklyBody: string;
  /** Stores weekly cta. */
  weeklyCta: string;
  /** Stores race title. */
  raceTitle: string;
  /** Stores race body. */
  raceBody: string;
  /** Stores race cta. */
  raceCta: string;
};

/** Defines the copy fields value. */
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

/** Defines the body fields value. */
const BODY_FIELDS = new Set<keyof NotificationCopy>(["dailyBody", "streakBody", "weeklyBody", "raceBody"]);
/** Defines the cta fields value. */
const CTA_FIELDS = new Set<keyof NotificationCopy>(["dailyCta", "streakCta", "weeklyCta", "raceCta"]);
/** Defines the emoji pattern value. */
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
/** Defines the unsafe name characters value. */
const UNSAFE_NAME_CHARACTERS = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u200D\uFE0F]/gu;

/** Provides max length for behavior. */
const maxLengthFor = (field: keyof NotificationCopy) => {
  if (BODY_FIELDS.has(field)) return 100;
  if (CTA_FIELDS.has(field)) return 50;
  return 200;
};

/** Provides as record behavior. */
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** Parses notification copy document. */
export const parseNotificationCopyDocument = (data: unknown, locale: string): NotificationCopy => {
  /** Provides document behavior. */
  const document = asRecord(data);
  /** Provides locales behavior. */
  const locales = asRecord(document?.locales);
  /** Provides default locale behavior. */
  const defaultLocale = typeof document?.defaultLocale === "string" ? document.defaultLocale : "en";
  /** Provides selected behavior. */
  const selected = asRecord(locales?.[locale]) ?? asRecord(locales?.[defaultLocale]);
  if (!selected) throw new Error(`Notification copy is unavailable for locale ${locale}.`);

  return Object.fromEntries(
    COPY_FIELDS.map((field) => {
      /** Provides value behavior. */
      const value = selected[field];
      if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        [...value.trim()].length > maxLengthFor(field) ||
        EMOJI_PATTERN.test(value)
      ) {
        throw new Error(`Notification copy field ${field} is invalid for locale ${locale}.`);
      }
      return [field, value.trim()];
    }),
  ) as NotificationCopy;
};

/** Renders notification template. */
export const renderNotificationTemplate = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : token,
  );

/** Renders notification body. */
export const renderNotificationBody = (template: string, values: Record<string, string | number>) => {
  /** Provides body behavior. */
  const body = renderNotificationTemplate(template, values).trim();
  if ([...body].length > 100 || EMOJI_PATTERN.test(body)) {
    throw new Error("Rendered notification body is not safe for message delivery.");
  }
  return body;
};

/** Provides notification player name behavior. */
export const notificationPlayerName = (value: string | undefined, fallback: string) => {
  /** Provides clean behavior. */
  const clean = (candidate: string) => candidate.replace(UNSAFE_NAME_CHARACTERS, "").replace(/\s+/g, " ").trim();
  /** Provides selected behavior. */
  const selected = clean(value ?? "") || clean(fallback) || "Solver";
  return [...selected].slice(0, 24).join("");
};

/** Defines the mock notification copy value. */
export const MOCK_NOTIFICATION_COPY: NotificationCopy = {
  dailyBody: "{name}, today's Cosmic Riddle is live. Solve it for {coins}+ coins.",
  dailyCta: "Solve it",
  streakBody: "You have {wins} wins and a {streak}-day best streak. Today's riddle pays {coins}+ coins.",
  streakCta: "Start a streak",
  weeklyBody: "Level {level} solver: a fresh Daily Cosmic Riddle is ready. Claim {coins}+ coins.",
  weeklyCta: "Claim coins",
  raceTitle: "Race to 10",
  raceBody: "A friend may have finished your challenge. Check the result and send a rematch.",
  raceCta: "Check results",
};
