import {RACE_RULES} from "@qwordly/core/race";
import {liveRun, advanceLiveBot, type LiveMatch} from "../../race/raceLiveState";
import {settleLiveFinish} from "../../race/raceLiveScoring";

/** Real run shape keeps completion clocks separate from current observation time. */
function fixture(): LiveMatch {
  /** Shared immutable deck metadata for two seats. */
  const base = {locale: "en" as const, categoryId: "history" as const, contentVersion: "test", riddles: []};
  /** Answer-free identity is identical across scoring scenarios. */
  const player = {displayName: "Player", avatarUrl: null, bot: false, correctCount: 0};
  return {tickets: ["a", "b"], startsAtMs: 1000, players: [player, player],
    runs: [liveRun(base, "a", "a", 1000), liveRun(base, "b", "b", 1000)]};
}

/** Installs an authoritative completed run, including hint and skip costs. */
function finish(match: LiveMatch, seat: number, wallFinishMs: number, hintPenaltyMs = 0, skipPenaltyMs = 0) {
  Object.assign(match.runs[seat]!, {status: "completed", correctCount: 10, wallFinishMs,
    finishedAtMs: match.startsAtMs + wallFinishMs, hintPenaltyMs, skipPenaltyMs});
}

it.each([0, 1])("keeps seat %s's rival racing for the full hint and skip penalty window", seat => {
  /** Two seats begin without a terminal winner. */
  const match = fixture();
  finish(match, seat, 30_000, 15_000, 45_000);
  expect(settleLiveFinish(match, 31_000)).toBe(false);
  expect(settleLiveFinish(match, 90_999)).toBe(false);
  expect(match.winner).toBeUndefined();
  expect(settleLiveFinish(match, 91_000)).toBe(true);
  expect(match.winner).toBe(seat);
  expect(settleLiveFinish(match, 92_000)).toBe(false);
});

it("subtracts the rival's own penalties from their remaining wall time", () => {
  /** Two seats begin without a terminal winner. */
  const match = fixture();
  finish(match, 0, 30_000, 15_000, 45_000);
  match.runs[1].hintPenaltyMs = 15_000;
  expect(settleLiveFinish(match, 75_999)).toBe(false);
  expect(settleLiveFinish(match, 76_000)).toBe(true);
  expect(match.winner).toBe(0);
});

it.each([[60_000, 1], [95_000, 0], [90_000, null]])("compares both adjusted finishes when the rival finishes at %sms", (wallMs, winner) => {
  /** Two seats begin without a terminal winner. */
  const match = fixture();
  finish(match, 0, 30_000, 15_000, 45_000);
  finish(match, 1, wallMs!);
  expect(settleLiveFinish(match, 100_000)).toBe(true);
  expect(match.winner).toBe(winner);
});

it("preserves immediate victory for an unpenalized finish", () => {
  /** Two seats begin without a terminal winner. */
  const match = fixture();
  finish(match, 0, 30_000);
  expect(settleLiveFinish(match, 31_000)).toBe(true);
  expect(match.winner).toBe(0);
});

it("keeps the full penalty window even when it crosses the normal unfinished-match timeout", () => {
  /** Two seats begin without a terminal winner. */
  const match = fixture();
  finish(match, 0, RACE_RULES.maxAdjustedTimeMs - 1000, 15_000);
  expect(settleLiveFinish(match, match.startsAtMs + RACE_RULES.maxAdjustedTimeMs)).toBe(false);
  expect(settleLiveFinish(match, match.startsAtMs + RACE_RULES.maxAdjustedTimeMs + 14_000)).toBe(true);
  expect(match.winner).toBe(0);
});

it("still times out an unfinished match without awarding a win", () => {
  /** Two seats begin without a terminal winner. */
  const match = fixture();
  expect(settleLiveFinish(match, match.startsAtMs + RACE_RULES.maxAdjustedTimeMs - 1)).toBe(false);
  expect(settleLiveFinish(match, match.startsAtMs + RACE_RULES.maxAdjustedTimeMs)).toBe(true);
  expect(match.winner).toBeNull();
});

it("lets the bot beat an earlier penalized human finish and records its exact scheduled time", () => {
  /** Two seats begin without a terminal winner. */
  const match = fixture();
  match.tickets[1] = null;
  finish(match, 0, 20_000, 0, 450_000);
  expect(settleLiveFinish(match, 21_000)).toBe(false);
  expect(advanceLiveBot(match, 200_000)).toBe(true);
  expect(match.runs[1]).toMatchObject({status: "completed", wallFinishMs: 120_000, finishedAtMs: 121_000});
  expect(settleLiveFinish(match, 200_000)).toBe(true);
  expect(match.winner).toBe(1);
});
