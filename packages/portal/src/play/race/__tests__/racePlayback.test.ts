import {describe, expect, it} from "@jest/globals";
import type {RaceOpponent} from "@qwordly/core/race";
import {getGhostCorrectCount} from "../logic/racePlayback";

/** Provides opponent behavior. */
const opponent: RaceOpponent = {
  displayName: "Recorded Rival",
  adjustedFinishMs: 60_000,
  events: [
    {
      sequence: 0,
      type: "correct",
      riddlePosition: 0,
      wallElapsedMs: 10_000,
      penaltyAddedMs: 0,
      totalPenaltyMs: 0,
      adjustedElapsedMs: 10_000,
      correctCount: 1,
    },
    {
      sequence: 1,
      type: "hint",
      riddlePosition: 1,
      wallElapsedMs: 15_000,
      penaltyAddedMs: 15_000,
      totalPenaltyMs: 15_000,
      adjustedElapsedMs: 30_000,
      correctCount: 1,
    },
    {
      sequence: 2,
      type: "correct",
      riddlePosition: 1,
      wallElapsedMs: 17_000,
      penaltyAddedMs: 0,
      totalPenaltyMs: 15_000,
      adjustedElapsedMs: 32_000,
      correctCount: 2,
    },
  ],
};

describe("getGhostCorrectCount", () => {
  it("replays manual and automatic skips at their penalized authoritative milestone", () => {
    /** A skipped riddle counts toward progress exactly as it does on the authority. */
    const skipped: RaceOpponent = {...opponent, adjustedFinishMs: 120_000, events: [{
      sequence: 0, type: "skip", riddlePosition: 0, wallElapsedMs: 1_000,
      penaltyAddedMs: 45_000, totalPenaltyMs: 45_000, adjustedElapsedMs: 46_000, correctCount: 1,
    }]};
    expect(getGhostCorrectCount(skipped, 45_999)).toBe(0);
    expect(getGhostCorrectCount(skipped, 46_000)).toBe(1);
    expect(getGhostCorrectCount(skipped, 80_000)).toBe(1);
  });
  it("uses cumulative progress rather than array order or the number of events", () => {
    /** A restored timeline may contain duplicated or reordered milestones. */
    const restored: RaceOpponent = {...opponent, events: [opponent.events[2], opponent.events[2], opponent.events[0], opponent.events[1]]};
    expect(getGhostCorrectCount(restored, 10_000)).toBe(1);
    expect(getGhostCorrectCount(restored, 32_000)).toBe(2);
    expect(getGhostCorrectCount({...restored, events: restored.events.toReversed()}, 32_000)).toBe(2);
    expect(getGhostCorrectCount(opponent, 30_000)).toBe(1);
  });
  it("replays milestones against authoritative adjusted time", () => {
    expect(getGhostCorrectCount(opponent, 9_999)).toBe(0);
    expect(getGhostCorrectCount(opponent, 10_000)).toBe(1);
    expect(getGhostCorrectCount(opponent, 32_000)).toBe(2);
  });

  it("catches up deterministically after slow frames, backgrounding, or penalty jumps", () => {
    expect(getGhostCorrectCount(opponent, 5_000 + 45_000)).toBe(2);
    expect(getGhostCorrectCount(opponent, 60_000)).toBe(10);
    expect(getGhostCorrectCount(undefined, 300_000)).toBe(0);
  });
});
