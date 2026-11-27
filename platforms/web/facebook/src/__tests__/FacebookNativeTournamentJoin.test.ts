import {afterEach, describe, expect, it, jest} from "@jest/globals";
import type {FacebookInstantSdk, FacebookInstantTournament} from "../fbinstant";
import {createFacebookNativeSocial, type FacebookNativeSocial} from "../social/FacebookNativeSocial";

const START = Date.UTC(2026, 10, 27), END = START + 86_400_000;
const owners: FacebookNativeSocial[] = [];
afterEach(() => {owners.splice(0).forEach(owner => owner.retire()); jest.useRealTimers();});
const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Value>((done, fail) => {resolve = done; reject = fail;});
  return {promise, resolve, reject};
};

function fixture(locale = "fr") {
  let context: string | null = "lobby", active = true, now = START + 1000;
  let changed: (() => void) | undefined;
  const payload = {kind: "rq-race10-tournament-v1", locale, tournamentId: `facebook-race10-${locale}-2026-11-27`,
    startsAtMs: START, endsAtMs: END};
  const native: FacebookInstantTournament = {getID: () => "native-tournament", getContextID: () => "native-context",
    getEndTime: () => END / 1000, getTitle: () => "Official daily", getTournamentType: () => "DEFAULT",
    getPayload: () => JSON.stringify(payload)};
  const events: string[] = [];
  const getTournamentAsync = jest.fn<NonNullable<FacebookInstantSdk["getTournamentAsync"]>>(async () => {
    events.push("read"); return native;
  });
  const getTournamentsAsync = jest.fn<NonNullable<NonNullable<FacebookInstantSdk["tournament"]>["getTournamentsAsync"]>>(async () => [native]);
  const joinAsync = jest.fn<NonNullable<NonNullable<FacebookInstantSdk["tournament"]>["joinAsync"]>>(async () => {
    events.push("join"); context = "native-context";
  });
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined, startGameAsync: async () => undefined, setLoadingProgress: () => undefined,
    getSupportedAPIs: () => ["tournament.getTournamentsAsync", "tournament.joinAsync", "getTournamentAsync"],
    onPause: () => undefined,
    player: {getID: () => "player", getSignedPlayerInfoAsync: async () => {throw new Error("Unused");},
      getDataAsync: async () => ({}), setDataAsync: async () => undefined, flushDataAsync: async () => undefined},
    context: {getID: () => context, getType: () => context ? "GROUP" : "SOLO", chooseAsync: async () => undefined},
    tournament: {getTournamentsAsync, joinAsync, createAsync: async () => native,
      shareAsync: async () => undefined, postScoreAsync: async () => undefined},
    getTournamentAsync,
  };
  const synchronizeContext = jest.fn(async () => {events.push(`reconcile:${context}`);});
  const create = () => {
    const owner = createFacebookNativeSocial({sdk, isActive: () => active, synchronizeContext, now: () => now,
      onContextChange: listener => {changed = listener; return () => {changed = undefined;};}});
    if (!owner) throw new Error("Expected native social support");
    owners.push(owner); return owner;
  };
  return {sdk, native, payload, events, getTournamentAsync, getTournamentsAsync, joinAsync, synchronizeContext, create,
    setContext: (value: string) => {context = value; changed?.();}, retireAccount: () => {active = false;},
    setNow: (value: number) => {now = value;}};
}

describe("native tournament join destination", () => {
  it.each(["en", "fr"])("routes the recognized %s daily tournament only after context reconciliation", async locale => {
    const h = fixture(locale), owner = h.create();
    await owner.refresh();
    expect(await owner.joinTournament("native-tournament")).toEqual({status: "success", value: locale});
    expect(h.events).toEqual(["join", "reconcile:native-context", "read"]);
    expect(h.joinAsync).toHaveBeenCalledTimes(1);
  });

  it.each(["malformed", "extra-field", "expired", "private", "wrong-id", "wrong-context", "wrong-end"])(
    "never routes %s native metadata into an official board", async variant => {
      const h = fixture(), owner = h.create();
      await owner.refresh();
      if (variant === "malformed") h.native.getPayload = () => "{";
      if (variant === "extra-field") h.native.getPayload = () => JSON.stringify({...h.payload, coins: 500});
      if (variant === "expired") h.native.getPayload = () => JSON.stringify({...h.payload,
        tournamentId: "facebook-race10-fr-2026-11-26", startsAtMs: START - 86_400_000, endsAtMs: START});
      if (variant === "private") h.native.getTournamentType = () => "PRIVATE";
      if (variant === "wrong-id") h.native.getID = () => "replacement-tournament";
      if (variant === "wrong-context") h.native.getContextID = () => "replacement-context";
      if (variant === "wrong-end") h.native.getEndTime = () => END / 1000 + 1;
      expect(await owner.joinTournament("native-tournament")).toEqual({status: "success", value: undefined});
      expect(h.synchronizeContext).toHaveBeenCalledTimes(1);
    });

  it("routes from a fresh post-join list without calling an unadvertised current-tournament API", async () => {
    const h = fixture();
    h.sdk.getSupportedAPIs = () => ["tournament.getTournamentsAsync", "tournament.joinAsync"];
    const owner = h.create();
    await owner.refresh();
    h.getTournamentsAsync.mockResolvedValueOnce([{...h.native, getPayload: () => JSON.stringify({...h.payload,
      locale: "en", tournamentId: "facebook-race10-en-2026-11-27"})}]);
    expect(await owner.joinTournament("native-tournament")).toEqual({status: "success", value: "en"});
    expect(h.getTournamentAsync).not.toHaveBeenCalled();
    expect(h.getTournamentsAsync.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it.each(["missing", "wrong-context", "duplicate"])("does not route a %s fresh-list destination", async variant => {
    const h = fixture();
    h.sdk.getSupportedAPIs = () => ["tournament.getTournamentsAsync", "tournament.joinAsync"];
    const owner = h.create();
    await owner.refresh();
    h.getTournamentsAsync.mockResolvedValueOnce(variant === "missing" ? [] : variant === "duplicate" ? [h.native, h.native] :
      [{...h.native, getContextID: () => "other-context"}]);
    expect(await owner.joinTournament("native-tournament")).toEqual({status: "success", value: undefined});
    expect(h.getTournamentAsync).not.toHaveBeenCalled();
  });

  it.each(["panel", "context"])("retires a fresh-list destination when its %s changes during lookup", async retirement => {
    const h = fixture(), panel = new AbortController();
    h.sdk.getSupportedAPIs = () => ["tournament.getTournamentsAsync", "tournament.joinAsync"];
    const owner = h.create(), reading = deferred<void>(), metadata = deferred<FacebookInstantTournament[]>();
    await owner.refresh();
    h.getTournamentsAsync.mockImplementationOnce(() => {reading.resolve(); return metadata.promise;});
    const joining = owner.joinTournament("native-tournament", panel.signal);
    await reading.promise;
    if (retirement === "panel") panel.abort();
    else h.setContext("replacement-context");
    metadata.resolve([h.native]);
    expect(await joining).toEqual({status: "cancelled"});
    expect(h.synchronizeContext).toHaveBeenCalledTimes(1);
    expect(h.getTournamentAsync).not.toHaveBeenCalled();
  });

  it.each(["panel", "context", "account", "controller"])("suppresses routing when the %s retires during metadata lookup", async retirement => {
    const h = fixture(), owner = h.create(), panel = new AbortController();
    await owner.refresh();
    const reading = deferred<void>(), metadata = deferred<FacebookInstantTournament>();
    h.getTournamentAsync.mockImplementationOnce(() => {reading.resolve(); return metadata.promise;});
    const joining = owner.joinTournament("native-tournament", panel.signal);
    await reading.promise;
    if (retirement === "panel") panel.abort();
    if (retirement === "context") h.setContext("replacement-context");
    if (retirement === "account") h.retireAccount();
    if (retirement === "controller") owner.retire();
    metadata.resolve(h.native);
    expect(await joining).toEqual({status: "cancelled"});
    expect(h.synchronizeContext).toHaveBeenCalledTimes(1);
  });

  it("reconciles an admitted join after panel closure without reading or routing its metadata", async () => {
    const h = fixture(), owner = h.create(), panel = new AbortController();
    const started = deferred<void>(), mutation = deferred<void>();
    h.joinAsync.mockImplementationOnce(async () => {started.resolve(); await mutation.promise; h.setContext("native-context");});
    await owner.refresh();
    const joining = owner.joinTournament("native-tournament", panel.signal);
    await started.promise;
    panel.abort(); mutation.resolve();
    expect(await joining).toEqual({status: "cancelled"});
    expect(h.synchronizeContext).toHaveBeenCalledTimes(1);
    expect(h.getTournamentAsync).not.toHaveBeenCalled();
  });

  it("rejects a destination that expires while metadata is pending", async () => {
    const h = fixture(), owner = h.create();
    const reading = deferred<void>(), metadata = deferred<FacebookInstantTournament>();
    h.getTournamentAsync.mockImplementationOnce(() => {reading.resolve(); return metadata.promise;});
    await owner.refresh();
    const joining = owner.joinTournament("native-tournament");
    await reading.promise;
    h.setNow(END); metadata.resolve(h.native);
    expect(await joining).toEqual({status: "success", value: undefined});
  });

  it("retains the mutation lock through the destination read", async () => {
    const h = fixture(), owner = h.create(), reading = deferred<void>(), metadata = deferred<FacebookInstantTournament>();
    h.getTournamentAsync.mockImplementationOnce(() => {reading.resolve(); return metadata.promise;});
    await owner.refresh();
    const joining = owner.joinTournament("native-tournament");
    await reading.promise;
    expect(owner.getSnapshot().pending).toBe("join-tournament");
    expect(await owner.joinTournament("native-tournament")).toEqual({status: "unavailable", message: "facebook-native-social-unavailable"});
    metadata.resolve(h.native);
    expect(await joining).toEqual({status: "success", value: "fr"});
    expect(h.joinAsync).toHaveBeenCalledTimes(1);
  });

  it.each(["resolved", "rejected"])("retires a %s metadata read after context leaves and returns", async outcome => {
    const h = fixture(), owner = h.create(), reading = deferred<void>(), metadata = deferred<FacebookInstantTournament>();
    h.getTournamentAsync.mockImplementationOnce(() => {reading.resolve(); return metadata.promise;});
    await owner.refresh();
    const joining = owner.joinTournament("native-tournament");
    await reading.promise;
    h.setContext("different-context"); h.setContext("native-context");
    if (outcome === "resolved") metadata.resolve(h.native);
    else metadata.reject(new Error("Retired network response"));
    expect(await joining).toEqual({status: "cancelled"});
    expect(owner.getSnapshot().error).toBe(false);
  });

  it("bounds a silent metadata read without repeating the native join", async () => {
    jest.useFakeTimers();
    const h = fixture(), owner = h.create(), reading = deferred<void>(), metadata = deferred<FacebookInstantTournament>();
    h.getTournamentAsync.mockImplementationOnce(() => {reading.resolve(); return metadata.promise;});
    await owner.refresh();
    const joining = owner.joinTournament("native-tournament");
    await reading.promise;
    await jest.advanceTimersByTimeAsync(8000);
    expect(await joining).toEqual({status: "retryable-failure", message: "facebook-native-social-failed"});
    expect(owner.getSnapshot().pending).toBeNull();
    metadata.resolve(h.native);
    expect(h.joinAsync).toHaveBeenCalledTimes(1);
  });
});
