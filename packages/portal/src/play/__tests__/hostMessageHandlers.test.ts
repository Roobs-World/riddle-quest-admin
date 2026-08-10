import {describe, expect, it, jest} from "@jest/globals";
import type {AuthSnapshot, HostServices} from "../types";
import {createFakeHostServices} from "../fakeServices";
import {createPlayHostMessageHandlers, getHostErrorMessage, type HostOperationName} from "../hostMessageHandlers";

const readAuthSnapshot = (services: HostServices): AuthSnapshot => {
  let snapshot: AuthSnapshot = {user: null, profile: null};
  const unsubscribe = services.auth.subscribe((next) => {
    snapshot = next;
  });
  unsubscribe();
  return snapshot;
};

const createHarness = (services = createFakeHostServices()) => {
  const postOperation = jest.fn(
    (_requestId: string | undefined, _operation: HostOperationName, _ok: boolean, _data?: unknown, _error?: string) =>
      undefined,
  );
  const runRaceOperation = jest.fn(
    async (_requestId: string | undefined, _operation: HostOperationName, action: () => Promise<unknown>) => {
      await action();
    },
  );
  const loadAndPostRiddle = jest.fn(async () => undefined);
  const syncRaceAchievementProgress = jest.fn(async () => undefined);
  const setFrameReady = jest.fn((_ready: boolean) => undefined);
  const setNotice = jest.fn((_notice: string) => undefined);
  const sendInit = jest.fn(() => undefined);
  const onPlayable = jest.fn(() => undefined);
  const applyPurchaseBalance = jest.fn(() => undefined);
  const loadedUserIdRef = {current: null as string | null};
  const playableReportedRef = {current: false};
  const withServerActivity = async <Result>(operation: () => Promise<Result>): Promise<Result> => operation();
  const handlers = createPlayHostMessageHandlers({
    authSnapshot: readAuthSnapshot(services),
    gameMode: "classic",
    locale: "en",
    services,
    loadedUserIdRef,
    playableReportedRef,
    setFrameReady,
    setNotice,
    sendInit,
    loadAndPostRiddle,
    postOperation,
    runRaceOperation,
    withServerActivity,
    applyPurchaseBalance,
    syncRaceAchievementProgress,
    onPlayable,
  });
  return {
    handlers,
    postOperation,
    runRaceOperation,
    loadAndPostRiddle,
    syncRaceAchievementProgress,
    setFrameReady,
    setNotice,
    sendInit,
    onPlayable,
    applyPurchaseBalance,
    loadedUserIdRef,
    playableReportedRef,
  };
};

describe("play host message handlers", () => {
  it("normalizes Firebase errors and unknown failures", () => {
    expect(getHostErrorMessage(new Error("Firebase: unavailable"))).toBe("unavailable");
    expect(getHostErrorMessage("unavailable")).toBe("An unexpected error occurred. Please try again.");
  });

  it("initializes an authenticated frame and reports playability once", async () => {
    const harness = createHarness();

    await harness.handlers.ready({
      type: "game:ready",
      requestId: "ready-1",
      payload: {protocolVersion: 1, surface: "html5"},
    });
    await harness.handlers.ready({
      type: "game:ready",
      requestId: "ready-2",
      payload: {protocolVersion: 1, surface: "html5"},
    });

    expect(harness.setFrameReady).toHaveBeenCalledTimes(2);
    expect(harness.sendInit).toHaveBeenCalledTimes(2);
    expect(harness.loadedUserIdRef.current).toBe("jest-guest");
    expect(harness.loadAndPostRiddle).toHaveBeenCalledWith({gameMode: "classic", locale: "en", classicIndex: 1});
    expect(harness.onPlayable).toHaveBeenCalledTimes(1);
  });

  it("posts authoritative hint success and sanitized failure outcomes", async () => {
    const services = createFakeHostServices();
    const requestHint = jest.spyOn(services, "requestHint");
    const harness = createHarness(services);
    const message = {
      type: "game:requestHint" as const,
      requestId: "hint-1",
      payload: {riddleId: "classic-fake-1", gameMode: "classic" as const, currentAttempt: ["", "", "", "", ""]},
    };

    await harness.handlers.requestHint(message);
    expect(harness.postOperation).toHaveBeenLastCalledWith("hint-1", "hint", true, expect.anything());

    requestHint.mockRejectedValueOnce(new Error("Firebase: hint unavailable"));
    await harness.handlers.requestHint(message);
    expect(harness.postOperation).toHaveBeenLastCalledWith("hint-1", "hint", false, undefined, "hint unavailable");
  });

  it("rejects daily-riddle skips before invoking the skip service", async () => {
    const services = createFakeHostServices();
    const skipRiddle = jest.spyOn(services, "skipRiddle");
    const harness = createHarness(services);

    await harness.handlers.spendCoins({
      type: "game:spendCoins",
      requestId: "skip-1",
      payload: {reason: "skip", riddleId: "daily-fake-1", gameMode: "challenge"},
    });

    expect(skipRiddle).not.toHaveBeenCalled();
    expect(harness.postOperation).toHaveBeenCalledWith(
      "skip-1",
      "skip",
      false,
      undefined,
      "Daily riddles cannot be skipped.",
    );
  });

  it("keeps race publication behind the race-operation and achievement boundaries", async () => {
    const services = createFakeHostServices();
    jest.spyOn(services, "publishRace").mockResolvedValue({
      challengeId: "challenge-1",
      preview: {
        challengeId: "challenge-1",
        creator: {displayName: "Guest Solver"},
        categoryId: "mixed",
        targetCorrect: 10,
        adjustedTimeToBeatMs: 60_000,
        rulesVersion: "race10_v1",
        expiresAtMs: Date.now() + 60_000,
        status: "active",
      },
      newlyUnlockedAchievementIds: [],
      achievementCoinsAwarded: 0,
    });
    const harness = createHarness(services);

    await harness.handlers.publishRace({
      type: "game:publishRace",
      requestId: "publish-message-1",
      payload: {runId: "run-1", requestId: "publish-request-1"},
    });

    expect(harness.runRaceOperation).toHaveBeenCalledWith("publish-message-1", "racePublish", expect.any(Function));
    expect(harness.syncRaceAchievementProgress).toHaveBeenCalledTimes(1);
  });
});
