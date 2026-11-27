import {describe, expect, test} from "@jest/globals";
import type {FacebookInstantSdk} from "../fbinstant";
import {FacebookPlatformBootstrap} from "../FacebookPlatformBootstrap";
import {createFacebookAdsCapability} from "../FacebookAdsCapability";
import {createFacebookNotificationCapability} from "../FacebookNotificationCapability";

/** Creates sdk. */
const createSdk = () => {
  /** Provides events behavior. */
  const events: string[] = [];
  /** Provides data behavior. */
  const data: Record<string, unknown> = {
    riddleQuestPreferences: {locale: "fr", muted: true, presenceEnabled: true, ignored: "discarded"},
    riddleQuestPlayerState: {schemaVersion: 1, updatedAt: 42},
  };
  /** Provides pause behavior. */
  let pause: (() => void) | undefined;
  /** Provides sdk behavior. */
  const sdk: FacebookInstantSdk = {
    /** Provides initialize async behavior. */
    async initializeAsync() {
      events.push("initialize");
    },
    /** Sets loading progress. */
    setLoadingProgress(progress) {
      events.push(`progress:${progress}`);
    },
    /** Starts game async. */
    async startGameAsync() {
      events.push("start");
    },
    /** Gets supported ap is. */
    getSupportedAPIs() {
      return [];
    },
    /** Provides on pause behavior. */
    onPause(callback) {
      pause = callback;
    },
    player: {
      /** Gets id. */
      getID() {
        if (!events.includes("start")) throw new Error("player-read-before-start");
        events.push("player");
        return "facebook-player-1";
      },
      /** Gets signed player info async. */
      async getSignedPlayerInfoAsync() {
        throw new Error("not-used");
      },
      /** Gets data async. */
      async getDataAsync(keys) {
        if (!events.includes("start")) throw new Error("cloud-read-before-start");
        events.push(`read:${keys.join(",")}`);
        return Object.fromEntries(keys.map((key) => [key, data[key]]));
      },
      /** Sets data async. */
      async setDataAsync(update) {
        events.push(`write:${Object.keys(update).sort().join(",")}`);
        Object.assign(data, update);
      },
      /** Provides flush data async behavior. */
      async flushDataAsync() {
        events.push("flush");
      },
    },
  };
  return {sdk, events, data, pause: () => pause?.()};
};

describe("FacebookPlatformBootstrap", () => {
  test("observes native context successes and retires callbacks without treating cancellation as a switch", async () => {
    /** Controlled native-event boundary for this adapter regression. */
    const harness = createSdk();
    harness.sdk.getSupportedAPIs = () => ["context.chooseAsync"];
    harness.sdk.context = {getID: () => "thread-a", getType: () => "THREAD", chooseAsync: async () => undefined};
    /** Controlled native-event boundary for this adapter regression. */
    let success!: (contextId: string | null) => void, failure!: (error: unknown) => void;
    harness.sdk.onContextChange = (accepted, rejected) => {success = accepted; failure = rejected;};
    /** Controlled native-event boundary for this adapter regression. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    if (result.status !== "success") throw new Error("bootstrap failed");
    /** Controlled native-event boundary for this adapter regression. */
    const changed = jest.fn();
    /** Controlled native-event boundary for this adapter regression. */
    const stop = result.value.capabilities.nativeSocial?.onContextChange?.(changed);
    expect(stop).toEqual(expect.any(Function));
    success("thread-b"); success(null); failure({code: "USER_CANCELLED"});
    expect(changed).toHaveBeenCalledTimes(2);
    stop!(); success("thread-c");
    expect(changed).toHaveBeenCalledTimes(2);
  });

  test.each(["absent", "unadvertised", "wrong-namespace"])("retains supported context selection when matchmaking is %s", async mode => {
    /** Host capability combinations use the actual bootstrap rather than a replacement adapter. */
    const harness = createSdk();
    harness.sdk.getSupportedAPIs = () => ["context.chooseAsync", ...(mode === "wrong-namespace" ? ["context.matchPlayerAsync"] : [])];
    if (mode === "unadvertised") harness.sdk.matchPlayerAsync = jest.fn(async () => undefined);
    harness.sdk.context = {getID: () => "chooser-only", getType: () => "GROUP", chooseAsync: jest.fn(async () => undefined)};
    /** Context selection must not depend on an unrelated native matchmaking API. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    if (result.status !== "success") throw new Error("bootstrap failed");
    expect(result.value.capabilities.nativeSocial).toBeDefined();
    await expect(result.value.capabilities.nativeSocial?.chooseContext()).resolves.toMatchObject({status: "success", value: {contextId: "chooser-only", contextType: "GROUP"}});
    expect(harness.sdk.context.chooseAsync).toHaveBeenCalledWith({minSize: 2, maxSize: 50});
    await expect(result.value.capabilities.nativeSocial?.matchPlayer("race10_v1_en")).resolves.toMatchObject({status: "unavailable"});
    if (harness.sdk.matchPlayerAsync) expect(harness.sdk.matchPlayerAsync).not.toHaveBeenCalled();
  });

  test("does not expose a chooser method that the host advertises without implementing", async () => {
    /** Runtime host availability must include a callable method as well as its advertised name. */
    const harness = createSdk();
    harness.sdk.getSupportedAPIs = () => ["context.chooseAsync", "matchPlayerAsync"];
    harness.sdk.matchPlayerAsync = jest.fn(async () => undefined);
    harness.sdk.context = {getID: () => "thread-1", getType: () => "THREAD", chooseAsync: jest.fn(async () => undefined)};
    Object.defineProperty(harness.sdk.context, "chooseAsync", {value: undefined});
    /** A malformed provider surface must not render an unusable chooser. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    if (result.status !== "success") throw new Error("bootstrap failed");
    expect(result.value.capabilities.nativeSocial).toBeUndefined();
  });

  test("does not start context selection or native matching over an active result ad", async () => {
    /** Every provider adapter receives this exact SDK instance. */
    const harness = createSdk();
    /** Ad loading holds provider occupancy across both social attempts. */
    let finish!: () => void;
    /** Deferred provider ad response. */
    const pending = new Promise<void>(resolve => {finish = resolve;});
    harness.sdk.getSupportedAPIs = () => ["context.chooseAsync", "matchPlayerAsync", "getInterstitialAdAsync"];
    harness.sdk.context = {getID: () => "thread-1", getType: () => "THREAD", chooseAsync: jest.fn(async () => undefined)};
    harness.sdk.matchPlayerAsync = jest.fn(async () => undefined);
    harness.sdk.getInterstitialAdAsync = jest.fn(async () => ({loadAsync: async () => pending, showAsync: async () => undefined}));
    /** Native capabilities come from the public bootstrap interface. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    if (result.status !== "success" || !result.value.capabilities.nativeSocial) throw new Error("social capability missing");
    /** Result ad owns the provider dialog guard before social calls begin. */
    const ads = createFacebookAdsCapability({sdk: harness.sdk, placementId: "result", adFree: false})!;
    /** Running provider operation has not completed. */
    const showing = ads.showInterstitial("result");
    await expect(result.value.capabilities.nativeSocial.chooseContext()).resolves.toMatchObject({status: "unavailable"});
    await expect(result.value.capabilities.nativeSocial.matchPlayer("race10_v1_en")).resolves.toMatchObject({status: "unavailable"});
    expect(harness.sdk.context.chooseAsync).not.toHaveBeenCalled();
    expect(harness.sdk.matchPlayerAsync).not.toHaveBeenCalled();
    finish();
    await expect(showing).resolves.toMatchObject({status: "success"});
    await expect(result.value.capabilities.nativeSocial.chooseContext()).resolves.toMatchObject({status: "success"});
  });

  test.each(["choose", "match"] as const)("releases the shared dialog gate after %s cancellation or failure", async operation => {
    /** Cancellation and transport failures both settle the native UI operation. */
    for (const error of [{code: "USER_CANCELLED"}, new Error("native-social-failed")]) {
      /** Each SDK lifetime has its own provider occupancy and ad state. */
      const harness = createSdk();
      harness.sdk.getSupportedAPIs = () => ["context.chooseAsync", "matchPlayerAsync", "getInterstitialAdAsync"];
      harness.sdk.context = {getID: () => "thread-1", getType: () => "THREAD",
        chooseAsync: jest.fn(async () => {throw error;})};
      harness.sdk.matchPlayerAsync = jest.fn(async () => {throw error;});
      harness.sdk.getInterstitialAdAsync = jest.fn(async () => ({loadAsync: async () => undefined, showAsync: async () => undefined}));
      /** Social adapter preserves the established provider error classification. */
      const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
      if (result.status !== "success" || !result.value.capabilities.nativeSocial) throw new Error("social capability missing");
      await expect(operation === "choose" ? result.value.capabilities.nativeSocial.chooseContext()
        : result.value.capabilities.nativeSocial.matchPlayer("race10_v1_en"))
        .resolves.toMatchObject({status: error instanceof Error ? "retryable-failure" : "cancelled"});
      /** A failed native operation must not permanently suppress later result ads. */
      const ads = createFacebookAdsCapability({sdk: harness.sdk, placementId: "result", adFree: false})!;
      await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "success"});
    }
  });

  test.each(["choose", "match"] as const)("holds the shared provider dialog gate during %s", async operation => {
    /** Real adapters share this single injected Meta SDK instance. */
    const harness = createSdk();
    /** Simulated native UI remains open until its provider promise settles. */
    let finish!: () => void;
    /** Deferred result at the actual context/match SDK boundary. */
    const pending = new Promise<void>(resolve => {finish = resolve;});
    harness.sdk.getSupportedAPIs = () => ["context.chooseAsync", "matchPlayerAsync", "getInterstitialAdAsync",
      "player.canSubscribeBotAsync", "player.isSubscribedBotAsync", "player.subscribeBotAsync"];
    harness.sdk.context = {
      getID: () => "thread-1", getType: () => "THREAD",
      chooseAsync: jest.fn(async () => {if (operation === "choose") await pending;}),
    };
    harness.sdk.matchPlayerAsync = jest.fn(async () => {if (operation === "match") await pending;});
    harness.sdk.getInterstitialAdAsync = jest.fn(async () => ({loadAsync: async () => undefined, showAsync: async () => undefined}));
    harness.sdk.player.canSubscribeBotAsync = jest.fn(async () => true);
    harness.sdk.player.isSubscribedBotAsync = jest.fn(async () => false);
    harness.sdk.player.subscribeBotAsync = jest.fn(async () => undefined);
    /** Startup exposes the public platform social adapter. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    if (result.status !== "success" || !result.value.capabilities.nativeSocial) throw new Error("social capability missing");
    /** Public capability owns the same SDK used by ads and notification prompts. */
    const social = result.value.capabilities.nativeSocial;
    /** Real interstitial adapter, with a supported configured test placement. */
    const ads = createFacebookAdsCapability({sdk: harness.sdk, placementId: "result", adFree: false})!;
    /** Real bot prompt adapter observes the same provider occupancy. */
    const notifications = createFacebookNotificationCapability(harness.sdk)!;
    /** Provider context/match dialog remains open across competing calls. */
    const opened = operation === "choose" ? social.chooseContext() : social.matchPlayer("race10_v1_en");
    await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "unavailable"});
    await expect(notifications.requestPermission()).resolves.toMatchObject({status: "unavailable"});
    await expect(operation === "choose" ? social.matchPlayer("race10_v1_en") : social.chooseContext())
      .resolves.toMatchObject({status: "unavailable"});
    expect(harness.sdk.getInterstitialAdAsync).not.toHaveBeenCalled();
    expect(harness.sdk.player.subscribeBotAsync).not.toHaveBeenCalled();
    expect(operation === "choose" ? harness.sdk.matchPlayerAsync : harness.sdk.context.chooseAsync).not.toHaveBeenCalled();
    finish();
    await expect(opened).resolves.toEqual({status: "success", value: {contextId: "thread-1", contextType: "THREAD"}});
    await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "success"});
    expect(harness.sdk.getInterstitialAdAsync).toHaveBeenCalledTimes(1);
  });

  test("owns initialization ordering and exposes only supported capabilities", async () => {
    /** Provides harness behavior. */
    const harness = createSdk();
    /** Provides reported behavior. */
    const reported: number[] = [];
    /** Provides result behavior. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk).initialize((value) => reported.push(value));
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(harness.events).toEqual([
      "initialize",
      "progress:30",
      "progress:70",
      "progress:100",
      "start",
      "player",
      "read:riddleQuestPreferences",
    ]);
    expect(reported).toEqual([30, 70, 100]);
    expect(result.value.platform).toBe("facebook");
    expect(result.value.capabilities.lifecycle).toBeDefined();
    expect(result.value.capabilities.accountManagement).toEqual({username: true, avatar: false, deletion: true});
    expect(result.value.capabilities.commerce).toBeUndefined();
    expect(result.value.capabilities.ads).toBeUndefined();
    expect(result.value.capabilities.notifications).toBeUndefined();
    expect(result.value.capabilities.sharing).toBeUndefined();
    expect(result.value.capabilities.nativeSocial).toBeUndefined();
    expect(result.value.capabilities.overlay).toBeUndefined();
  });

  test("uses Meta locale only when no supported saved preference exists", async () => {
    /** Isolated provider SDK and saved preferences for this scenario. */
    const harness = createSdk();
    harness.sdk.getLocale = jest.fn(() => "pt_BR");
    /** Initialization result exposing the normalized preference store. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk).initialize(() => undefined);
    if (result.status !== "success") throw new Error("bootstrap failed");
    await expect(result.value.storage.readPreferences()).resolves.toMatchObject({locale: "fr"});
    expect(harness.sdk.getLocale).not.toHaveBeenCalled();
    harness.data.riddleQuestPreferences = {locale: "unsupported", muted: true};
    await expect(result.value.storage.readPreferences()).resolves.toEqual({locale: "pt", muted: true});
    harness.sdk.getLocale = () => "ja-JP";
    harness.data.riddleQuestPreferences = {};
    await expect(result.value.storage.readPreferences()).resolves.toEqual({locale: "ja"});
    harness.sdk.getLocale = () => null;
    await expect(result.value.storage.readPreferences()).resolves.toEqual({});
    harness.sdk.getLocale = () => "zz_ZZ";
    await expect(result.value.storage.readPreferences()).resolves.toEqual({});
  });

  test("does not read identity or cloud state when Meta refuses to start", async () => {
    /** Isolated provider SDK and saved preferences for this scenario. */
    const harness = createSdk();
    harness.sdk.startGameAsync = async () => {throw new Error("start-rejected");};
    await expect(new FacebookPlatformBootstrap(() => harness.sdk).initialize(() => undefined)).resolves.toEqual({
      status: "retryable-failure", message: "start-rejected",
    });
    expect(harness.events).toEqual(["initialize", "progress:30", "progress:70", "progress:100"]);
  });

  test("normalizes asynchronous storage and flushes critical clears", async () => {
    /** Provides harness behavior. */
    const harness = createSdk();
    /** Provides result behavior. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    await expect(result.value.storage.readPreferences()).resolves.toEqual({
      locale: "fr",
      muted: true,
      presenceEnabled: true,
    });
    await expect(result.value.storage.readPlayerData()).resolves.toEqual({schemaVersion: 1, updatedAt: 42});
    await result.value.storage.writePreferences({locale: "ar"});
    await result.value.storage.clear();
    expect(harness.data.riddleQuestPreferences).toBeNull();
    expect(harness.data.riddleQuestPlayerState).toBeNull();
    expect(harness.events.at(-1)).toBe("flush");
  });

  test("orders pause-time flushes after in-flight writes and preserves recovery after failure", async () => {
    /** Provides harness behavior. */
    const harness = createSdk();
    /** Provides release write behavior. */
    let releaseWrite!: () => void;
    harness.sdk.player.setDataAsync = jest.fn(async (update) => {
      harness.events.push(`write-start:${Object.keys(update).join(",")}`);
      await new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
      Object.assign(harness.data, update);
      harness.events.push("write-end");
    });
    /** Provides result behavior. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk).initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    /** Provides write behavior. */
    const write = result.value.storage.writePreferences({locale: "ja"});
    await Promise.resolve();
    /** Provides flush behavior. */
    const flush = result.value.storage.flush();
    expect(harness.events).not.toContain("flush");
    releaseWrite();
    await Promise.all([write, flush]);
    expect(harness.events.slice(-3)).toEqual(["write-start:riddleQuestPreferences", "write-end", "flush"]);

    harness.sdk.player.setDataAsync = jest.fn(async () => {
      throw new Error("cloud-write-failed");
    });
    await expect(result.value.storage.writePreferences({locale: "ko"})).rejects.toThrow("cloud-write-failed");
    await expect(result.value.storage.flush()).resolves.toBeUndefined();
    expect(harness.events.at(-1)).toBe("flush");
  });

  test("rejects invalid player-state clocks and strips untrusted cloud fields", async () => {
    /** Provides invalid behavior. */
    const invalid = createSdk();
    invalid.data.riddleQuestPlayerState = {schemaVersion: 1, updatedAt: -1, coins: 9_999};
    /** Provides invalid result behavior. */
    const invalidResult = await new FacebookPlatformBootstrap(() => invalid.sdk).initialize(() => undefined);
    expect(invalidResult.status).toBe("success");
    if (invalidResult.status !== "success") return;
    await expect(invalidResult.value.storage.readPlayerData()).resolves.toBeNull();

    /** Provides bounded behavior. */
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
    /** Provides bounded result behavior. */
    const boundedResult = await new FacebookPlatformBootstrap(() => bounded.sdk).initialize(() => undefined);
    expect(boundedResult.status).toBe("success");
    if (boundedResult.status !== "success") return;
    await expect(boundedResult.value.storage.readPlayerData()).resolves.toEqual({schemaVersion: 1, updatedAt: 42});
  });

  test("exposes supported context and matchmaking APIs with validated context metadata", async () => {
    /** Provides harness behavior. */
    const harness = createSdk();
    /** Provides context id behavior. */
    let contextId: string | null = "thread-1";
    /** Provides context type behavior. */
    let contextType: "SOLO" | "THREAD" | "GROUP" = "THREAD";
    harness.sdk.getSupportedAPIs = () => ["context.chooseAsync", "matchPlayerAsync"];
    harness.sdk.matchPlayerAsync = jest.fn(async () => undefined);
    harness.sdk.context = {
      getID: () => contextId,
      getType: () => contextType,
      chooseAsync: jest.fn(async () => undefined),
    };
    /** Provides result behavior. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    /** Provides social behavior. */
    const social = result.value.capabilities.nativeSocial;
    expect(social?.currentContext()).toEqual({
      status: "success",
      value: {contextId: "thread-1", contextType: "THREAD"},
    });
    await expect(social?.chooseContext()).resolves.toEqual({
      status: "success",
      value: {contextId: "thread-1", contextType: "THREAD"},
    });
    expect(harness.sdk.context.chooseAsync).toHaveBeenCalledWith({minSize: 2, maxSize: 50});
    contextId = "group-1";
    contextType = "GROUP";
    await expect(social?.matchPlayer("race10_v1_en")).resolves.toEqual({
      status: "success",
      value: {contextId: "group-1", contextType: "GROUP"},
    });
    expect(harness.sdk.matchPlayerAsync).toHaveBeenCalledWith("race10_v1_en", true, true);
    await expect(social?.matchPlayer("race10_v1:en")).resolves.toEqual({
      status: "terminal-failure", message: "facebook-match-tag-invalid",
    });
    expect(harness.sdk.matchPlayerAsync).toHaveBeenCalledTimes(1);

    contextType = "SOLO";
    await expect(social?.chooseContext()).resolves.toEqual({
      status: "unavailable",
      message: "facebook-context-unavailable",
    });
    contextType = "THREAD";
    contextId = "invalid context/id";
    expect(social?.currentContext()).toEqual({
      status: "unavailable",
      message: "facebook-context-unavailable",
    });
    await expect(social?.matchPlayer("x".repeat(101))).resolves.toEqual({
      status: "terminal-failure",
      message: "facebook-match-tag-invalid",
    });
  });

  test("keeps core play but hides native social when age configuration is unknown", async () => {
    /** Provides harness behavior. */
    const harness = createSdk();
    harness.sdk.getSupportedAPIs = () => ["context.chooseAsync", "matchPlayerAsync"];
    harness.sdk.matchPlayerAsync = jest.fn(async () => undefined);
    harness.sdk.context = {
      getID: () => "thread-1",
      getType: () => "THREAD",
      chooseAsync: jest.fn(async () => undefined),
    };
    /** Provides result behavior. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "unknown").initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.value.capabilities.nativeSocial).toBeUndefined();
    expect(result.value.storage).toBeDefined();
  });

  test("exposes profile overlays only for a verified 13+ configuration", async () => {
    /** Provides harness behavior. */
    const harness = createSdk();
    harness.sdk.getSupportedAPIs = () => [
      "overlayViews.createProfilePictureOverlayViewAsync",
      "overlayViews.createProfileNameOverlayViewAsync",
    ];
    harness.sdk.overlayViews = {
      createProfilePictureOverlayViewAsync: jest.fn(),
      createProfileNameOverlayViewAsync: jest.fn(),
    } as never;

    /** Provides unknown behavior. */
    const unknown = await new FacebookPlatformBootstrap(() => harness.sdk, "unknown").initialize(() => undefined);
    expect(unknown.status).toBe("success");
    if (unknown.status !== "success") return;
    expect(unknown.value.capabilities.overlay).toBeUndefined();
    expect(unknown.value.capabilities.matchmaking).toBeUndefined();

    /** Provides adult behavior. */
    const adult = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    expect(adult.status).toBe("success");
    if (adult.status !== "success") return;
    expect(adult.value.capabilities.overlay).toBeDefined();
    expect(adult.value.capabilities.matchmaking).toBeDefined();
  });

  test("pause handlers can be revoked", async () => {
    /** Provides harness behavior. */
    const harness = createSdk();
    /** Provides result behavior. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk).initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    /** Provides calls behavior. */
    let calls = 0;
    /** Provides unsubscribe behavior. */
    const unsubscribe = result.value.capabilities.lifecycle?.onPause(() => {
      calls += 1;
    });
    harness.pause();
    unsubscribe?.();
    harness.pause();
    expect(calls).toBe(1);
  });

  test("resume handlers respond only while subscribed and visible", async () => {
    /** Provides harness behavior. */
    const harness = createSdk();
    /** Provides result behavior. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk).initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    /** Provides calls behavior. */
    let calls = 0;
    /** Provides fake document behavior. */
    const fakeDocument = Object.assign(new EventTarget(), {visibilityState: "visible"});
    Object.defineProperty(globalThis, "document", {configurable: true, value: fakeDocument});
    /** Provides unsubscribe behavior. */
    const unsubscribe = result.value.capabilities.lifecycle?.onResume?.(() => {
      calls += 1;
    });
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    unsubscribe?.();
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    Reflect.deleteProperty(globalThis, "document");
    expect(calls).toBe(1);
  });

  test("uses Meta onResume without depending on browser visibility events", async () => {
    /** Isolated provider SDK for this lifecycle or capability scenario. */
    const harness = createSdk();
    /** Provider callback captured independently of browser visibility. */
    let resume: (() => void) | undefined;
    harness.sdk.onResume = callback => {resume = callback;};
    /** Bootstrap result exposing target-specific capabilities. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk).initialize(() => undefined);
    if (result.status !== "success") throw new Error("bootstrap failed");
    /** Consumer callback whose unsubscribe behavior is asserted. */
    const callback = jest.fn();
    /** Removes the consumer from provider resume notifications. */
    const unsubscribe = result.value.capabilities.lifecycle?.onResume?.(callback);
    resume?.();
    unsubscribe?.();
    resume?.();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("does not mistake a context-namespaced matchmaking fixture for Meta's API", async () => {
    /** Isolated provider SDK for this lifecycle or capability scenario. */
    const harness = createSdk();
    harness.sdk.getSupportedAPIs = () => ["context.chooseAsync", "context.matchPlayerAsync"];
    harness.sdk.context = {getID: () => "thread-1", getType: () => "THREAD", chooseAsync: jest.fn()};
    /** Bootstrap result exposing target-specific capabilities. */
    const result = await new FacebookPlatformBootstrap(() => harness.sdk, "13_plus").initialize(() => undefined);
    if (result.status !== "success") throw new Error("bootstrap failed");
    expect(result.value.capabilities.nativeSocial).toBeDefined();
    await expect(result.value.capabilities.nativeSocial?.matchPlayer()).resolves.toMatchObject({status: "unavailable"});
  });

  test("fails closed for invalid identity and retryably for SDK failures", async () => {
    /** Provides invalid behavior. */
    const invalid = createSdk();
    invalid.sdk.player.getID = () => "";
    await expect(new FacebookPlatformBootstrap(() => invalid.sdk).initialize(() => undefined)).resolves.toEqual({
      status: "terminal-failure",
      message: "facebook-player-id-invalid",
    });

    /** Provides broken behavior. */
    const broken = createSdk();
    broken.sdk.initializeAsync = async () => {
      throw new Error("sdk-down");
    };
    await expect(new FacebookPlatformBootstrap(() => broken.sdk).initialize(() => undefined)).resolves.toEqual({
      status: "retryable-failure",
      message: "sdk-down",
    });
  });
});
