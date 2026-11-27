import {describe, expect, it, jest} from "@jest/globals";
import type {RaceLocale} from "../../../../../../src/races/contracts/index";
import type {FacebookInstantSdk, FacebookInstantTournament} from "../../fbinstant";
import {registerFacebookSdkDialogGuard, runFacebookSdkDialog} from "../../FacebookSdkDialogGate";
import {createFacebookSessionScore} from "../FacebookSessionScore";

const timestamp = Date.UTC(2026, 10, 27, 12);
const receipt = (runId = "run-1", adjustedTimeMs = 60_000) => ({
  tournamentId: "facebook-race10-en-2026-11-27", locale: "en", runId,
  adjustedTimeMs, completedAtMs: timestamp, improved: true, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
});
const tournament = (id = "private-1", overrides: Partial<FacebookInstantTournament> = {}): FacebookInstantTournament => ({
  getID: () => id, getContextID: () => `context-${id}`, getEndTime: () => timestamp / 1000 + 86400,
  getTournamentType: () => "PRIVATE", getPayload: () => JSON.stringify({kind: "rq-race10-points-v1", locale: "en"}), ...overrides,
});
const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>(done => {resolve = done;});
  return {promise, resolve};
};
const fixture = ({enabled = true, supported: advertised}: {enabled?: boolean; supported?: string[]} = {}) => {
  let context: string | null = "group-1", type: "SOLO" | "THREAD" | "GROUP" | "POST" = "THREAD";
  let native: FacebookInstantTournament | undefined, active = true, locale: RaceLocale = "en", contextListener = () => undefined;
  const stopContext = jest.fn(), reconcile = jest.fn<() => Promise<void>>(async () => undefined);
  const post = jest.fn<(score: number) => Promise<void>>(async () => undefined);
  const getTournament = jest.fn<() => Promise<FacebookInstantTournament>>(async () => {
    if (native) return native;
    throw {code: "TOURNAMENT_NOT_FOUND"};
  });
  const getTournaments = jest.fn<() => Promise<FacebookInstantTournament[]>>(async () => native ? [native] : []);
  const create = jest.fn<NonNullable<NonNullable<FacebookInstantSdk["tournament"]>["createPrivateAsync"]>>(async () => {
    native = tournament(); context = native.getContextID(); return native;
  });
  const choose = jest.fn<NonNullable<FacebookInstantSdk["context"]>["chooseAsync"]>(async () => {context = "group-2"; type = "THREAD"; native = undefined;});
  const supported = ["postSessionScoreAsync", "getTournamentAsync", "tournament.createPrivateAsync", "tournament.getTournamentsAsync", "context.chooseAsync"];
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined, startGameAsync: async () => undefined,
    setLoadingProgress: () => undefined, onPause: () => undefined,
    getSupportedAPIs: () => advertised ?? supported,
    player: {getID: () => "test-player", getSignedPlayerInfoAsync: async () => {throw new Error("unused");},
      getDataAsync: async () => ({}), setDataAsync: async () => undefined, flushDataAsync: async () => undefined},
    context: {getID: () => context, getType: () => type, chooseAsync: choose},
    getTournamentAsync: getTournament, postSessionScoreAsync: post,
    tournament: {createPrivateAsync: create, getTournamentsAsync: getTournaments},
  };
  const make = () => createFacebookSessionScore({sdk, isActive: () => active, canPresent: () => true, getLocale: () => locale,
    synchronizeContext: reconcile, now: () => timestamp, privateTournamentsEnabled: enabled,
    onContextChange: listener => {contextListener = listener; return stopContext;}})!;
  const score = make();
  score.record("run-1", receipt());
  return {score, sdk, make, create, post, choose, reconcile, getTournament, getTournaments, stopContext,
    emit: () => contextListener(), retireOwner: () => {active = false;}, setLocale: (value: RaceLocale) => {locale = value;},
    move: (value: FacebookInstantTournament | undefined, nextContext: string | null = value?.getContextID() ?? null,
      nextType: typeof type = "THREAD") => {native = value; context = nextContext; type = nextType;}};
};

describe("Facebook private race-points tournaments", () => {
  it("remains disabled without explicit release configuration", async () => {
    const {score, create, choose, post, move} = fixture({enabled: false});
    expect(score.getSnapshot()).toMatchObject({privateAvailable: false, chooseGroupAvailable: false});
    await score.startPrivateTournament({chooseGroup: true});
    move(tournament());
    await score.publish();
    expect(create).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled();
  });

  it("requires independently advertised and callable creation and chooser methods", async () => {
    const value = fixture({supported: ["postSessionScoreAsync", "getTournamentAsync", "context.chooseAsync"]});
    await value.score.startPrivateTournament({chooseGroup: true});
    expect(value.create).not.toHaveBeenCalled(); expect(value.choose).not.toHaveBeenCalled();
    const noMethod = fixture();
    noMethod.sdk.tournament = {};
    const score = noMethod.make(); score.record("run-1", receipt());
    expect(score.getSnapshot()).toMatchObject({privateAvailable: false, chooseGroupAvailable: false});
    const noChooser = fixture({supported: ["postSessionScoreAsync", "getTournamentAsync", "tournament.createPrivateAsync"]});
    expect(noChooser.score.getSnapshot()).toMatchObject({privateAvailable: true, chooseGroupAvailable: false});
    await noChooser.score.startPrivateTournament({chooseGroup: true});
    expect(noChooser.create).not.toHaveBeenCalled();
  });

  it("creates in an existing THREAD group with authoritative points and records the initial score once", async () => {
    const {score, create, choose, post, reconcile} = fixture();
    expect(create).not.toHaveBeenCalled();
    await expect(score.startPrivateTournament()).resolves.toMatchObject({status: "success"});
    expect(create).toHaveBeenCalledWith({initialScore: 240_000, data: {kind: "rq-race10-points-v1", locale: "en"}});
    expect(choose).not.toHaveBeenCalled(); expect(reconcile).toHaveBeenCalledTimes(1);
    await score.publish(); await score.startPrivateTournament();
    expect(create).toHaveBeenCalledTimes(1); expect(post).not.toHaveBeenCalled();
    score.record("run-2", receipt("run-2", 50_000));
    await expect(score.publish()).resolves.toMatchObject({status: "success"});
    expect(post).toHaveBeenCalledWith(250_000);
  });

  it("awaits the explicit group picker before creation, using the documented size hint", async () => {
    const value = fixture(), choice = deferred<void>();
    value.move(undefined, null, "SOLO");
    value.choose.mockImplementation(async options => {expect(options).toEqual({minSize: 3}); await choice.promise; value.move(undefined, "chosen-group");});
    const pending = value.score.startPrivateTournament({chooseGroup: true});
    expect(value.choose).toHaveBeenCalledWith({minSize: 3}); expect(value.create).not.toHaveBeenCalled();
    choice.resolve();
    await expect(pending).resolves.toMatchObject({status: "success"});
    expect(value.create).toHaveBeenCalledTimes(1); expect(value.reconcile).toHaveBeenCalledTimes(2);
  });

  it.each(["surface", "account", "locale"])("does not create after %s changes while the picker is open", async reason => {
    const value = fixture(), choice = deferred<void>(), surface = new AbortController();
    value.choose.mockImplementation(() => choice.promise);
    const pending = value.score.startPrivateTournament({chooseGroup: true, signal: surface.signal});
    if (reason === "surface") surface.abort();
    else if (reason === "account") value.retireOwner();
    else value.setLocale("fr");
    choice.resolve();
    await expect(pending).resolves.toMatchObject({status: "cancelled"});
    expect(value.create).not.toHaveBeenCalled();
    expect(value.reconcile).toHaveBeenCalledTimes(reason === "account" ? 0 : 1);
    expect(value.score.getSnapshot().pending).toBe(false);
  });

  it("reconciles a rejected picker and does not create or classify it as a creation failure", async () => {
    const value = fixture(); value.choose.mockRejectedValue({code: "USER_INPUT"});
    await expect(value.score.startPrivateTournament({chooseGroup: true})).resolves.toMatchObject({status: "cancelled"});
    expect(value.reconcile).toHaveBeenCalledTimes(1); expect(value.create).not.toHaveBeenCalled();
    expect(value.score.getSnapshot().privateOutcome).toBeNull();
  });

  it.each(["existing", "unconfirmed", "picker-selected-tournament"])("does not create when the selected context is %s", async reason => {
    const value = fixture();
    if (reason === "unconfirmed") value.getTournament.mockRejectedValue({code: "NETWORK_FAILURE"});
    else if (reason === "existing") value.move(tournament());
    else value.choose.mockImplementation(async () => {value.move(tournament());});
    await value.score.startPrivateTournament({chooseGroup: reason === "picker-selected-tournament"});
    expect(value.create).not.toHaveBeenCalled();
  });

  it.each([
    {getTournamentType: () => "DEFAULT" as const},
    {getPayload: () => JSON.stringify({kind: "rq-race10-tournament-v1", locale: "en"})},
    {getPayload: () => JSON.stringify({kind: "rq-race10-points-v1", locale: "fr"})},
    {getPayload: () => JSON.stringify({kind: "rq-race10-points-v1", locale: "en", extra: true})},
    {getPayload: () => "invalid"}, {getPayload: () => "x".repeat(1001)},
    {getEndTime: () => timestamp / 1000}, {getEndTime: () => Number.NaN},
    {getID: () => "invalid id"}, {getContextID: () => "other-context"},
  ])("rejects a private score destination with incompatible or malformed metadata (%j)", async overrides => {
    const value = fixture(); value.move(tournament("private-1", overrides), "context-private-1");
    await value.score.publish(); expect(value.post).not.toHaveBeenCalled();
  });

  it("deduplicates per tournament while a context event makes the same verified result available in a new tournament", async () => {
    const value = fixture();
    await value.score.publish(); expect(value.post).toHaveBeenCalledTimes(1);
    value.move(tournament("private-1")); value.emit();
    expect(value.score.getSnapshot().available).toBe(true);
    await value.score.refresh(); await value.score.publish(); await value.score.publish();
    expect(value.post).toHaveBeenCalledTimes(2);
    value.move(tournament("private-2")); await value.score.refresh(); await value.score.publish();
    expect(value.post).toHaveBeenCalledTimes(3);
    value.move(tournament("private-1")); await value.score.refresh(); await value.score.publish();
    expect(value.post).toHaveBeenCalledTimes(3);
    value.score.retire(); expect(value.stopContext).toHaveBeenCalledTimes(1);
  });

  it("marks a created or joined incompatible tournament and never follows it with a points update", async () => {
    const value = fixture(), foreign = tournament("foreign", {getPayload: () => JSON.stringify({kind: "another-game-mode", locale: "en"})});
    value.create.mockImplementation(async () => {value.move(foreign); return foreign;});
    await expect(value.score.startPrivateTournament()).resolves.toMatchObject({status: "unavailable"});
    expect(value.score.getSnapshot().privateOutcome).toBe("incompatible");
    value.score.record("run-2", receipt("run-2", 40_000));
    await value.score.publish(); expect(value.post).not.toHaveBeenCalled();
  });

  it.each(["TOURNAMENT_SCORE_REJECTED", "NETWORK_FAILURE", "RATE_LIMITED"])("inspects state after %s and never blindly retries group creation", async code => {
    const value = fixture(); value.create.mockRejectedValue({code});
    await expect(value.score.startPrivateTournament()).resolves.toMatchObject({status: "unavailable"});
    expect(value.reconcile).toHaveBeenCalledTimes(1); expect(value.getTournaments).toHaveBeenCalledTimes(1);
    expect(value.score.getSnapshot()).toMatchObject({privateAvailable: false, privateOutcome: "uncertain"});
    value.score.record("run-2", receipt("run-2", 40_000));
    await value.score.startPrivateTournament();
    expect(value.create).toHaveBeenCalledTimes(1); expect(value.post).not.toHaveBeenCalled();
  });

  it("remembers an ambiguous initial score when creation rejected after switching context", async () => {
    const value = fixture();
    value.create.mockImplementation(async () => {value.move(tournament()); throw {code: "NETWORK_FAILURE"};});
    await value.score.startPrivateTournament(); await value.score.publish();
    expect(value.getTournaments).toHaveBeenCalledTimes(1); expect(value.post).not.toHaveBeenCalled();
    expect(value.score.getSnapshot().privateOutcome).toBe("uncertain");
  });

  it.each(["This game is not enabled for private tournament creation.", "Private tournament creation is not available for this player."])("hides creation for the session after access denial: %s", async message => {
    const value = fixture(); value.create.mockRejectedValue({code: "INVALID_OPERATION", message});
    await value.score.startPrivateTournament();
    expect(value.score.getSnapshot()).toMatchObject({privateAvailable: false, chooseGroupAvailable: false});
    value.move(undefined, "different-group"); await value.score.startPrivateTournament();
    expect(value.create).toHaveBeenCalledTimes(1);
  });

  it("shares the provider dialog gate and admits no private mutation while another dialog owns it", async () => {
    const value = fixture(), release = deferred<void>();
    const occupied = runFacebookSdkDialog(value.sdk, async () => {await release.promise; return {status: "success", value: undefined};});
    await expect(value.score.startPrivateTournament({chooseGroup: true})).resolves.toMatchObject({status: "unavailable"});
    expect(value.choose).not.toHaveBeenCalled(); expect(value.create).not.toHaveBeenCalled();
    release.resolve(); await occupied;
    await expect(value.score.startPrivateTournament()).resolves.toMatchObject({status: "success"});
  });

  it("abandons stale tournament discovery after a context switch before creation", async () => {
    const value = fixture(), discovery = deferred<FacebookInstantTournament>();
    value.getTournament.mockReturnValue(discovery.promise);
    const pending = value.score.startPrivateTournament();
    value.move(undefined, "another-group");
    discovery.resolve(tournament());
    await pending; expect(value.create).not.toHaveBeenCalled();
  });

  it.each(["score", "private"])("does not redirect a %s action while waiting for another native surface to hide", async action => {
    const value = fixture(), hidden = deferred<void>();
    const unregister = registerFacebookSdkDialogGuard(value.sdk, {beforeOpen: () => hidden.promise, afterClose: () => undefined});
    const pending = action === "score" ? value.score.publish() : value.score.startPrivateTournament();
    value.move(undefined, "unselected-group"); hidden.resolve();
    await expect(pending).resolves.toMatchObject({status: "cancelled"});
    expect(value.create).not.toHaveBeenCalled(); expect(value.post).not.toHaveBeenCalled(); unregister();
  });

  it("keeps creation bound to the chosen group while context reconciliation is pending", async () => {
    const value = fixture(), reconciling = deferred<void>(), finished = deferred<void>();
    value.reconcile.mockImplementation(async () => {reconciling.resolve(); await finished.promise;});
    const pending = value.score.startPrivateTournament({chooseGroup: true});
    await reconciling.promise;
    value.move(undefined, "unselected-group"); finished.resolve();
    await expect(pending).resolves.toMatchObject({status: "cancelled"});
    expect(value.create).not.toHaveBeenCalled();
  });

  it("does not consume a receipt in a different tournament entered during post reconciliation", async () => {
    const value = fixture();
    value.post.mockImplementationOnce(async () => {value.move(tournament("posted-tournament"));});
    value.reconcile.mockImplementationOnce(async () => {value.move(tournament("unrelated-tournament"));});
    await value.score.publish();
    await expect(value.score.publish()).resolves.toMatchObject({status: "success"});
    expect(value.post).toHaveBeenCalledTimes(2);
  });

  it("does not consume a receipt in a tournament entered during uncertain-creation list discovery", async () => {
    const value = fixture(), listing = deferred<void>(), listed = deferred<FacebookInstantTournament[]>();
    value.create.mockRejectedValue({code: "NETWORK_FAILURE"});
    value.getTournaments.mockImplementation(async () => {listing.resolve(); return listed.promise;});
    const pending = value.score.startPrivateTournament();
    await listing.promise;
    const unrelated = tournament("unrelated-tournament"); value.move(unrelated); listed.resolve([unrelated]);
    await pending;
    await expect(value.score.publish()).resolves.toMatchObject({status: "success"});
    expect(value.post).toHaveBeenCalledTimes(1);
  });

  it("preserves an uncertain outcome after a blocked retry and scopes its message to the affected context", async () => {
    const value = fixture(); value.create.mockRejectedValue({code: "NETWORK_FAILURE"});
    await value.score.startPrivateTournament(); await value.score.startPrivateTournament();
    expect(value.score.getSnapshot().privateOutcome).toBe("uncertain");
    value.move(undefined, "other-group"); await value.score.refresh();
    expect(value.score.getSnapshot().privateOutcome).toBeNull();
  });
});
