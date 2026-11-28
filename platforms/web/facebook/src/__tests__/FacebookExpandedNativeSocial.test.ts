import {afterEach, describe, expect, it, jest} from "@jest/globals";
import type {FacebookInstantSdk} from "../fbinstant";
import {createFacebookNativeSocial, type FacebookNativeSocial} from "../social/FacebookNativeSocial";

const deferred = <Value,>() => {
  let resolvePromise: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>(resolve => {resolvePromise = resolve;});
  return {promise, resolve(value: Value) {
    if (!resolvePromise) throw new Error("Deferred promise is not initialized");
    resolvePromise(value);
  }};
};

const supported = ["context.switchAsync", "room.getCurrentMatchAsync"];
const owners: FacebookNativeSocial[] = [];
afterEach(() => {owners.splice(0).forEach(owner => owner.retire()); jest.useRealTimers();});

const fixture = (apis = supported) => {
  let contextId: string | null = "original-context", active = true;
  let contextListener: (() => void) | undefined;
  const reconciled: Array<string | null> = [];
  const room = {getID: () => "room-match", getContextID: () => "room-context"};
  const getCurrentMatchAsync = jest.fn<NonNullable<NonNullable<FacebookInstantSdk["room"]>["getCurrentMatchAsync"]>>(async () => room);
  const switchAsync = jest.fn<NonNullable<NonNullable<FacebookInstantSdk["context"]>["switchAsync"]>>(async id => {contextId = id === "SOLO" ? null : id;});
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined, startGameAsync: async () => undefined,
    setLoadingProgress: () => undefined, getSupportedAPIs: () => apis, onPause: () => undefined,
    player: {
      getID: () => "native-social-player", getSignedPlayerInfoAsync: async () => {throw new Error("Unused identity exchange");},
      getDataAsync: async () => ({}), setDataAsync: async () => undefined, flushDataAsync: async () => undefined,
    },
    context: {getID: () => contextId, getType: () => contextId ? "GROUP" : "SOLO", chooseAsync: async () => undefined, switchAsync},
    room: {getCurrentMatchAsync},
  };
  const owner = createFacebookNativeSocial({sdk, isActive: () => active,
    synchronizeContext: async () => {reconciled.push(contextId);},
    onContextChange: listener => {contextListener = listener; return () => {contextListener = undefined;};}});
  if (!owner) throw new Error("Expected supported native social controller");
  owners.push(owner);
  return {owner, sdk, room, switchAsync, getCurrentMatchAsync, reconciled,
    getContext: () => contextId, setContext: (value: string | null) => {contextId = value;},
    deactivate: () => {active = false;}, changeContext: (value: string | null) => {contextId = value; contextListener?.();}};
};

describe("Facebook native room and solo actions", () => {
  it("leaves the current context through the native API and reconciles solo membership", async () => {
    const harness = fixture(["context.switchAsync"]);
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot()).toMatchObject({canLeaveContext: true, canJoinRoom: false});
    expect(await harness.owner.leaveContext()).toEqual({status: "success", value: undefined});
    expect(harness.switchAsync.mock.calls).toEqual([["SOLO"]]);
    expect(harness.getContext()).toBeNull();
    expect(harness.reconciled).toEqual([null]);
    expect(await harness.owner.leaveContext()).toEqual({status: "unavailable", message: "facebook-native-social-unavailable"});
  });

  it("keeps transient context-switch failures retryable", async () => {
    const harness = fixture(["context.switchAsync"]);
    harness.switchAsync.mockRejectedValueOnce(new Error("Network unavailable"));
    expect(await harness.owner.leaveContext()).toEqual({status: "retryable-failure", message: "facebook-native-social-failed"});
    expect(await harness.owner.leaveContext()).toEqual({status: "success", value: undefined});
    expect(harness.getContext()).toBeNull();
    expect(harness.reconciled).toEqual(["original-context", null]);
  });

  it("never switches context when its view aborts during the final room read", async () => {
    const harness = fixture();
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot().canJoinRoom).toBe(true);
    const read = deferred<typeof harness.room>(), started = deferred<void>();
    harness.getCurrentMatchAsync.mockImplementationOnce(() => {started.resolve(); return read.promise;});
    const view = new AbortController();
    const joining = harness.owner.joinRoom(view.signal);
    await started.promise;
    view.abort();
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

  it.each(["fulfilled", "rejected"])("reconciles an admitted context switch after view cancellation when the SDK %s", async outcome => {
    const harness = fixture(["context.switchAsync"]);
    const mutation = deferred<void>(), started = deferred<void>();
    harness.switchAsync.mockImplementationOnce(async () => {
      started.resolve();
      await mutation.promise;
      harness.setContext(null);
      if (outcome === "rejected") throw new Error("Native callback rejected after changing context");
    });
    const view = new AbortController();
    const leaving = harness.owner.leaveContext(view.signal);
    await started.promise;
    view.abort();
    expect(harness.owner.getSnapshot().pending).toBe("leave-context");
    mutation.resolve();
    expect(await leaving).toEqual({status: "cancelled"});
    expect(harness.getContext()).toBeNull();
    expect(harness.reconciled).toEqual([null]);
    expect(harness.owner.getSnapshot().pending).toBeNull();
  });

  it("requires an advertised context switch before offering room or solo actions", () => {
    const harness = fixture();
    harness.sdk.getSupportedAPIs = () => ["room.getCurrentMatchAsync", "context.createAsync", "tournament.getTournamentsAsync"];
    expect(createFacebookNativeSocial({sdk: harness.sdk, isActive: () => true, synchronizeContext: async () => undefined})).toBeUndefined();
  });

  it("treats no current room as unavailable without reporting an error", async () => {
    const harness = fixture();
    harness.getCurrentMatchAsync.mockRejectedValueOnce({code: "LIVE_MATCH_NOT_FOUND"});
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot()).toMatchObject({loading: false, error: false, canJoinRoom: false, canLeaveContext: true});
    expect(await harness.owner.joinRoom()).toEqual({status: "unavailable", message: "facebook-native-social-unavailable"});
    expect(harness.switchAsync).not.toHaveBeenCalled();
  });

  it("bounds room discovery and preserves the independently available solo action", async () => {
    jest.useFakeTimers();
    const harness = fixture();
    harness.getCurrentMatchAsync.mockReturnValueOnce(new Promise(() => undefined));
    const reading = harness.owner.refresh();
    await jest.advanceTimersByTimeAsync(8000);
    await reading;
    expect(harness.owner.getSnapshot()).toMatchObject({loading: false, error: true, canJoinRoom: false, canLeaveContext: true});
    expect(await harness.owner.leaveContext()).toEqual({status: "success", value: undefined});
    expect(harness.reconciled).toEqual([null]);
  });

  it("refuses a room destination that changed after discovery", async () => {
    const harness = fixture();
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot().canJoinRoom).toBe(true);
    harness.getCurrentMatchAsync.mockResolvedValueOnce({getID: () => "replacement-match", getContextID: () => "replacement-context"});
    expect(await harness.owner.joinRoom()).toEqual({status: "retryable-failure", message: "facebook-native-social-failed"});
    expect(harness.getContext()).toBe("original-context");
    expect(harness.reconciled).toEqual([]);
  });

  it("invalidates room discovery when the native context changes", async () => {
    const harness = fixture();
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot().canJoinRoom).toBe(true);
    harness.changeContext("room-context");
    expect(harness.owner.getSnapshot().canJoinRoom).toBe(false);
    await harness.owner.refresh();
    expect(harness.owner.getSnapshot()).toMatchObject({canJoinRoom: false, canLeaveContext: true});
  });

  it("does not let a stale room read repopulate a retired account", async () => {
    const harness = fixture(), read = deferred<typeof harness.room>();
    harness.getCurrentMatchAsync.mockReturnValueOnce(read.promise);
    const reading = harness.owner.refresh();
    harness.owner.retire();
    read.resolve(harness.room);
    await reading;
    expect(harness.owner.getSnapshot()).toEqual({loading: false, pending: null, error: false, canLeaveContext: false, canJoinRoom: false});
    expect(await harness.owner.leaveContext()).toEqual({status: "unavailable", message: "facebook-native-social-unavailable"});
    expect(await harness.owner.joinRoom()).toEqual({status: "unavailable", message: "facebook-native-social-unavailable"});
    expect(harness.switchAsync).not.toHaveBeenCalled();
  });

  it("does not reconcile a completed native action into a replacement account", async () => {
    const harness = fixture(), mutation = deferred<void>(), started = deferred<void>();
    harness.switchAsync.mockImplementationOnce(() => {started.resolve(); return mutation.promise;});
    const leaving = harness.owner.leaveContext();
    await started.promise;
    harness.deactivate();
    mutation.resolve();
    expect(await leaving).toEqual({status: "cancelled"});
    expect(harness.reconciled).toEqual([]);
  });
});
