import {describe, expect, it} from "@jest/globals";
import {createRaceAnalyticsMessage} from "../logic/raceAnalytics";

describe("race analytics privacy", () => {
  it("keeps only the metric fields allowlisted for each event", () => {
    expect(
      createRaceAnalyticsMessage("race_completed", {
        result: "player_win",
        correctCount: 10,
        hintPenaltyMs: 15_000,
        skipPenaltyMs: 45_000,
        adjustedFinishMs: 91_000,
        guess: "secret answer",
        clue: "secret clue",
        token: "secret token",
        playerId: "direct identifier",
      }),
    ).toEqual({
      type: "game:analytics",
      requestId: expect.stringMatching(/^race-analytics-/),
      payload: {
        eventName: "race_completed",
        params: {
          result: "player_win",
          correctCount: 10,
          hintPenaltyMs: 15_000,
          skipPenaltyMs: 45_000,
          adjustedFinishMs: 91_000,
        },
      },
    });
  });
});
