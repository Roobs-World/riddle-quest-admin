import {facebookLaunchFromEntryData} from "../referrals";
import {facebookTournamentLocaleFromEntryData} from "../facebookTournamentEntry";

/** Current official UTC invitation window, independent of machine time. */
const start = Date.UTC(2026, 9, 1);
/** Native entry is a small presentation hint; scores are absent. */
const entry = {kind: "rq-race10-tournament-v1", locale: "fr", tournamentId: "facebook-race10-fr-2026-10-01",
  startsAtMs: start, endsAtMs: start + 86_400_000};

it("retains the legacy codec while ignoring tournament launches", () => {
  expect(facebookTournamentLocaleFromEntryData(entry, start)).toBe("fr");
  expect(facebookLaunchFromEntryData(entry)).toEqual({initialGameMode: "classic"});
});

it.each([null, [], {...entry, coins: 999}, {...entry, challengeId: "foreign"}, {...entry, startsAtMs: start + 1},
  {...entry, endsAtMs: entry.endsAtMs + 1}, {...entry, tournamentId: "native-provider-id"}, {...entry, locale: "xx"},
  {...entry, startsAtMs: "0"}, {...entry, endsAtMs: Number.MAX_SAFE_INTEGER}, {...entry, kind: "other"}])(
  "rejects malformed, forged or oversized native destination %j", value => {
    expect(facebookTournamentLocaleFromEntryData(value, start)).toBeUndefined();
  });

it("rejects expired/future hints and malformed native envelopes cannot become incoming challenges", () => {
  for (const clock of [start - 1, entry.endsAtMs, NaN, Infinity, start + 0.5]) {
    expect(facebookTournamentLocaleFromEntryData(entry, clock)).toBeUndefined();
  }
  expect(facebookLaunchFromEntryData({...entry, challengeId: "foreign"})).toEqual({initialGameMode: "classic"});
});
