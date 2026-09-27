import {describe, expect, it, jest} from "@jest/globals";
import {HostToGameMessageSchema} from "@qwordly/core/bridge";
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
import {createHostAuthorityModules, type HostAuthorityModules} from "../HostAuthorityModules";

/** Reads auth snapshot. */
const readAuthSnapshot = (services: HostServices): AuthSnapshot => {
  /** Provides snapshot behavior. */
  let snapshot: AuthSnapshot = {user: null, profile: null};
  /** Provides unsubscribe behavior. */
  const unsubscribe = services.auth.subscribe((next) => {
    snapshot = next;
  });
  unsubscribe();
  return snapshot;
};

/** Creates harness. */
const createHarness = (
  services = createFakeHostServices(),
  onAccountDeleted?: () => void | Promise<void>,
  onAccountDeletionRequested?: () => void | Promise<void>,
  onAuthoritativeComplete?: () => void | Promise<void>,
  onAuthoritativeRaceResult?: (result: RaceOutcome) => void | Promise<void>,
  authority?: HostAuthorityModules,
) => {
  /** Provides post operation behavior. */
  const postOperation = jest.fn(
    (_requestId: string | undefined, _operation: HostOperationName, _ok: boolean, _data?: unknown, _error?: string) =>
      undefined,
  );
  /** Provides run race operation behavior. */
  const runRaceOperation = jest.fn(
    async (_requestId: string | undefined, _operation: HostOperationName, action: () => Promise<unknown>) => {
      await action();
    },
  );
  /** Loads and post riddle. */
  const loadAndPostRiddle = jest.fn(async () => true);
  /** Provides sync race achievement progress behavior. */
  const syncRaceAchievementProgress = jest.fn(async () => undefined);
  /** Persists a locally projected achievement. */
  const persistAchievementProjection = jest.fn((_achievementIds: string[]) => undefined);
  /** Sets frame ready. */
  const setFrameReady = jest.fn((_ready: boolean) => undefined);
  /** Sets notice. */
  const setNotice = jest.fn((_notice: string) => undefined);
  /** Sends init. */
  const sendInit = jest.fn(() => undefined);
  /** Provides on playable behavior. */
  const onPlayable = jest.fn(() => undefined);
  /** Applies purchase balance. */
  const applyPurchaseBalance = jest.fn(() => undefined);
  /** Loads ed user id ref. */
  const loadedUserIdRef = {current: null as string | null};
  /** Provides playable reported ref behavior. */
  const playableReportedRef = {current: false};
  /** Provides account deletion completed ref behavior. */
  const accountDeletionCompletedRef = {current: false};
  /** Records operations which block the whole game surface. */
  const activityCalls = jest.fn();
  /** Runs server activity. */
  const withServerActivity = async <Result>(operation: () => Promise<Result>): Promise<Result> => {
    activityCalls();
    return operation();
  };
  /** Handles rs. */
  const handlers = createPlayHostMessageHandlers({
    authSnapshot: readAuthSnapshot(services),
    gameMode: "classic",
    locale: "en",
    authority: authority ?? {
      identity: services,
      gameplay: services,
      leaderboard: services,
      economy: services,
      commerce: services,
      account: services,
      race: services,
    },
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
    persistAchievementProjection,
    onPlayable,
    onAuthoritativeComplete,
    onAuthoritativeRaceResult,
    onAccountDeleted,
    onAccountDeletionRequested,
    accountDeletionCompletedRef,
  });
  return {
    handlers,
    activityCalls,
    postOperation,
    runRaceOperation,
    loadAndPostRiddle,
    syncRaceAchievementProgress,
    persistAchievementProjection,
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
  it("persists projected achievements without starting a backend operation", () => {
    /** Host-side persistence seam under test. */
    const harness = createHarness();
    harness.handlers.recordAchievements({
      type: "game:recordAchievements",
      payload: {achievementIds: ["first_win", "perfect_guess"]},
    });
    expect(harness.persistAchievementProjection).toHaveBeenCalledWith(["first_win", "perfect_guess"]);
    expect(harness.postOperation).not.toHaveBeenCalled();
  });

  it("keeps guess confirmation outside global blocking activity", async () => {
    /** Host services with a deliberately stalled guess request. */
    const services = createFakeHostServices();
    /** Issued riddle for the request under test. */
    const riddle = await services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 1});
    /** Releases the simulated slow backend. */
    let release!: () => void;
    /** Request remains outstanding until after the interaction assertion. */
    const gate = new Promise<void>(resolve => { release = resolve; });
    /** Original authoritative fake scorer. */
    const submit = services.submitGuess.bind(services);
    services.submitGuess = async input => { await gate; return submit(input); };
    /** Real host handler and global activity recorder. */
    const harness = createHarness(services);
    /** Outstanding confirmation from the handler. */
    const pending = harness.handlers.submitGuess({type: "game:submitGuess", requestId: "pending-guess", payload: {
      riddleId: riddle.riddleId, gameMode: "classic", sessionToken: riddle.sessionToken,
      guess: "crane", requestId: "pending-guess",
    }});
    try {
      expect(harness.activityCalls).not.toHaveBeenCalled();
      expect(harness.postOperation).not.toHaveBeenCalled();
    } finally {
      release();
      await pending;
    }
    expect(harness.postOperation).toHaveBeenCalledWith("pending-guess", "guess", true, expect.objectContaining({isCorrect: false}));
  });

  it("normalizes Firebase errors and unknown failures", () => {
    expect(getHostErrorMessage(new Error("Firebase: unavailable"))).toBe("unavailable");
    expect(getHostErrorMessage("unavailable")).toBe("An unexpected error occurred. Please try again.");
    expect(getHostNoticeMessage("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE")).toBe(
      "Service temporarily unavailable. Please try again.",
    );
    expect(getHostNoticeMessage("Already rendered")).toBe("Already rendered");
  });

  it("does not expose bridge validation details from an incompatible backend response", () => {
    /** Provides validation error behavior. */
    let validationError: unknown;
    try {
      HostToGameMessageSchema.parse({
        type: "host:riddleLoaded",
        payload: {riddle: {riddleId: "classic-1", text: "A clue", gameMode: "classic"}},
      });
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(getHostErrorMessage(validationError)).toBe("An unexpected error occurred. Please try again.");
  });

  it("initializes an authenticated frame and reports playability once", async () => {
    /** Provides harness behavior. */
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
    /** Provides harness behavior. */
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
    /** Provides services behavior. */
    const services = createFakeHostServices();
    /** Requests hint. */
    const requestHint = jest.spyOn(services, "requestHint");
    /** Provides harness behavior. */
    const harness = createHarness(services);
    /** Provides message behavior. */
    const message = {
      type: "game:requestHint" as const,
      requestId: "hint-1",
      payload: {riddleId: "classic-fake-1", gameMode: "classic" as const, currentAttempt: ["", "", "", "", ""]},
    };

    await harness.handlers.requestHint(message);
    expect(harness.postOperation).toHaveBeenLastCalledWith("hint-1", "hint", true, expect.anything());

    requestHint.mockRejectedValueOnce(new Error("Firebase: hint unavailable"));
    await harness.handlers.requestHint(message);
    expect(harness.postOperation).toHaveBeenLastCalledWith("hint-1", "hint", false, undefined, "hint unavailable", "retryable");
  });

  it("delivers earned rewards before optional platform follow-up finishes", async () => {
    /** Captures services for this regression check. */
    const services = createFakeHostServices();
    jest.spyOn(services, "completeGame").mockResolvedValue({attempts: 2, isCorrect: true, coinsEarned: 50, newlyUnlockedAchievementIds: []});
    /** Captures finish for this regression check. */
    let finish!: () => void;
    /** Captures follow up for this regression check. */
    const followUp = new Promise<void>(resolve => { finish = resolve; });
    /** Captures harness for this regression check. */
    const harness = createHarness(services, undefined, undefined, () => followUp);
    /** Captures operation for this regression check. */
    const operation = harness.handlers.completeGame({type: "game:completeGame", requestId: "complete-fast", payload: {
      riddleId: "classic-fake-1", gameMode: "classic", sessionToken: "00000000-0000-4000-8000-000000000003",
    }});
    await new Promise(resolve => setImmediate(resolve));
    try {
      expect(harness.postOperation).toHaveBeenCalledWith("complete-fast", "completeGame", true, expect.objectContaining({coinsEarned: 50}));
    } finally {
      finish();
      await operation;
    }
  });

  it("delivers multiplayer outcomes without waiting for profile and notification follow-up", async () => {
    /** Authoritative response is ready while optional profile loading remains pending. */
    const services = createFakeHostServices();
    jest.spyOn(services, "getRaceOutcome").mockResolvedValue({
      runId: "run-1", result: "recorded", correctCount: 10, wallFinishMs: 40_000,
      hintPenaltyMs: 0, skipPenaltyMs: 0, totalPenaltyMs: 0, adjustedFinishMs: 40_000,
      publishable: true, rematchEligible: false, newlyUnlockedAchievementIds: [], achievementCoinsAwarded: 0,
    });
    /** Releases the delayed profile refresh after checking result delivery. */
    let finish!: () => void;
    /** Controlled profile latency independent of the outcome response. */
    const followUp = new Promise<void>(resolve => { finish = resolve; });
    /** Real host routing with a deliberately slow profile collaborator. */
    const harness = createHarness(services);
    harness.syncRaceAchievementProgress.mockImplementation(() => followUp.then(() => undefined));
    /** Whether the result has reached the host operation delivery boundary. */
    let delivered = false;
    /** In-flight result request exercised through the real handler. */
    const request = harness.handlers.getRaceOutcome({type: "game:getRaceOutcome", requestId: "outcome-fast", payload: {runId: "run-1"}}).then(() => { delivered = true; });
    await new Promise(resolve => setImmediate(resolve));
    try { expect(delivered).toBe(true); } finally { finish(); await request; }
  });

  it("notifies the platform only after authoritative single-player and race results", async () => {
    /** Provides services behavior. */
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
    /** Provides single player result behavior. */
    const singlePlayerResult = jest.fn(async () => undefined);
    /** Provides race result behavior. */
    const raceResult = jest.fn(async () => undefined);
    /** Provides harness behavior. */
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
    /** Provides services behavior. */
    const services = createFakeHostServices();
    /** Provides skip riddle behavior. */
    const skipRiddle = jest.spyOn(services, "skipRiddle");
    /** Provides harness behavior. */
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
      "retryable",
    );
  });

  it("keeps race publication behind the race-operation and achievement boundaries", async () => {
    /** Provides services behavior. */
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
    /** Provides harness behavior. */
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
    /** Provides services behavior. */
    const services = createFakeHostServices();
    /** Gets race challenge. */
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
    /** Provides harness behavior. */
    const harness = createHarness(services);

    await harness.handlers.getRaceChallenge({
      type: "game:getRaceChallenge",
      requestId: "challenge-message-1",
      payload: {challengeId: "challenge-1", locale: "fr"},
    });

    expect(getRaceChallenge).toHaveBeenCalledWith("challenge-1", "fr");
    expect(harness.runRaceOperation).toHaveBeenCalledWith("challenge-message-1", "raceChallenge", expect.any(Function));
  });

  it("routes block and categorized report actions through authenticated host services", async () => {
    /** Provides services behavior. */
    const services = createFakeHostServices();
    /** Provides block rival behavior. */
    const blockRival = jest.spyOn(services, "blockRival");
    /** Provides report rival behavior. */
    const reportRival = jest.spyOn(services, "reportRival");
    /** Provides harness behavior. */
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
    /** Provides services behavior. */
    const services = createFakeHostServices();
    jest.spyOn(services, "requestPurchase").mockResolvedValue({
      success: false,
      cancelled: true,
      productId: "coin-pack-1",
      purchaseType: "consumable",
    });
    /** Captures browser exception. */
    const captureBrowserException = jest
      .spyOn(browserErrorReporter, "captureBrowserException")
      .mockImplementation(() => undefined);
    /** Provides harness behavior. */
    const harness = createHarness(services);

    await harness.handlers.requestPurchase({
      type: "game:requestPurchase",
      requestId: "purchase-cancelled-1",
      payload: {productId: "coin-pack-1"},
    });

    expect(harness.postOperation).toHaveBeenCalledWith("purchase-cancelled-1", "purchase", true, {
      success: false,
      cancelled: true,
      productId: "coin-pack-1",
      purchaseType: "consumable",
    });
    expect(harness.applyPurchaseBalance).not.toHaveBeenCalled();
    expect(harness.setNotice).not.toHaveBeenCalled();
    expect(captureBrowserException).not.toHaveBeenCalled();
    captureBrowserException.mockRestore();
  });

  it("rejects unavailable deletion before closing the player's operation gate", async () => {
    /** Isolated game services for account-operation regression checks. */
    const services = createFakeHostServices();
    /** Records whether deletion preparation starts. */
    const requested = jest.fn();
    /** Records calls to the authoritative deletion service. */
    const deleted = jest.spyOn(services, "deleteAccount");
    /** Uses actual capability-shaped account authority. */
    const harness = createHarness(services, undefined, requested, undefined, undefined,
      createHostAuthorityModules(services, {}));
    await harness.handlers.deleteAccount({type: "game:deleteAccount", requestId: "denied", payload: {}});
    expect(requested).not.toHaveBeenCalled();
    expect(deleted).not.toHaveBeenCalled();
    expect(harness.postOperation).toHaveBeenCalledWith("denied", "accountDeletion", false, undefined,
      "host-account-capability-unavailable");
  });

  it("deletes a Facebook account through explicit account permissions without a Jest upgrade", async () => {
    /** Isolated game services for account-operation regression checks. */
    const services = createFakeHostServices();
    /** Records whether deletion preparation starts. */
    const requested = jest.fn();
    /** Records calls to the authoritative deletion service. */
    const deleted = jest.spyOn(services, "deleteAccount");
    /** Uses actual capability-shaped account authority. */
    const harness = createHarness(services, undefined, requested, undefined, undefined,
      createHostAuthorityModules(services, {accountManagement: {username: true, avatar: false, deletion: true}}));
    await harness.handlers.deleteAccount({type: "game:deleteAccount", requestId: "facebook", payload: {}});
    expect(requested).toHaveBeenCalledTimes(1);
    expect(deleted).toHaveBeenCalledTimes(1);
    expect(harness.postOperation).toHaveBeenCalledWith("facebook", "accountDeletion", true, {success: true});
  });

  it("reports account deletion as failed when post-server client cleanup must be retried", async () => {
    /** Provides services behavior. */
    const services = createFakeHostServices();
    /** Deletes account. */
    const deleteAccount = jest.spyOn(services, "deleteAccount").mockResolvedValue(undefined);
    /** Provides client cleanup behavior. */
    const clientCleanup = jest
      .fn()
      .mockRejectedValueOnce(new Error("Client cleanup unavailable"))
      .mockResolvedValueOnce(undefined);
    /** Provides harness behavior. */
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
    expect(harness.postOperation).toHaveBeenLastCalledWith("delete-account-retry", "accountDeletion", true, {
      success: true,
    });
  });

  it("durably records deletion intent before invoking the authoritative service", async () => {
    /** Provides order behavior. */
    const order: string[] = [];
    /** Provides services behavior. */
    const services = createFakeHostServices();
    /** Deletes account. */
    const deleteAccount = jest.spyOn(services, "deleteAccount").mockImplementation(async () => {
      order.push("server");
    });
    /** Requests ed. */
    const requested = jest.fn(() => {
      order.push("marker");
    });
    /** Provides cleanup behavior. */
    const cleanup = jest.fn(() => {
      order.push("cleanup");
    });
    /** Provides harness behavior. */
    const harness = createHarness(services, cleanup, requested);

    await harness.handlers.deleteAccount({
      type: "game:deleteAccount",
      requestId: "delete-account-ordered",
      payload: {},
    });

    expect(order).toEqual(["marker", "server", "cleanup"]);
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(harness.postOperation).toHaveBeenLastCalledWith("delete-account-ordered", "accountDeletion", true, {
      success: true,
    });
  });

  it("never starts server deletion when the durable intent marker cannot be verified", async () => {
    /** Provides services behavior. */
    const services = createFakeHostServices();
    /** Deletes account. */
    const deleteAccount = jest.spyOn(services, "deleteAccount");
    /** Provides harness behavior. */
    const harness = createHarness(services, jest.fn(), async () => {
      throw new Error("deletion marker unavailable");
    });

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
