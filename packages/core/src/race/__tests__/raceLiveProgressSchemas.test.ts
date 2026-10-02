import {RACE_RULES, RaceRunViewSchema, type RaceRunView} from "../raceSchemas";
import {JoinLiveRaceSchema, UpdateLiveRaceSchema} from "../raceLiveSchemas";

/** Answer-free live view covers both current and supported legacy projections. */
const fixture = (position: number, correctCount: number): RaceRunView => ({runId: "live-progress", role: "creator", status: "active",
  categoryId: "history", locale: "en", rules: RACE_RULES, correctCount, wallElapsedMs: 0, totalPenaltyMs: 0,
  adjustedElapsedMs: 0, events: [], currentRiddle: {riddleId: "current", text: "A clue", answerLength: 4,
    position, guessesUsed: 0, guessesRemaining: RACE_RULES.maxGuessesPerRiddle, hintAvailable: true, revealedLetters: []}});

it.each([[0, 1], [2, 3], [9, 10], [10, 10]])("rejects impossible active question %i with cleared count %i", (position, correctCount) => {
  expect(RaceRunViewSchema.safeParse(fixture(position, correctCount)).success).toBe(false);
});
it.each([[0, 0], [4, 4], [9, 9], [4, 0], [4, 2]])("retains valid current and legacy live progress at question %i with count %i", (position, correctCount) => {
  expect(RaceRunViewSchema.safeParse(fixture(position, correctCount)).success).toBe(true);
});

it.each(["correctCount", "coins", "winner", "userId", "serverNowMs", "startsAtMs", "actionAvailableAtMs"])("rejects client authority for %s", field => {
  expect(UpdateLiveRaceSchema.safeParse({ticketId: "a".repeat(64), action: "poll", requestId: "untrusted-command", [field]: 10}).success).toBe(false);
});

it("does not let a lobby request choose its authenticated player identity", () => {
  expect(JoinLiveRaceSchema.safeParse({locale: "en", categoryId: "history", requestId: "untrusted-join", userId: "another-player"}).success).toBe(false);
});

it("permits withholding the first prompt during an unscored server countdown", () => {
  /** Both seats may receive only countdown metadata until their common start boundary. */
  const countdown = {...fixture(0, 0), status: "scheduled", currentRiddle: null, startsAtMs: 1000, serverNowMs: 999};
  expect(RaceRunViewSchema.safeParse(countdown).success).toBe(true);
  expect(RaceRunViewSchema.safeParse({...countdown, status: "prepared"}).success).toBe(false);
  expect(RaceRunViewSchema.safeParse({...countdown, serverNowMs: 1000}).success).toBe(false);
  for (const field of ["correctCount", "totalPenaltyMs", "wallElapsedMs", "adjustedElapsedMs"])
    expect(RaceRunViewSchema.safeParse({...countdown, [field]: 1}).success).toBe(false);
});
