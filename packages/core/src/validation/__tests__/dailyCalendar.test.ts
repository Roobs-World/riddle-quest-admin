import {DAILY_LOCALE_TIME_ZONES, getDailyDate, getDailyMidnight, getDailyTimeZone, isDailyGenerationDue, shiftDailyDate} from "../dailyCalendar";
import {SUPPORTED_LOCALES} from "../locales";

it("assigns one valid IANA clock to every supported locale", () => {
  expect(Object.keys(DAILY_LOCALE_TIME_ZONES).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  for (const locale of SUPPORTED_LOCALES) expect(() => new Intl.DateTimeFormat("en", {timeZone: getDailyTimeZone(locale)})).not.toThrow();
});
it.each([
  ["en", "2026-08-11", "2026-08-10T23:00:00.000Z"],
  ["en", "2026-01-11", "2026-01-11T00:00:00.000Z"],
  ["es", "2026-08-11", "2026-08-10T22:00:00.000Z"],
  ["ja", "2026-08-11", "2026-08-10T15:00:00.000Z"],
  ["hi", "2026-08-11", "2026-08-10T18:30:00.000Z"],
])("rolls %s to %s at exactly %s", (locale, day, midnight) => {
  /** Fixed instant used to verify the exact local-midnight transition. */
  const instant = new Date(midnight);
  expect(getDailyMidnight(locale, day).toISOString()).toBe(midnight);
  expect(getDailyDate(locale, instant)).toBe(day);
  expect(getDailyDate(locale, new Date(instant.getTime() - 1))).toBe(shiftDailyDate(day, -1));
  expect(isDailyGenerationDue(locale, instant)).toBe(true);
  expect(isDailyGenerationDue(locale, new Date(instant.getTime() - 1))).toBe(false);
});
it.each([["2026-03-29", 23], ["2026-10-25", 25]])("handles London DST day %s lasting %s hours", (day, hours) => {
  expect((getDailyMidnight("en", shiftDailyDate(day as string, 1)).getTime() - getDailyMidnight("en", day as string).getTime()) / 3600000).toBe(hours);
});
it("uses London for unsupported locale input", () => expect(getDailyTimeZone("unsupported")).toBe("Europe/London"));

it("fails after bounded retries when a calendar provider cannot resolve midnight", () => {
  /** Provides format behavior. */
  const format = jest.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockReturnValue([
    {type: "year", value: "2026"}, {type: "month", value: "01"}, {type: "day", value: "01"},
    {type: "hour", value: "00"}, {type: "minute", value: "00"}, {type: "second", value: "00"},
  ]);
  try {
    expect(() => getDailyMidnight("en", "2026-01-02")).toThrow("Could not resolve Daily midnight.");
    expect(format).toHaveBeenCalledTimes(4);
  } finally {format.mockRestore();}
});

it("keeps the legacy UTC clock and supports the current-date default", () => {
  expect(getDailyTimeZone("UTC")).toBe("UTC");
  expect(getDailyDate("UTC")).toBe(new Date().toISOString().slice(0, 10));
});
