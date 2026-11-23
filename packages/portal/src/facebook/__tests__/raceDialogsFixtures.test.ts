import {describe, expect, it, jest} from "@jest/globals";
import {RACE_CHALLENGE_TTL_MS} from "@riddle-quest/core/race";
import {parseFacebookContextBoardResponse} from "../facebookCallableResponses";
import {createRaceContextBoardFixture} from "./raceDialogs.jest-playwright.support";

describe("Facebook context standings fixtures", () => {
  it.each([2000, 4500, 9000, 27000])("preserves the exact server window with an advancing clock for %i ms standings", adjustedTimeMs => {
    const sampledNow = 1_700_000_000_000;
    let currentNow = sampledNow;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => currentNow++);
    try {
      const response = createRaceContextBoardFixture("fr", adjustedTimeMs);
      expect(parseFacebookContextBoardResponse(response)).toEqual(response);
      expect(response.startsAtMs).toBe(sampledNow - 1000);
      expect(response.endsAtMs).toBe(sampledNow - 1000 + RACE_CHALLENGE_TTL_MS);
      expect(response.standings).toEqual([{rank: 1, adjustedTimeMs, isCurrentPlayer: true}]);
      expect(response.currentPlayer).toEqual(response.standings[0]);
    } finally {
      clock.mockRestore();
    }
  });
});
