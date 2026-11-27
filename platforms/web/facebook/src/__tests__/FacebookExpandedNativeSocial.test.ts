import {afterEach, describe, expect, it, jest} from "@jest/globals";
import type {FacebookInstantSdk} from "../fbinstant";
import {createFacebookNativeSocial, type FacebookNativeSocial} from "../social/FacebookNativeSocial";

const deferred = <Value,>() => {
  let resolvePromise: ((value: Value) => void) | undefined;
  let rejectPromise: ((error: unknown) => void) | undefined;
  const promise = new Promise<Value>((resolve, reject) => {resolvePromise = resolve; rejectPromise = reject;});
  return {promise, resolve(value: Value) {
    if (!resolvePromise) throw new Error("Deferred promise is not initialized");
    resolvePromise(value);
  }, reject(error: unknown) {
    if (!rejectPromise) throw new Error("Deferred promise is not initialized");
    rejectPromise(error);
  }};
};

const NOW = Date.UTC(2026, 10, 27);
const supported = ["player.getConnectedPlayersAsync", "context.getPlayersAsync", "context.createAsync",
  "context.switchAsync", "tournament.getTournamentsAsync", "tournament.joinAsync", "room.getCurrentMatchAsync"];
const owners: FacebookNativeSocial[] = [];
afterEach(() => {owners.splice(0).forEach(owner => owner.retire());});

const fixture = (apis = supported, configure: (sdk: FacebookInstantSdk) => void = () => undefined) => {
  let contextId: string | null = "original-context";
  const reconciled: Array<string | null> = [];
  const room = {getID: () => "room-match", getContextID: () => "room-context"};
  const tournament = {getID: () => "tournament-one", getEndTime: () => NOW / 1000 + 600, getTitle: () => "Daily friends",
    getContextID: () => "tournament-context", getPayload: () => ({})};
  const getConnectedPlayersAsync = jest.fn<NonNullable<FacebookInstantSdk["player"]["getConnectedPlayersAsync"]>>(
    async () => [{getID: () => "friend-one"}, {getID: () => "friend-one"}, {getID: () => "friend-two"}],
  );
  const getCurrentMatchAsync = jest.fn<NonNullable<NonNullable<FacebookInstantSdk["room"]>["getCurrentMatchAsync"]>>(async () => room);
  const createAsync = jest.fn<NonNullable<NonNullable<FacebookInstantSdk["context"]>["createAsync"]>>(async () => {contextId = "created-context";});
  const switchAsync = jest.fn<NonNullable<NonNullable<FacebookInstantSdk["context"]>["switchAsync"]>>(async id => {contextId = id === "SOLO" ? null : id;});
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined, startGameAsync: async () => undefined,
    setLoadingProgress: () => undefined, getSupportedAPIs: () => apis, onPause: () => undefined,
    player: {
      getID: () => "native-social-player", getSignedPlayerInfoAsync: async () => {throw new Error("Unused identity exchange");},
      getDataAsync: async () => ({}), setDataAsync: async () => undefined, flushDataAsync: async () => undefined,
      getConnectedPlayersAsync,
    },
    context: {
      getID: () => contextId, getType: () => contextId ? "GROUP" : "SOLO", chooseAsync: async () => undefined,
      getPlayersAsync: async () => [{getID: () => "context-one"}], createAsync, switchAsync,
    },
    tournament: {
      getTournamentsAsync: async () => [tournament], joinAsync: async id => {contextId = id;},
      createAsync: async () => tournament, shareAsync: async () => undefined, postScoreAsync: async () => undefined,
    },
    room: {getCurrentMatchAsync},
  };
  configure(sdk);
  const owner = createFacebookNativeSocial({sdk, isActive: () => true,
    synchronizeContext: async () => {reconciled.push(contextId);}, now: () => NOW});
  if (!owner) throw new Error("Expected supported native social controller");
  owners.push(owner);
  return {owner, sdk, room, createAsync, switchAsync, getConnectedPlayersAsync, getCurrentMatchAsync, reconciled,
    getContext: () => contextId, setContext: (value: string | null) => {contextId = value;}};
};

describe("Facebook expanded native social actions", () => {
  it("never switches context when its panel aborts during the final room read", async () => {
    const harness = fixture();
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot().canJoinRoom).toBe(true);
    const read = deferred<typeof harness.room>();
    const started = deferred<void>();
    harness.getCurrentMatchAsync.mockImplementationOnce(() => {started.resolve(); return read.promise;});
    const panel = new AbortController();
    const joining = harness.owner.joinRoom(panel.signal);
    await started.promise;
    panel.abort();
    read.resolve(harness.room);
    expect(await joining).toEqual({status: "cancelled"});
    expect(harness.getContext()).toBe("original-context");
    expect(harness.reconciled).toEqual([]);
    expect(harness.switchAsync).not.toHaveBeenCalled();

    await harness.owner.refresh();
    expect(await harness.owner.joinRoom()).toEqual({status: "success", value: undefined});
    expect(harness.getContext()).toBe("room-context");
    expect(harness.reconciled).toEqual(["room-context"]);
  });

  it.each(["fulfilled", "rejected"])("reconciles an admitted context mutation after panel cancellation when the SDK %s", async outcome => {
    const harness = fixture(["context.createAsync"]);
    const mutation = deferred<void>();
    const started = deferred<void>();
    harness.createAsync.mockImplementationOnce(async () => {
      started.resolve();
      await mutation.promise;
      harness.setContext("created-after-cancellation");
      if (outcome === "rejected") throw new Error("Native callback rejected after changing context");
    });
    const panel = new AbortController();
    const creating = harness.owner.createContext(panel.signal);
    await started.promise;
    panel.abort();
    expect(harness.owner.getSnapshot().pending).toBe("create-context");
    mutation.resolve();
    expect(await creating).toEqual({status: "cancelled"});
    expect(harness.getContext()).toBe("created-after-cancellation");
    expect(harness.reconciled).toEqual(["created-after-cancellation"]);
    expect(harness.owner.getSnapshot().pending).toBeNull();
  });

  it("keeps connected-player discovery available without context, room or tournament APIs", async () => {
    const harness = fixture(["player.getConnectedPlayersAsync"], sdk => {
      delete sdk.context; delete sdk.room; delete sdk.tournament;
    });
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot()).toEqual({
      loading: false, pending: null, error: false, connectedPlayers: 2, contextPlayers: null,
      canCreateContext: false, canLeaveContext: false, canListTournaments: false, canJoinTournament: false,
      canJoinRoom: false, tournaments: [],
    });
    expect(await harness.owner.createContext()).toEqual({status: "unavailable", message: "facebook-native-social-unavailable"});
  });

  it("lists tournaments without join support and keeps other discovery after a connected-player failure", async () => {
    const harness = fixture(["player.getConnectedPlayersAsync", "tournament.getTournamentsAsync"]);
    harness.getConnectedPlayersAsync.mockRejectedValueOnce(new Error("Connections unavailable"));
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot()).toMatchObject({error: true, connectedPlayers: null,
      canListTournaments: true, canJoinTournament: false,
      tournaments: [{id: "tournament-one", title: "Daily friends", endsAtMs: NOW + 600_000}]});
    expect(await harness.owner.joinTournament("tournament-one")).toEqual({status: "unavailable", message: "facebook-native-social-unavailable"});
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot()).toMatchObject({error: false, connectedPlayers: 2,
      tournaments: [{id: "tournament-one", title: "Daily friends", endsAtMs: NOW + 600_000}]});
  });

  it("refuses a room destination that changed after discovery", async () => {
    const harness = fixture(["room.getCurrentMatchAsync", "context.switchAsync"]);
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot().canJoinRoom).toBe(true);
    harness.getCurrentMatchAsync.mockResolvedValueOnce({getID: () => "replacement-match", getContextID: () => "replacement-context"});
    expect(await harness.owner.joinRoom()).toEqual({status: "retryable-failure", message: "facebook-native-social-failed"});
    expect(harness.getContext()).toBe("original-context");
    expect(harness.reconciled).toEqual([]);
  });

  it("clears discovered actions and denies mutations after retirement", async () => {
    const harness = fixture();
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot()).toMatchObject({connectedPlayers: 2, canCreateContext: true, canJoinRoom: true});
    harness.owner.retire();
    expect(harness.owner.getSnapshot()).toEqual({loading: false, pending: null, error: false,
      connectedPlayers: null, contextPlayers: null, canCreateContext: false, canLeaveContext: false,
      canListTournaments: false, canJoinTournament: false, canJoinRoom: false, tournaments: []});
    expect(await harness.owner.createContext()).toEqual({status: "unavailable", message: "facebook-native-social-unavailable"});
    expect(harness.getContext()).toBe("original-context");
  });
});
