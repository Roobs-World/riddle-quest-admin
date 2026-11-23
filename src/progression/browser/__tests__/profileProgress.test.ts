import {describe, expect, it} from "@jest/globals";
import type {BridgeProfile} from "../../../platform/bridge/messages";
import {getProfileProgress, getXpForLevel} from "../profileProgress";

/** Creates the minimum complete bridge profile needed by progression tests. */
const createProfile = (level: number, xp: number): BridgeProfile => ({
  userId: "player-profile",
  username: "Solver",
  coins: 0,
  xp,
  level,
  achievements: [],
  stats: {},
});

describe("profile progression", () => {
  it("calculates cumulative experience thresholds", () => {
    expect(getXpForLevel(0)).toBe(0);
    expect(getXpForLevel(1)).toBe(0);
    expect(getXpForLevel(2)).toBe(100);
    expect(getXpForLevel(3)).toBe(210);
  });

  it("provides a safe guest fallback", () => {
    expect(getProfileProgress(null)).toEqual({level: 1, xp: 0, percentage: 0});
  });

  it("derives and clamps progress within the current level", () => {
    expect(getProfileProgress(createProfile(2, 155))).toEqual({level: 2, xp: 155, percentage: 50});
    expect(getProfileProgress(createProfile(2, 50)).percentage).toBe(0);
    expect(getProfileProgress(createProfile(2, 500)).percentage).toBe(100);
  });
});
