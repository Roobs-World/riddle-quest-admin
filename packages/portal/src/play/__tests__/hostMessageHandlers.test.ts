import {describe, expect, it, jest} from "@jest/globals";
import type {AuthSnapshot, HostServices} from "../types";
import type {RaceOutcome} from "@qwordly/core/race";
import {createFakeHostServices} from "../fakeServices";
import {
  createPlayHostMessageHandlers,
  getHostErrorMessage,
  getHostNoticeMessage,
  type HostOperationName,
} from "../hostMessageHandlers";
import * as browserErrorReporter from "../../observability/browserErrorReporter";

const readAuthSnapshot = (services: HostServices): AuthSnapshot => {
  let snapshot: AuthSnapshot = {user: null, profile: null};
  const unsubscribe = services.auth.subscribe((next) => {
    snapshot = next;
  });
  unsubscribe();
  return snapshot;
};

const createHarness = (
  services = createFakeHostServices(),
  onAccountDeleted?: () => void | Promise<void>,
  onAccountDeletionRequested?: () => void | Promise<void>,
  onAuthoritativeComplete?: () => void | Promise<void>,
  onAuthoritativeRaceResult?: (result: RaceOutcome) => void | Promise<void>,
) => {
  const postOperation = jest.fn(
    (_requestId: string | undefined, _operation: HostOperationName, _ok: boolean, _data?: unknown, _error?: string) =>
      undefined,
  );
  const runRaceOperation = jest.fn(
    async (_requestId: string | undefined, _operation: HostOperationName, action: () => Promise<unknown>) => {
      await action();
    },
  );
  const loadAndPostRiddle = jest.fn(async () => true);
  const syncRaceAchievementProgress = jest.fn(async () => undefined);
  const setFrameReady = jest.fn((_ready: boolean) => undefined);
  const setNotice = jest.fn((_notice: string) => undefined);
  const sendInit = jest.fn(() => undefined);
  const onPlayable = jest.fn(() => undefined);
  const applyPurchaseBalance = jest.fn(() => undefined);
  const loadedUserIdRef = {current: null as string | null};
  const playableReportedRef = {current: false};
  const accountDeletionCompletedRef = {current: false};
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
    onAuthoritativeComplete,
    onAuthoritativeRaceResult,
    onAccountDeleted,
    onAccountDeletionRequested,
    accountDeletionCompletedRef,
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
    accountDeletionCompletedRef,
  };
};

describe("play host message handlers", () => {
  it("normalizes Firebase errors and unknown failures", () => {
    expect(getHostErrorMessage(new Error("Firebase: unavailable"))).toBe("unavailable");
    expect(getHostErrorMessage("unavailable")).toBe("An unexpected error occurred. Please try again.");
    expect(getHostNoticeMessage("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"))
      .toBe("Service temporarily unavailable. Please try again.");
    expect(getHostNoticeMessage("Already rendered")).toBe("Already rendered");
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

  it("does not report playability when the first riddle fails to load", async () => {
    const harness = createHarness();
    harness.loadAndPostRiddle.mockResolvedValue(false);

    await harness.handlers.ready({
      type: "game:ready",
      requestId: "ready-failed-load",
      payload: {protocolVersion: 1, surface: "html5"},
    });

    expect(harness.onPlayable).not.toHaveBeenCalled();
    expect(harness.playableReportedRef.current).toBe(false);
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

  it("notifies the platform only after authoritative single-player and race results", async () => {
    const services = createFakeHostServices();
    jest.spyOn(services, "completeGame").mockResolvedValue({
      attempts: 2,
      isCorrect: true,
      coinsEarned: 50,
      newlyUnlockedAchievementIds: [],
    });
    jest.spyOn(services, "getRaceOutcome").mockResolvedValue({
      runId: "run-1",
      result: "player_win",
      correctCount: 10,
      wallFinishMs: 40_000,
      hintPenaltyMs: 0,
      skipPenaltyMs: 0,
      totalPenaltyMs: 0,
      adjustedFinishMs: 40_000,
      opponentAdjustedFinishMs: 50_000,
      publishable: false,
      rematchEligible: true,
      newlyUnlockedAchievementIds: [],
      achievementCoinsAwarded: 0,
    });
    const singlePlayerResult = jest.fn(async () => undefined);
    const raceResult = jest.fn(async () => undefined);
    const harness = createHarness(services, undefined, undefined, singlePlayerResult, raceResult);

    await harness.handlers.completeGame({
      type: "game:completeGame",
      requestId: "complete-1",
      payload: {
        riddleId: "classic-fake-1",
        gameMode: "classic",
        sessionToken: "00000000-0000-4000-8000-000000000003",
      },
    });
    await harness.handlers.getRaceOutcome({
      type: "game:getRaceOutcome",
      requestId: "race-outcome-1",
      payload: {runId: "run-1"},
    });

    expect(singlePlayerResult).toHaveBeenCalledTimes(1);
    expect(raceResult).toHaveBeenCalledWith(expect.objectContaining({result: "player_win", runId: "run-1"}));
  });

  it("reports a daily-riddle rejection through the dedicated skip service path", async () => {
    const services = createFakeHostServices();
    const skipRiddle = jest.spyOn(services, "skipRiddle");
    const harness = createHarness(services);

    await harness.handlers.skipRiddle({
      type: "game:skipRiddle",
      requestId: "skip-1",
      payload: {
        riddleId: "daily-fake-1",
        gameMode: "challenge",
        sessionToken: "00000000-0000-4000-8000-000000000003",
      },
    } as unknown as Parameters<typeof harness.handlers.skipRiddle>[0]);

    expect(skipRiddle).toHaveBeenCalledWith({
      riddleId: "daily-fake-1",
      gameMode: "challenge",
      sessionToken: "00000000-0000-4000-8000-000000000003",
      requestId: "skip-1",
    });
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
        locale: "en",
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

  it("forwards the locale boundary when loading a public challenge preview", async () => {
    const services = createFakeHostServices();
    const getRaceChallenge = jest.spyOn(services, "getRaceChallenge").mockResolvedValue({
      challengeId: "challenge-1",
      creator: {displayName: "Joueur invité"},
      categoryId: "mixed",
      locale: "fr",
      targetCorrect: 10,
      adjustedTimeToBeatMs: 60_000,
      rulesVersion: "race10_v1",
      expiresAtMs: Date.now() + 60_000,
      status: "active",
    });
    const harness = createHarness(services);

    await harness.handlers.getRaceChallenge({
      type: "game:getRaceChallenge",
      requestId: "challenge-message-1",
      payload: {challengeId: "challenge-1", locale: "fr"},
    });

    expect(getRaceChallenge).toHaveBeenCalledWith("challenge-1", "fr");
    expect(harness.runRaceOperation).toHaveBeenCalledWith(
      "challenge-message-1",
      "raceChallenge",
      expect.any(Function),
    );
  });

  it("routes block and categorized report actions through authenticated host services", async () => {
    const services = createFakeHostServices();
    const blockRival = jest.spyOn(services, "blockRival");
    const reportRival = jest.spyOn(services, "reportRival");
    const harness = createHarness(services);

    await harness.handlers.blockRival({
      type: "game:blockRival",
      requestId: "block-message-1",
      payload: {targetUserId: "facebook_1111111111111111111111111111111111111111"},
    });
    expect(blockRival).toHaveBeenCalledWith("facebook_1111111111111111111111111111111111111111");
    expect(harness.runRaceOperation).toHaveBeenCalledWith("block-message-1", "raceBlock", expect.any(Function));

    await harness.handlers.reportRival({
      type: "game:reportRival",
      requestId: "report-message-1",
      payload: {targetUserId: "jest_1111111111111111111111111111111111111111", category: "spam"},
    });
    expect(reportRival).toHaveBeenCalledWith({
      targetUserId: "jest_1111111111111111111111111111111111111111",
      category: "spam",
      requestId: "report-message-1",
    });
    expect(harness.runRaceOperation).toHaveBeenCalledWith("report-message-1", "raceReport", expect.any(Function));
  });

  it("resolves a cancelled checkout without errors, notices, grants, or balance changes", async () => {
    const services = createFakeHostServices();
    jest.spyOn(services, "requestPurchase").mockResolvedValue({
      success: false,
      cancelled: true,
      productId: "coin-pack-1",
      purchaseType: "consumable",
    });
    const captureBrowserException = jest.spyOn(browserErrorReporter, "captureBrowserException")
      .mockImplementation(() => undefined);
    const harness = createHarness(services);

    await harness.handlers.requestPurchase({
      type: "game:requestPurchase",
      requestId: "purchase-cancelled-1",
      payload: {productId: "coin-pack-1"},
    });

    expect(harness.postOperation).toHaveBeenCalledWith(
      "purchase-cancelled-1",
      "purchase",
      true,
      {
        success: false,
        cancelled: true,
        productId: "coin-pack-1",
        purchaseType: "consumable",
      },
    );
    expect(harness.applyPurchaseBalance).not.toHaveBeenCalled();
    expect(harness.setNotice).not.toHaveBeenCalled();
    expect(captureBrowserException).not.toHaveBeenCalled();
    captureBrowserException.mockRestore();
  });

  it("reports account deletion as failed when post-server client cleanup must be retried", async () => {
    const services = createFakeHostServices();
    const deleteAccount = jest.spyOn(services, "deleteAccount").mockResolvedValue(undefined);
    const clientCleanup = jest.fn()
      .mockRejectedValueOnce(new Error("Client cleanup unavailable"))
      .mockResolvedValueOnce(undefined);
    const harness = createHarness(services, clientCleanup);

    await harness.handlers.deleteAccount({
      type: "game:deleteAccount",
      requestId: "delete-account-1",
      payload: {},
    });

    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(clientCleanup).toHaveBeenCalledTimes(1);
    expect(harness.postOperation).toHaveBeenCalledWith(
      "delete-account-1",
      "accountDeletion",
      false,
      undefined,
      "Client cleanup unavailable",
    );
    expect(harness.postOperation).not.toHaveBeenCalledWith(
      "delete-account-1",
      "accountDeletion",
      true,
      expect.anything(),
    );

    await harness.handlers.deleteAccount({
      type: "game:deleteAccount",
      requestId: "delete-account-retry",
      payload: {},
    });
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(clientCleanup).toHaveBeenCalledTimes(2);
    expect(harness.postOperation).toHaveBeenLastCalledWith(
      "delete-account-retry",
      "accountDeletion",
      true,
      {success: true},
    );
  });

  it("durably records deletion intent before invoking the authoritative service", async () => {
    const order: string[] = [];
    const services = createFakeHostServices();
    const deleteAccount = jest.spyOn(services, "deleteAccount").mockImplementation(async () => {
      order.push("server");
    });
    const requested = jest.fn(() => { order.push("marker"); });
    const cleanup = jest.fn(() => { order.push("cleanup"); });
    const harness = createHarness(services, cleanup, requested);

    await harness.handlers.deleteAccount({
      type: "game:deleteAccount",
      requestId: "delete-account-ordered",
      payload: {},
    });

    expect(order).toEqual(["marker", "server", "cleanup"]);
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(harness.postOperation).toHaveBeenLastCalledWith(
      "delete-account-ordered",
      "accountDeletion",
      true,
      {success: true},
    );
  });

  it("never starts server deletion when the durable intent marker cannot be verified", async () => {
    const services = createFakeHostServices();
    const deleteAccount = jest.spyOn(services, "deleteAccount");
    const harness = createHarness(
      services,
      jest.fn(),
      async () => { throw new Error("deletion marker unavailable"); },
    );

    await harness.handlers.deleteAccount({
      type: "game:deleteAccount",
      requestId: "delete-account-unmarked",
      payload: {},
    });

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(harness.postOperation).toHaveBeenLastCalledWith(
      "delete-account-unmarked",
      "accountDeletion",
      false,
      undefined,
      "deletion marker unavailable",
    );
  });
});
