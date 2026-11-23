import {describe, expect, it} from "@jest/globals";
import {paginateLeaderboard} from "../leaderboardPagination";

describe("leaderboard pagination", () => {
  it("returns a stable empty first page", () => {
    expect(paginateLeaderboard([], 0)).toEqual({
      activePage: 0,
      pageCount: 1,
      pageStart: 0,
      visibleEntries: [],
    });
  });

  it("returns the requested entry slice", () => {
    /** Deterministic entry identifiers spanning three pages. */
    const entries = Array.from({length: 23}, (_, index) => `player-${index + 1}`);
    expect(paginateLeaderboard(entries, 1)).toEqual({
      activePage: 1,
      pageCount: 3,
      pageStart: 10,
      visibleEntries: entries.slice(10, 20),
    });
  });

  it("clamps invalid pages and page sizes", () => {
    /** Small fixture used to exercise both ends of the page range. */
    const entries = ["one", "two", "three"];
    expect(paginateLeaderboard(entries, -10, 0).activePage).toBe(0);
    expect(paginateLeaderboard(entries, 99, 2)).toMatchObject({
      activePage: 1,
      pageCount: 2,
      pageStart: 2,
      visibleEntries: ["three"],
    });
  });
});
