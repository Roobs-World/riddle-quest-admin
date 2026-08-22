import {describe, expect, test} from "@jest/globals";
import type {FacebookInstantSdk} from "../fbinstant";
import {FacebookPlatformBootstrap} from "../FacebookPlatformBootstrap";

const createSdk = () => {
  const events: string[] = [];
  const data: Record<string, unknown> = {
    riddleQuestPreferences: {locale: "fr", muted: true, presenceEnabled: true, ignored: "discarded"},
    riddleQuestPlayerState: {schemaVersion: 1, updatedAt: 42},
  };
  let pause: (() => void) | undefined;
  const sdk: FacebookInstantSdk = {
    async initializeAsync() { events.push("initialize"); },
    setLoadingProgress(progress) { events.push(`progress:${progress}`); },
    async startGameAsync() { events.push("start"); },
    getSupportedAPIs() { return []; },
    onPause(callback) { pause = callback; },
    player: {
      getID() { events.push("player"); return "facebook-player-1"; },
      async getSignedPlayerInfoAsync() { throw new Error("not-used"); },
      async getDataAsync(keys) {
        events.push(`read:${keys.join(",")}`);
        return Object.fromEntries(keys.map((key) => [key, data[key]]));
      },
      async setDataAsync(update) {
        events.push(`write:${Object.keys(update).sort().join(",")}`);
        Object.assign(data, update);
      },
      async flushDataAsync() { events.push("flush"); },
    },
  };
  return {sdk, events, data, pause: () => pause?.()};
};

describe("FacebookPlatformBootstrap", () => {
  test("owns initialization ordering and exposes only supported capabilities", async () => {
    const harness = createSdk();
    const reported: number[] = [];
    const result = await new FacebookPlatformBootstrap(() => harness.sdk).initialize((value) => reported.push(value));
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(harness.events).toEqual([
      "initialize",
      "progress:30",
      "player",
      "read:riddleQuestPreferences",
      "progress:70",
      "start",
      "progress:100",
    ]);
    expect(reported).toEqual([30, 70, 100]);
    expect(result.value.platform).toBe("facebook");
    expect(result.value.capabilities.lifecycle).toBeDefined();
    expect(result.value.capabilities.accountUpgrade).toBeUndefined();
    expect(result.value.capabilities.commerce).toBeUndefined();
    expect(result.value.capabilities.ads).toBeUndefined();
    expect(result.value.capabilities.notifications).toBeUndefined();
    expect(result.value.capabilities.sharing).toBeUndefined();
    expect(result.value.capabilities.nativeSocial).toBeUndefined();
    expect(result.value.capabilities.overlay).toBeUndefined();
  });

  test("normalizes asynchronous storage and flushes critical clears", async () => {
    const harness = createSdk();
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    await expect(result.value.storage.readPreferences()).resolves.toEqual({
      locale: "fr", muted: true, presenceEnabled: true,
    });
    await expect(result.value.storage.readPlayerData()).resolves.toEqual({schemaVersion: 1, updatedAt: 42});
    await result.value.storage.writePreferences({locale: "ar"});
    await result.value.storage.clear();
    expect(harness.data.riddleQuestPreferences).toBeNull();
    expect(harness.data.riddleQuestPlayerState).toBeNull();
    expect(harness.events.at(-1)).toBe("flush");
  });

  test("orders pause-time flushes after in-flight writes and preserves recovery after failure", async () => {
    const harness = createSdk();
    let releaseWrite!: () => void;
    harness.sdk.player.setDataAsync = jest.fn(async (update) => {
      harness.events.push(`write-start:${Object.keys(update).join(",")}`);
      await new Promise<void>((resolve) => { releaseWrite = resolve; });
      Object.assign(harness.data, update);
      harness.events.push("write-end");
    });
    const result = await new FacebookPlatformBootstrap(() => harness.sdk).initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    const write = result.value.storage.writePreferences({locale: "ja"});
    await Promise.resolve();
    const flush = result.value.storage.flush();
    expect(harness.events).not.toContain("flush");
    releaseWrite();
    await Promise.all([write, flush]);
    expect(harness.events.slice(-3)).toEqual([
      "write-start:riddleQuestPreferences",
      "write-end",
      "flush",
    ]);

    harness.sdk.player.setDataAsync = jest.fn(async () => { throw new Error("cloud-write-failed"); });
    await expect(result.value.storage.writePreferences({locale: "ko"})).rejects.toThrow("cloud-write-failed");
    await expect(result.value.storage.flush()).resolves.toBeUndefined();
    expect(harness.events.at(-1)).toBe("flush");
  });

  test("rejects invalid player-state clocks and strips untrusted cloud fields", async () => {
    const invalid = createSdk();
    invalid.data.riddleQuestPlayerState = {schemaVersion: 1, updatedAt: -1, coins: 9_999};
    const invalidResult = await new FacebookPlatformBootstrap(() => invalid.sdk).initialize(() => undefined);
    expect(invalidResult.status).toBe("success");
    if (invalidResult.status !== "success") return;
    await expect(invalidResult.value.storage.readPlayerData()).resolves.toBeNull();

    const bounded = createSdk();
    bounded.data.riddleQuestPlayerState = {
      schemaVersion: 1,
      updatedAt: 42,
      coins: 9_999,
      profile: {username: 123},
      activeGame: {
        schemaVersion: 1,
        savedAt: 1,
        riddleId: "riddle-1",
        sessionToken: "x".repeat(20),
        gameMode: "classic",
        currentLetters: [],
      },
    };
    const boundedResult = await new FacebookPlatformBootstrap(() => bounded.sdk).initialize(() => undefined);
    expect(boundedResult.status).toBe("success");
    if (boundedResult.status !== "success") return;
    await expect(boundedResult.value.storage.readPlayerData()).resolves.toEqual({schemaVersion: 1, updatedAt: 42});
  });

  test("exposes native social only with both SDK APIs and returns validated context metadata", async () => {
    const harness = createSdk();
    let contextId: string | null = "thread-1";
    let contextType: "SOLO" | "THREAD" | "GROUP" = "THREAD";
    harness.sdk.getSupportedAPIs = () => ["context.chooseAsync", "context.matchPlayerAsync"];
    harness.sdk.context = {
      getID: () => contextId,
      getType: () => contextType,
      chooseAsync: jest.fn(async () => undefined),
      matchPlayerAsync: jest.fn(async () => undefined),
    };
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const social = result.value.capabilities.nativeSocial;
    expect(social?.currentContext()).toEqual({
      status: "success", value: {contextId: "thread-1", contextType: "THREAD"},
    });
    await expect(social?.chooseContext()).resolves.toEqual({
      status: "success", value: {contextId: "thread-1", contextType: "THREAD"},
    });
    expect(harness.sdk.context.chooseAsync).toHaveBeenCalledWith({minSize: 2, maxSize: 50});
    contextId = "group-1";
    contextType = "GROUP";
    await expect(social?.matchPlayer("race10_v1:en")).resolves.toEqual({
      status: "success", value: {contextId: "group-1", contextType: "GROUP"},
    });
    expect(harness.sdk.context.matchPlayerAsync).toHaveBeenCalledWith("race10_v1:en", true, true);

    contextType = "SOLO";
    await expect(social?.chooseContext()).resolves.toEqual({
      status: "unavailable", message: "facebook-context-unavailable",
    });
    contextType = "THREAD";
    contextId = "invalid context/id";
    expect(social?.currentContext()).toEqual({
      status: "unavailable", message: "facebook-context-unavailable",
    });
    await expect(social?.matchPlayer("x".repeat(101))).resolves.toEqual({
      status: "terminal-failure", message: "facebook-match-tag-invalid",
    });
  });

  test("keeps core play but hides native social when age configuration is unknown", async () => {
    const harness = createSdk();
    harness.sdk.getSupportedAPIs = () => ["context.chooseAsync", "context.matchPlayerAsync"];
    harness.sdk.context = {
      getID: () => "thread-1",
      getType: () => "THREAD",
      chooseAsync: jest.fn(async () => undefined),
      matchPlayerAsync: jest.fn(async () => undefined),
    };
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "unknown").initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.value.capabilities.nativeSocial).toBeUndefined();
    expect(result.value.storage).toBeDefined();
  });

  test("exposes profile overlays only for a verified 13+ configuration", async () => {
    const harness = createSdk();
    harness.sdk.getSupportedAPIs = () => [
      "overlayViews.createProfilePictureOverlayViewAsync",
      "overlayViews.createProfileNameOverlayViewAsync",
    ];
    harness.sdk.overlayViews = {
      createProfilePictureOverlayViewAsync: jest.fn(),
      createProfileNameOverlayViewAsync: jest.fn(),
    } as never;

    const unknown = await new FacebookPlatformBootstrap(() => harness.sdk, "unknown").initialize(() => undefined);
    expect(unknown.status).toBe("success");
    if (unknown.status !== "success") return;
    expect(unknown.value.capabilities.overlay).toBeUndefined();

    const adult = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    expect(adult.status).toBe("success");
    if (adult.status !== "success") return;
    expect(adult.value.capabilities.overlay).toBeDefined();
  });

  test("pause handlers can be revoked", async () => {
    const harness = createSdk();
    const result = await new FacebookPlatformBootstrap(() => harness.sdk).initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    let calls = 0;
    const unsubscribe = result.value.capabilities.lifecycle?.onPause(() => { calls += 1; });
    harness.pause();
    unsubscribe?.();
    harness.pause();
    expect(calls).toBe(1);
  });

  test("resume handlers respond only while subscribed and visible", async () => {
    const harness = createSdk();
    const result = await new FacebookPlatformBootstrap(() => harness.sdk).initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    let calls = 0;
    const fakeDocument = Object.assign(new EventTarget(), {visibilityState: "visible"});
    Object.defineProperty(globalThis, "document", {configurable: true, value: fakeDocument});
    const unsubscribe = result.value.capabilities.lifecycle?.onResume?.(() => { calls += 1; });
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    unsubscribe?.();
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    Reflect.deleteProperty(globalThis, "document");
    expect(calls).toBe(1);
  });

  test("fails closed for invalid identity and retryably for SDK failures", async () => {
    const invalid = createSdk();
    invalid.sdk.player.getID = () => "";
    await expect(new FacebookPlatformBootstrap(() => invalid.sdk).initialize(() => undefined)).resolves.toEqual({
      status: "terminal-failure",
      message: "facebook-player-id-invalid",
    });

    const broken = createSdk();
    broken.sdk.initializeAsync = async () => { throw new Error("sdk-down"); };
    await expect(new FacebookPlatformBootstrap(() => broken.sdk).initialize(() => undefined)).resolves.toEqual({
      status: "retryable-failure",
      message: "sdk-down",
    });
  });
});
