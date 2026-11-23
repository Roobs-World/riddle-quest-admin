import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

/** Provides mock recover pending completion behavior. */
const mockRecoverPendingCompletion = jest.fn();
/** Provides mock get user behavior. */
const mockGetUser = jest.fn();

jest.mock("../gameplay/firestoreService", () => ({getUser: (...args: unknown[]) => mockGetUser(...args)}));
jest.mock("../gameplay/singlePlayerTerminalRecovery", () => ({
  recoverPendingAuthoritativeCompletion: (...args: unknown[]) => mockRecoverPendingCompletion(...args),
}));

import {reconcilePreviousDailyBinding} from "../daily/dailyRolloverRecovery";

/** Provides initial user behavior. */
const initialUser = {lastDailyChallengeAttemptedKey: "2026-08-10"} as never;
/** Provides refreshed user behavior. */
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
    await expect(reconcilePreviousDailyBinding("player-1", initialUser, false)).resolves.toBe(refreshedUser);
    expect(mockRecoverPendingCompletion).toHaveBeenCalledWith(
      "player-1",
      "challenge",
      "challenge:2026-08-11",
      false,
      new Date("2026-08-12T00:05:00.000Z"),
    );
  });

  it("recovers within London’s summer rollover window", async () => {
    jest.setSystemTime(new Date("2026-08-12T08:05:00Z"));
    await expect(reconcilePreviousDailyBinding("player-1", initialUser, false, "en")).resolves.toBe(refreshedUser);
    expect(mockRecoverPendingCompletion).toHaveBeenCalledWith("player-1", "challenge", "challenge:2026-08-11", false, new Date("2026-08-12T08:05:00Z"));
  });

  it("keeps an English pending win recoverable after switching to German at London 09:00", async () => {
    jest.setSystemTime(new Date("2026-08-12T08:05:00Z"));
    await expect(reconcilePreviousDailyBinding("player-1", initialUser, false, "de")).resolves.toBe(refreshedUser);
    expect(mockRecoverPendingCompletion).toHaveBeenCalledWith("player-1", "challenge", "challenge:2026-08-11", false, new Date("2026-08-12T08:05:00Z"));
  });

  it("does not grant a rollover completion when the saved authority rejects it", async () => {
    jest.setSystemTime(new Date("2026-08-12T00:16:00.000Z"));
    mockRecoverPendingCompletion.mockResolvedValue(false);
    await expect(reconcilePreviousDailyBinding("player-1", initialUser, false)).resolves.toBe(initialUser);
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
