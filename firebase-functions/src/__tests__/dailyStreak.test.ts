import {
  coerceToDate,
  computeNextDailyWinStreak,
  getUtcDayString,
  getYesterdayUtcDayString,
} from "../daily/dailyStreak";

describe("daily streak date normalization", () => {
  const date = new Date("2026-08-04T12:30:00.000Z");

  it.each([
    [null, null],
    [undefined, null],
    [date, date],
    [date.getTime(), date],
    [date.toISOString(), date],
    ["not-a-date", null],
    [true, null],
    [{}, null],
  ])("coerces %p", (input, expected) => {
    expect(coerceToDate(input)).toEqual(expected);
  });

  it("supports Firestore timestamp method variants", () => {
    expect(coerceToDate({toDate: () => date})).toEqual(date);
    expect(coerceToDate({toDate: () => new Date(Number.NaN)})).toBeNull();
    expect(coerceToDate({toMillis: () => date.getTime()})).toEqual(date);
    expect(coerceToDate({toMillis: () => Number.NaN})).toBeNull();
  });

  it("supports public and private Firestore timestamp fields", () => {
    expect(coerceToDate({seconds: 1, nanoseconds: 2_000_000})).toEqual(new Date(1002));
    expect(coerceToDate({_seconds: 2, _nanoseconds: 3_000_000})).toEqual(new Date(2003));
    expect(coerceToDate({seconds: 3})).toEqual(new Date(3000));
    expect(coerceToDate({seconds: Number.MAX_VALUE})).toBeNull();
  });

  it("derives UTC day boundaries", () => {
    expect(getUtcDayString(date)).toBe("2026-08-04");
    expect(getUtcDayString(null)).toBeNull();
    expect(getYesterdayUtcDayString(new Date("2026-08-01T00:00:00Z"))).toBe("2026-07-31");
    expect(getYesterdayUtcDayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("increments only for a completion on the previous UTC day", () => {
    const now = new Date("2026-08-04T01:00:00Z");
    expect(computeNextDailyWinStreak(4, "2026-08-03T23:59:00Z", now)).toBe(5);
    expect(computeNextDailyWinStreak(4, "2026-08-02T23:59:00Z", now)).toBe(1);
    expect(computeNextDailyWinStreak(4, "2026-08-03T23:59:00Z")).toBeGreaterThan(0);
  });
});
