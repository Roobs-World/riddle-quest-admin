export const operatorTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const localDay = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const localTime = (date: Date): string => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

/** The browser must preserve every local calendar component, including across DST transitions. */
export function scheduledInstant(day: string, time: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(`${day}T${time}`);
  if (!match) return null;
  const [, year, month, date, hours, minutes, seconds = "0"] = match;
  const value = new Date(`${day}T${time}`);
  if (!Number.isFinite(value.getTime()) || value.getFullYear() !== Number(year) || value.getMonth() + 1 !== Number(month) ||
      value.getDate() !== Number(date) || value.getHours() !== Number(hours) || value.getMinutes() !== Number(minutes) || value.getSeconds() !== Number(seconds)) return null;
  return value.toISOString();
}

export function formatInstant(value: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(undefined, {month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...options}).format(new Date(value));
}

export function nextSlot(): Date {
  const value = new Date(Date.now() + 60 * 60_000);
  value.setSeconds(0, 0);
  return value;
}
