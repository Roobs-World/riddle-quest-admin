import {describe, expect, it, jest} from "@jest/globals";
import type {FacebookInstantSdk, FacebookInstantTournament} from "../../fbinstant";
import {createFacebookSessionScore} from "../FacebookSessionScore";

const timestamp = Date.UTC(2026, 10, 27, 12);
const receipt = (overrides: Record<string, unknown> = {}) => ({
  tournamentId: "facebook-race10-en-2026-11-27", locale: "en", runId: "run-1",
  adjustedTimeMs: 60_000, completedAtMs: timestamp, improved: true,
  sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false, ...overrides,
});
const fixture = () => {
  const post = jest.fn<(score: number) => Promise<void>>(async () => undefined);
  const reconcile = jest.fn<() => Promise<void>>(async () => undefined);
  const getTournament = jest.fn<() => Promise<FacebookInstantTournament>>(async () => {throw {code: "TOURNAMENT_NOT_FOUND"};});
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined, startGameAsync: async () => undefined,
    setLoadingProgress: () => undefined, onPause: () => undefined,
    getSupportedAPIs: () => ["postSessionScoreAsync", "postSessionScore", "getTournamentAsync"],
    player: {getID: () => "test-player", getSignedPlayerInfoAsync: async () => {throw new Error("unused");},
      getDataAsync: async () => ({}), setDataAsync: async () => undefined, flushDataAsync: async () => undefined},
    context: {getID: () => null, getType: () => "SOLO", chooseAsync: async () => undefined},
    getTournamentAsync: getTournament, postSessionScoreAsync: post, postSessionScore: jest.fn(),
  };
  let active = true;
  const score = createFacebookSessionScore({sdk, isActive: () => active, canPresent: () => true,
    getLocale: () => "en", synchronizeContext: reconcile, now: () => timestamp})!;
  return {sdk, score, post, reconcile, getTournament, retireOwner: () => {active = false;}};
};

describe("Facebook session scoring", () => {
  it("uses the advertised synchronous alternative when asynchronous posting is unavailable", async () => {
    const {sdk, post, reconcile} = fixture();
    sdk.getSupportedAPIs = () => ["postSessionScore", "getTournamentAsync"];
    const score = createFacebookSessionScore({sdk, isActive: () => true, canPresent: () => true,
      getLocale: () => "en", synchronizeContext: reconcile, now: () => timestamp})!;
    score.record("run-1", receipt());
    await expect(score.publish()).resolves.toMatchObject({status: "success"});
    expect(sdk.postSessionScore).toHaveBeenCalledWith(240_000);
    expect(post).not.toHaveBeenCalled();
  });

  it("offers only an explicit verified-race score and deduplicates an admitted result", async () => {
    const {score, post, sdk, reconcile} = fixture();
    score.record("run-1", receipt());
    expect(score.getSnapshot()).toMatchObject({available: true, pending: false,
      privateAvailable: false, chooseGroupAvailable: false});
    expect(post).not.toHaveBeenCalled();
    await expect(score.publish()).resolves.toMatchObject({status: "success"});
    expect(post).toHaveBeenCalledWith(240_000);
    expect(sdk.postSessionScore).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledTimes(1);
    await expect(score.publish()).resolves.toMatchObject({status: "cancelled"});
    expect(post).toHaveBeenCalledTimes(1);
    score.record("run-2", receipt({runId: "run-2", adjustedTimeMs: 70_000}));
    expect(score.getSnapshot().available).toBe(false);
    score.record("run-3", receipt({runId: "run-3", adjustedTimeMs: 50_000}));
    await expect(score.publish()).resolves.toMatchObject({status: "success"});
    expect(post).toHaveBeenLastCalledWith(250_000);
  });

  it.each([
    {runId: "another-run"}, {locale: "fr"}, {completedAtMs: timestamp - 1},
    {completedAtMs: timestamp + 1}, {adjustedTimeMs: -1}, {coins: 100},
  ])("rejects a mismatched, stale or malformed receipt (%j)", overrides => {
    const {score, post} = fixture();
    score.record("run-1", receipt(overrides));
    expect(score.getSnapshot().available).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it.each(["native-tournament", "unconfirmed-absence"])("does not replace native time scoring when %s", async state => {
    const {score, getTournament, post} = fixture();
    if (state === "native-tournament") getTournament.mockResolvedValue({} as FacebookInstantTournament);
    else getTournament.mockRejectedValue({code: "NETWORK_FAILURE"});
    score.record("run-1", receipt());
    expect((await score.publish()).status).not.toBe("success");
    expect(post).not.toHaveBeenCalled();
  });

  it("reconciles an ambiguous native rejection without posting the same score again", async () => {
    const {score, post, reconcile} = fixture();
    post.mockRejectedValue(new Error("response lost after context mutation"));
    score.record("run-1", receipt());
    await expect(score.publish()).resolves.toMatchObject({status: "retryable-failure"});
    expect(reconcile).toHaveBeenCalledTimes(1);
    await score.publish();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each(["panel", "owner"])("cancels before admission when its %s retires during context discovery", async kind => {
    const {score, post, getTournament, retireOwner} = fixture();
    let reject!: (reason: unknown) => void;
    let started!: () => void;
    const discovering = new Promise<void>(resolve => {started = resolve;});
    getTournament.mockImplementation(() => {started(); return new Promise((_resolve, fail) => {reject = fail;});});
    score.record("run-1", receipt());
    const abort = new AbortController();
    const pending = score.publish(abort.signal);
    await discovering;
    if (kind === "panel") abort.abort(); else retireOwner();
    reject({code: "TOURNAMENT_NOT_FOUND"});
    expect((await pending).status).not.toBe("success");
    expect(post).not.toHaveBeenCalled();
    score.retire();
    expect(score.getSnapshot()).toMatchObject({available: false, pending: false,
      privateAvailable: false, chooseGroupAvailable: false});
  });
});
