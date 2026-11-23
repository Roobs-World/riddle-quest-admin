import {describe, expect, it, jest} from "@jest/globals";
import type {HostMessageHandlers} from "../bridgeRouter";

/** All commands cross the same authority boundary after schema validation. */
const hostHandlers = (handler: () => void): HostMessageHandlers => ({
  ready: handler, resize: handler, loadRiddle: handler, submitGuess: handler, completeGame: handler,
  recordAchievements: handler, requestHint: handler, spendCoins: handler, skipRiddle: handler,
  requestPurchase: handler, loadLeaderboard: handler, updateUsername: handler, updateAvatar: handler,
  deleteAccount: handler, listRaceCategories: handler, readyRace: handler, startRace: handler,
  submitRaceGuess: handler, requestRaceHint: handler, skipRaceRiddle: handler, resumeRace: handler,
  abandonRace: handler, publishRace: handler, reserveRaceInvite: handler, getRaceEntry: handler,
  cancelRaceInvite: handler, getRaceChallenge: handler, getRaceOutcome: handler, listRaceInbox: handler,
  blockRival: handler, reportRival: handler, analytics: handler, error: handler,
});

describe("bridge dispatch ownership", () => {
  it("does not start a paid command after its account retires during cold parser loading", async () => {
    await jest.isolateModulesAsync(async () => {
      /** Fresh module has not yet loaded its shared validation chunk. */
      const {createHostMessageRouter} = await import("../bridgeRouter");
      /** Retired dispatch cannot reach any authority handler. */
      const handler = jest.fn<() => void>();
      /** Identity notification can precede parser delivery and React rendering. */
      let owned = true;
      /** Real schema parsing occurs after the originating account retires. */
      const pending = createHostMessageRouter(hostHandlers(handler))({type: "game:spendCoins", requestId: "continue-owned", payload: {amount: 100, reason: "continue", gameMode: "classic", riddleId: "classic_1", sessionToken: "00000000-0000-4000-8000-000000000001"}}, () => owned);
      owned = false;
      await pending;
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it("does not apply a host result after the game listener retires during cold parser loading", async () => {
    await jest.isolateModulesAsync(async () => {
      /** Independent cold router exercises host-to-game validation as well. */
      const {createGameMessageRouter} = await import("../bridgeRouter");
      /** No retired message may mutate the replacement game session. */
      const handler = jest.fn<() => void>();
      /** Effect cleanup retires a pending parser continuation. */
      let owned = true;
      /** A validated lifecycle message must still own its dispatch. */
      const pending = createGameMessageRouter({init: handler, authState: handler, riddleLoaded: handler, operationResult: handler, pause: handler, resume: handler})({type: "host:pause", requestId: "pause-owned", payload: {}}, () => owned);
      owned = false;
      await pending;
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it("dispatches warm validated commands immediately while still rejecting retired owners", async () => {
    await jest.isolateModulesAsync(async () => {
      /** Both directions share one successful parser load. */
      const {createHostMessageRouter, createGameMessageRouter} = await import("../bridgeRouter");
      /** Counts entry to actual host and game handlers, before their returned promises settle. */
      const handler = jest.fn<() => void>();
      /** Valid host command warms the shared parsers. */
      const host = createHostMessageRouter(hostHandlers(handler));
      /** Valid game result uses the same parser cache. */
      const game = createGameMessageRouter({init: handler, authState: handler, riddleLoaded: handler, operationResult: handler, pause: handler, resume: handler});
      await host({type: "game:resize", payload: {width: 390, height: 844}});
      handler.mockClear();
      /** Warm commands should enter their handlers before returning control to the caller. */
      const hostResult = host({type: "game:resize", payload: {width: 390, height: 800}}, () => true);
      expect(handler).toHaveBeenCalledTimes(1);
      /** Host-to-game handling also avoids an unnecessary resolved-promise await. */
      const gameResult = game({type: "host:resume", payload: {}}, () => true);
      expect(handler).toHaveBeenCalledTimes(2);
      await Promise.all([hostResult, gameResult]);
      await host({type: "game:resize", payload: {width: 390, height: 800}}, () => false);
      await game({type: "host:pause", payload: {}}, () => false);
      expect(handler).toHaveBeenCalledTimes(2);
      await expect(host({type: "game:spendCoins", payload: {reason: "invalid"}}, () => true)).rejects.toThrow();
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });
});
