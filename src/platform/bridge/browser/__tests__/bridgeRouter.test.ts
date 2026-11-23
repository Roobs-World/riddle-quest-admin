import {describe, expect, it, jest} from "@jest/globals";
import {BRIDGE_PROTOCOL_VERSION} from "../../constants";
import {createGameMessageRouter, createHostMessageRouter} from "../bridgeRouter";

describe("portal bridge routers", () => {
  it("routes game messages to host handlers", async () => {
    /** Loads riddle. */
    const loadRiddle = jest.fn();
    /** Typed invitation reads use their own command handler. */
    const getRaceEntry = jest.fn();
    /** Receipt-bearing creator cancellation uses a separate mutation handler. */
    const cancelRaceInvite = jest.fn();
    /** Provides router behavior. */
    const router = createHostMessageRouter({
      ready: jest.fn(),
      resize: jest.fn(),
      loadRiddle,
      submitGuess: jest.fn(),
      completeGame: jest.fn(),
      requestHint: jest.fn(),
      spendCoins: jest.fn(),
      requestPurchase: jest.fn(),
      loadLeaderboard: jest.fn(),
      updateUsername: jest.fn(),
      updateAvatar: jest.fn(),
      deleteAccount: jest.fn(),
      listRaceCategories: jest.fn(),
      startRace: jest.fn(),
      readyRace: jest.fn(),
      submitRaceGuess: jest.fn(),
      requestRaceHint: jest.fn(),
      skipRaceRiddle: jest.fn(),
      resumeRace: jest.fn(),
      abandonRace: jest.fn(),
      publishRace: jest.fn(),
      reserveRaceInvite: jest.fn(),
      getRaceEntry,
      cancelRaceInvite,
      getRaceChallenge: jest.fn(),
      getRaceOutcome: jest.fn(),
      listRaceInbox: jest.fn(),
      blockRival: jest.fn(),
      reportRival: jest.fn(),
      analytics: jest.fn(),
      error: jest.fn(),
    });

    await router({
      type: "game:loadRiddle",
      requestId: "load-1",
      payload: {
        gameMode: "classic",
        locale: "en",
        classicIndex: 2,
      },
    });

    expect(loadRiddle).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "game:loadRiddle",
        requestId: "load-1",
      }),
    );
    await router({type: "game:getRaceEntry", requestId: "read-seat", payload: {challengeId: "opaque-seat", locale: "en"}});
    await router({type: "game:cancelRaceInvite", requestId: "cancel-seat", payload: {challengeId: "opaque-seat", locale: "en", requestId: "cancel-seat"}});
    expect(getRaceEntry).toHaveBeenCalledWith(expect.objectContaining({type: "game:getRaceEntry", requestId: "read-seat"}));
    expect(cancelRaceInvite).toHaveBeenCalledWith(expect.objectContaining({type: "game:cancelRaceInvite", payload: {challengeId: "opaque-seat", locale: "en", requestId: "cancel-seat"}}));
  });

  it("routes host messages to the game session", async () => {
    /** Provides init behavior. */
    const init = jest.fn();
    /** Provides router behavior. */
    const router = createGameMessageRouter({
      init,
      authState: jest.fn(),
      riddleLoaded: jest.fn(),
      operationResult: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
    });

    await router({
      type: "host:init",
      requestId: "init-1",
      payload: {
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        sessionId: "session-1",
        locale: "en",
        user: null,
        profile: null,
        gameMode: "classic",
        products: [],
      },
    });

    expect(init).toHaveBeenCalledWith(expect.objectContaining({type: "host:init"}));
  });

  it("rejects invalid incoming envelopes", async () => {
    /** Provides router behavior. */
    const router = createHostMessageRouter({
      ready: jest.fn(),
      resize: jest.fn(),
      loadRiddle: jest.fn(),
      submitGuess: jest.fn(),
      completeGame: jest.fn(),
      requestHint: jest.fn(),
      spendCoins: jest.fn(),
      requestPurchase: jest.fn(),
      loadLeaderboard: jest.fn(),
      updateUsername: jest.fn(),
      updateAvatar: jest.fn(),
      deleteAccount: jest.fn(),
      listRaceCategories: jest.fn(),
      startRace: jest.fn(),
      readyRace: jest.fn(),
      submitRaceGuess: jest.fn(),
      requestRaceHint: jest.fn(),
      skipRaceRiddle: jest.fn(),
      resumeRace: jest.fn(),
      abandonRace: jest.fn(),
      publishRace: jest.fn(),
      reserveRaceInvite: jest.fn(),
      getRaceChallenge: jest.fn(),
      getRaceOutcome: jest.fn(),
      listRaceInbox: jest.fn(),
      blockRival: jest.fn(),
      reportRival: jest.fn(),
      analytics: jest.fn(),
      error: jest.fn(),
    });

    await expect(router({type: "game:spendCoins", payload: {reason: "magic"}})).rejects.toThrow();
  });

  it("routes schema-validated race requests with correlation IDs", async () => {
    /** Submits race guess. */
    const submitRaceGuess = jest.fn();
    /** Gets race challenge. */
    const getRaceChallenge = jest.fn();
    /** Provides router behavior. */
    const router = createHostMessageRouter({
      ready: jest.fn(),
      resize: jest.fn(),
      loadRiddle: jest.fn(),
      submitGuess: jest.fn(),
      completeGame: jest.fn(),
      requestHint: jest.fn(),
      spendCoins: jest.fn(),
      requestPurchase: jest.fn(),
      loadLeaderboard: jest.fn(),
      updateUsername: jest.fn(),
      updateAvatar: jest.fn(),
      deleteAccount: jest.fn(),
      listRaceCategories: jest.fn(),
      startRace: jest.fn(),
      readyRace: jest.fn(),
      submitRaceGuess,
      requestRaceHint: jest.fn(),
      skipRaceRiddle: jest.fn(),
      resumeRace: jest.fn(),
      abandonRace: jest.fn(),
      publishRace: jest.fn(),
      reserveRaceInvite: jest.fn(),
      getRaceChallenge,
      getRaceOutcome: jest.fn(),
      listRaceInbox: jest.fn(),
      blockRival: jest.fn(),
      reportRival: jest.fn(),
      analytics: jest.fn(),
      error: jest.fn(),
    });
    await router({
      type: "game:submitRaceGuess",
      requestId: "guess-message-1",
      payload: {runId: "run-1", riddleId: "riddle-1", guess: "piano", requestId: "guess-request-1"},
    });
    expect(submitRaceGuess).toHaveBeenCalledWith(expect.objectContaining({requestId: "guess-message-1"}));
    await router({
      type: "game:getRaceChallenge",
      requestId: "challenge-message-1",
      payload: {challengeId: "challenge-1", locale: "ja"},
    });
    expect(getRaceChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "challenge-message-1",
        payload: {challengeId: "challenge-1", locale: "ja"},
      }),
    );
    await expect(
      router({
        type: "game:getRaceChallenge",
        requestId: "missing-locale",
        payload: {challengeId: "challenge-1"},
      }),
    ).rejects.toThrow();
    await expect(
      router({
        type: "game:submitRaceGuess",
        requestId: "bad",
        payload: {runId: "run-1", riddleId: "riddle-1", guess: "", requestId: "short"},
      }),
    ).rejects.toThrow();
  });
});
