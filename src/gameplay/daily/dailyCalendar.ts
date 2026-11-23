import type {SupportedLocale} from "../../localization/locales";

/** Shared regional clocks for language-scoped Daily content, independent of device settings. */
export const DAILY_LOCALE_TIME_ZONES: Readonly<Record<SupportedLocale, string>> = {
  en: "Europe/London", es: "Europe/Madrid", pt: "Europe/Lisbon", fr: "Europe/Paris",
  de: "Europe/Berlin", ja: "Asia/Tokyo", ko: "Asia/Seoul",
  hi: "Asia/Kolkata", ru: "Europe/Moscow", tr: "Europe/Istanbul", ar: "Asia/Riyadh",
  id: "Asia/Jakarta", it: "Europe/Rome", nl: "Europe/Amsterdam", pl: "Europe/Warsaw",
  vi: "Asia/Ho_Chi_Minh",
};

/** Resolves a supported locale to its shared clock; UTC is reserved for legacy internal callers. */
export function getDailyTimeZone(locale: string): string {
  return locale === "UTC" ? "UTC" : DAILY_LOCALE_TIME_ZONES[locale as SupportedLocale] ?? DAILY_LOCALE_TIME_ZONES.en;
}

/** Reuses at most one formatter per configured IANA clock. */
const clockFormatters = new Map<string, Intl.DateTimeFormat>();

/** Reads calendar fields without depending on the host or browser timezone. */
function calendarParts(locale: string, now: Date): Record<string, string> {
  /** Authoritative regional clock for the requested locale. */
  const timeZone = getDailyTimeZone(locale);
  /** Cached calendar formatter retained across reads of the same regional clock. */
  let formatter = clockFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    clockFormatters.set(timeZone, formatter);
  }
  return Object.fromEntries(formatter.formatToParts(now).map(part => [part.type, part.value]));
}

/** Returns the challenge date, beginning at 09:00 on the locale’s regional clock. */
export function getDailyDate(locale: string, now = new Date()): string {
  /** Calendar fields expressed in the locale’s authoritative regional clock. */
  const parts = calendarParts(locale, now);
  /** Regional calendar date before applying the challenge start boundary. */
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return locale !== "UTC" && Number(parts.hour) < 9 ? shiftDailyDate(day, -1) : day;
}

/** Advances calendar dates without assuming that local days last 24 hours. */
export function shiftDailyDate(day: string, days: number): string {
  /** UTC calendar anchor used for date shifting without assuming local day length. */
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Resolves regional 09:00 directly, including seasonal timezone offsets. */
export function getDailyStart(locale: string, day: string): Date {
  /** Challenge start expressed as UTC before regional offset correction. */
  const target = Date.parse(`${day}T${locale === "UTC" ? "00" : "09"}:00:00Z`);
  /** Candidate regional-start instant refined by offset correction. */
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    /** Calendar fields expressed in the locale’s authoritative regional clock. */
    const parts = calendarParts(locale, new Date(instant));
    /** Observed regional wall-clock fields expressed on a UTC calendar scale. */
    const wall = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    /** Remaining regional offset needed to reach the requested start. */
    const correction = target - wall;
    instant += correction;
    if (correction === 0) return new Date(instant);
  }
  throw new Error("Could not resolve Daily start.");
}

/** Generates only at regional 09:00; scheduler retries retain their original scheduled instant. */
export function isDailyGenerationDue(locale: string, now: Date): boolean {
  /** Regional hour and minute used by the scheduler dispatch filter. */
  const parts = calendarParts(locale, now);
  return Number(parts.hour) === 9 && Number(parts.minute) === 0;
}
