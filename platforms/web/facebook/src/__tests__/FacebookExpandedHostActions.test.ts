import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {createFacebookBanner} from "../ads/FacebookBanner";
import {createFacebookHostEnvironment} from "../engagement/FacebookHostEnvironment";
import {createFacebookPlayerSettingsActions} from "../engagement/FacebookPlayerSettingsActions";
import type {FacebookInstantSdk} from "../fbinstant";

type DisplayMode = NonNullable<ReturnType<NonNullable<FacebookInstantSdk["getDisplayMode"]>>>;
const supported = ["getPlatform", "getSDKVersion", "getEntryPointAsync", "getDisplayMode", "onDisplayModeChange", "setSessionData", "openExternalLinkAsync"];
const disposers: Array<() => void | Promise<void>> = [];
let originalDocument: PropertyDescriptor | undefined;
let originalWindow: PropertyDescriptor | undefined;

beforeEach(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "document", {configurable: true, value: Object.assign(new EventTarget(), {
    visibilityState: "visible", documentElement: {dataset: {}},
  })});
  Object.defineProperty(globalThis, "window", {configurable: true, value: new EventTarget()});
});
afterEach(async () => {
  try {for (const dispose of disposers.splice(0).reverse()) await dispose();}
  finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

const deferred = <Value,>() => {
  let accept: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>(resolve => {accept = resolve;});
  return {promise, resolve(value: Value) {if (!accept) throw new Error("Deferred promise is not initialized"); accept(value);}};
};

const fixture = (apis = supported) => {
  const nativeReads: string[] = [];
  const sessionData: Array<Record<string, string | number>> = [];
  const openedUrls: string[] = [];
  const resizes: string[] = [];
  let displayChanged: ((mode: DisplayMode) => void) | undefined;
  window.addEventListener("resize", () => {resizes.push(document.documentElement.dataset.facebookDisplayMode ?? "unset");});
  const getEntryPointAsync = jest.fn<NonNullable<FacebookInstantSdk["getEntryPointAsync"]>>(async () => {nativeReads.push("entry"); return "HOME";});
  const getDisplayMode = jest.fn<NonNullable<FacebookInstantSdk["getDisplayMode"]>>(() => {nativeReads.push("display"); return "NORMAL";});
  const openExternalLinkAsync = jest.fn<NonNullable<FacebookInstantSdk["openExternalLinkAsync"]>>(async url => {openedUrls.push(url);});
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined, startGameAsync: async () => undefined,
    setLoadingProgress: () => undefined, getSupportedAPIs: () => apis, onPause: () => undefined,
    player: {
      getID: () => "host-player", getSignedPlayerInfoAsync: async () => {throw new Error("Unused identity exchange");},
      getDataAsync: async () => ({}), setDataAsync: async () => undefined, flushDataAsync: async () => undefined,
    },
    getPlatform: () => {nativeReads.push("platform"); return "WEB";},
    getSDKVersion: () => {nativeReads.push("version"); return "8.0";},
    getEntryPointAsync, getDisplayMode, openExternalLinkAsync,
    onDisplayModeChange: callback => {nativeReads.push("display-listener"); displayChanged = callback;},
    setSessionData: data => {sessionData.push(data);},
  };
  return {sdk, nativeReads, sessionData, openedUrls, resizes, getEntryPointAsync, getDisplayMode, openExternalLinkAsync,
    emitDisplay(mode: DisplayMode) {displayChanged?.(mode);}};
};

const host = (sdk: FacebookInstantSdk) => {
  const environment = createFacebookHostEnvironment({sdk, isActive: () => true});
  disposers.push(() => environment.retire());
  return environment;
};
const settings = (sdk: FacebookInstantSdk) => {
  const actions = createFacebookPlayerSettingsActions({sdk, isActive: () => true, flushBeforeQuit: async () => undefined});
  if (!actions) throw new Error("Expected supported legal links");
  disposers.push(() => actions.retire());
  return actions;
};

describe("Facebook expanded host environment", () => {
  it("reads and writes optional host metadata only when advertised", async () => {
    const unavailable = fixture([]);
    const absent = host(unavailable.sdk);
    absent.setActivity("playing");
    await Promise.resolve();
    absent.retire();
    expect(absent.getSnapshot()).toEqual({});
    expect(unavailable.nativeReads).toEqual([]);
    expect(unavailable.sessionData).toEqual([]);

    const available = fixture();
    const present = host(available.sdk);
    present.setActivity("racing");
    await Promise.resolve();
    expect(present.getSnapshot()).toEqual({facebookPlatform: "WEB", facebookSdkVersion: "8.0",
      facebookEntryPoint: "HOME", facebookDisplayMode: "NORMAL"});
    expect(available.sessionData).toEqual([{game: "riddle-quest", activity: "racing"}]);
    expect(available.resizes).toEqual(["normal"]);
  });

  it("keeps display callbacks usable when the initial display getter throws", () => {
    const harness = fixture();
    harness.getDisplayMode.mockImplementationOnce(() => {throw new Error("Initial display unavailable");});
    const environment = host(harness.sdk);
    expect(environment.getSnapshot()).toEqual({facebookPlatform: "WEB", facebookSdkVersion: "8.0"});
    harness.emitDisplay("EXPANDED");
    harness.emitDisplay("EXPANDED");
    expect(environment.getSnapshot()).toEqual({facebookPlatform: "WEB", facebookSdkVersion: "8.0", facebookDisplayMode: "EXPANDED"});
    expect(document.documentElement.dataset.facebookDisplayMode).toBe("expanded");
    expect(harness.resizes).toEqual(["expanded"]);
  });

  it("tolerates advertised methods missing from the callable SDK surface", () => {
    const harness = fixture();
    delete harness.sdk.getPlatform;
    delete harness.sdk.getSDKVersion;
    delete harness.sdk.getEntryPointAsync;
    delete harness.sdk.getDisplayMode;
    delete harness.sdk.setSessionData;
    const environment = host(harness.sdk);
    environment.setActivity("online");
    harness.emitDisplay("FULLSCREEN");
    expect(environment.getSnapshot()).toEqual({facebookDisplayMode: "FULLSCREEN"});
    expect(harness.resizes).toEqual(["fullscreen"]);
    expect(harness.sessionData).toEqual([]);
  });

  it("clears written session data and ignores late entry and display callbacks after retirement", async () => {
    const harness = fixture();
    const entry = deferred<string>();
    harness.getEntryPointAsync.mockReturnValueOnce(entry.promise);
    document.documentElement.dataset.facebookDisplayMode = "previous-owner";
    const environment = host(harness.sdk);
    environment.setActivity("playing");
    expect(environment.getSnapshot()).toEqual({facebookPlatform: "WEB", facebookSdkVersion: "8.0", facebookDisplayMode: "NORMAL"});
    environment.retire();
    entry.resolve("LATE_ENTRY");
    await entry.promise;
    harness.emitDisplay("EXPANDED");
    environment.setActivity("racing");
    environment.retire();
    expect(environment.getSnapshot()).toEqual({});
    expect(document.documentElement.dataset.facebookDisplayMode).toBe("previous-owner");
    expect(harness.resizes).toEqual(["normal"]);
    expect(harness.sessionData).toEqual([{game: "riddle-quest", activity: "playing"}, {}]);
  });
});

describe("Facebook expanded native legal links", () => {
  it("offers advertised legal links repeatedly with their exact approved destinations", async () => {
    const unsupported = fixture([]);
    expect(createFacebookPlayerSettingsActions({sdk: unsupported.sdk, isActive: () => true,
      flushBeforeQuit: async () => undefined})).toBeUndefined();
    const harness = fixture(["openExternalLinkAsync"]);
    const actions = settings(harness.sdk);
    expect(actions.getSnapshot()).toEqual({actions: [
      {id: "privacy-policy", labelKey: "Settings.PRIVACY_BUTTON"},
      {id: "terms-of-use", labelKey: "Settings.TERMS_BUTTON"},
    ], pendingAction: null});
    for (let visit = 0; visit < 2; visit++) {
      expect(await actions.run("privacy-policy")).toBe("success");
      expect(await actions.run("terms-of-use")).toBe("success");
    }
    expect(harness.openedUrls).toEqual([
      "https://roobsworld.com/riddle-quest/privacy", "https://roobsworld.com/riddle-quest/terms",
      "https://roobsworld.com/riddle-quest/privacy", "https://roobsworld.com/riddle-quest/terms",
    ]);
    expect(actions.getSnapshot()).toEqual({actions: [
      {id: "privacy-policy", labelKey: "Settings.PRIVACY_BUTTON"},
      {id: "terms-of-use", labelKey: "Settings.TERMS_BUTTON"},
    ], pendingAction: null});
  });

  it("does not resurrect an unsupported legal action during refresh", async () => {
    const harness = fixture(["openExternalLinkAsync"]);
    harness.openExternalLinkAsync.mockRejectedValueOnce({code: "CLIENT_UNSUPPORTED_OPERATION"});
    const actions = settings(harness.sdk);
    expect(await actions.run("privacy-policy")).toBe("unavailable");
    await actions.refresh();
    expect(actions.getSnapshot()).toEqual({actions: [{id: "terms-of-use", labelKey: "Settings.TERMS_BUTTON"}], pendingAction: null});
    expect(await actions.run("privacy-policy")).toBe("unavailable");
    expect(await actions.run("terms-of-use")).toBe("success");
    expect(harness.openedUrls).toEqual(["https://roobsworld.com/riddle-quest/terms"]);
  });

  it("does not open a legal link after Settings retires while the native banner hides", async () => {
    const harness = fixture(["openExternalLinkAsync", "loadBannerAdAsync", "hideBannerAdAsync"]);
    const loaded = deferred<void>();
    const hiding = deferred<void>();
    const hidden = deferred<void>();
    harness.sdk.loadBannerAdAsync = async () => {loaded.resolve();};
    harness.sdk.hideBannerAdAsync = async () => {hiding.resolve(); await hidden.promise;};
    const banner = createFacebookBanner({sdk: harness.sdk, enabled: true, placementId: "review-banner",
      isActive: () => true, allowsBanner: () => true, refreshEligibility: async () => true,
      now: () => Date.UTC(2026, 10, 27)});
    if (!banner) throw new Error("Expected a supported banner");
    disposers.push(() => banner.retire());
    banner.setMounted(true);
    banner.setActivity("online");
    await loaded.promise;
    const actions = settings(harness.sdk);
    const opening = actions.run("privacy-policy");
    await hiding.promise;
    expect(actions.getSnapshot().pendingAction).toBe("privacy-policy");
    actions.retire();
    hidden.resolve();
    expect(await opening).toBe("cancelled");
    expect(harness.openedUrls).toEqual([]);
    expect(actions.getSnapshot()).toEqual({actions: [], pendingAction: null});
    await banner.retire();

    const replacement = settings(harness.sdk);
    expect(await replacement.run("privacy-policy")).toBe("success");
    expect(harness.openedUrls).toEqual(["https://roobsworld.com/riddle-quest/privacy"]);
  });
});
