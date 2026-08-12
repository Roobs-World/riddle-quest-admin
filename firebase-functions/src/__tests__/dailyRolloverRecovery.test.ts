import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

const mockRecoverPendingCompletion = jest.fn();
const mockGetUser = jest.fn();

jest.mock("../gameplay/firestoreService", () => ({getUser: (...args: unknown[]) => mockGetUser(...args)}));
jest.mock("../gameplay/singlePlayerTerminalRecovery", () => ({
  recoverPendingAuthoritativeCompletion: (...args: unknown[]) => mockRecoverPendingCompletion(...args),
}));

import {reconcilePreviousDailyBinding} from "../daily/dailyRolloverRecovery";

const initialUser = {lastDailyChallengeAttemptedKey: "2026-08-10"} as never;
const refreshedUser = {lastCompletedDailyChallengeKey: "2026-08-11"} as never;

describe("Daily rollover binding recovery", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T00:05:00.000Z"));
    jest.clearAllMocks();
    mockRecoverPendingCompletion.mockResolvedValue(true);
    mockGetUser.mockResolvedValue(refreshedUser);
  });

  afterEach(() => jest.useRealTimers());

  it("recovers yesterday's terminal win independently of the newly selected locale", async () => {
    await expect(reconcilePreviousDailyBinding("player-1", initialUser, false))
      .resolves.toBe(refreshedUser);
    expect(mockRecoverPendingCompletion).toHaveBeenCalledWith(
      "player-1",
      "challenge",
      "challenge:2026-08-11",
      false,
      new Date("2026-08-12T00:05:00.000Z"),
    );
  });

  it("does no recovery work outside the narrow rollover window", async () => {
    jest.setSystemTime(new Date("2026-08-12T00:16:00.000Z"));
    await expect(reconcilePreviousDailyBinding("player-1", initialUser, false))
      .resolves.toBe(initialUser);
    expect(mockRecoverPendingCompletion).not.toHaveBeenCalled();
  });
});
