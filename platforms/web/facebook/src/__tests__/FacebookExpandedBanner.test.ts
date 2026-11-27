import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {PlatformResult} from "../../../../../src/platform/contracts/capabilities";
import {createFacebookBanner, type FacebookBanner} from "../ads/FacebookBanner";
import {createFacebookAdConfiguration} from "../FacebookAdConfiguration";
import {runFacebookSdkDialog} from "../FacebookSdkDialogGate";
import type {FacebookInstantSdk} from "../fbinstant";

const deferred = () => {
  let release: (() => void) | undefined;
  const promise = new Promise<void>(resolve => {release = resolve;});
  return {promise, resolve() {if (!release) throw new Error("Deferred promise is not initialized"); release();}};
};

const waitUntil = async (condition: () => boolean) => {
  for (let turn = 0; turn < 50; turn++) {
    if (condition()) return;
    await Promise.resolve();
  }
  throw new Error("Expected native surface transition did not complete");
};

const owners: FacebookBanner[] = [];
let originalDocument: PropertyDescriptor | undefined;
beforeEach(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {configurable: true,
    value: Object.assign(new EventTarget(), {visibilityState: "visible"})});
});
afterEach(async () => {
  try {await Promise.all(owners.splice(0).map(owner => owner.retire()));}
  finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

const fixture = (allowsBanner: () => boolean = () => true) => {
  const events: string[] = [];
  let visible = false;
  const loadBannerAdAsync = jest.fn<NonNullable<FacebookInstantSdk["loadBannerAdAsync"]>>(async (placement, position) => {
    events.push(`load:${placement}:${position}`); visible = true;
  });
  const hideBannerAdAsync = jest.fn<NonNullable<FacebookInstantSdk["hideBannerAdAsync"]>>(async () => {events.push("hidden"); visible = false;});
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined, startGameAsync: async () => undefined,
    setLoadingProgress: () => undefined, getSupportedAPIs: () => ["loadBannerAdAsync", "hideBannerAdAsync"], onPause: () => undefined,
    player: {
      getID: () => "banner-player", getSignedPlayerInfoAsync: async () => {throw new Error("Unused identity exchange");},
      getDataAsync: async () => ({}), setDataAsync: async () => undefined, flushDataAsync: async () => undefined,
    },
    loadBannerAdAsync, hideBannerAdAsync,
  };
  const refreshEligibility = jest.fn<() => Promise<boolean>>(async () => true);
  const owner = createFacebookBanner({sdk, enabled: true, placementId: "review-banner", isActive: () => true,
    allowsBanner, refreshEligibility, now: () => Date.UTC(2026, 10, 27)});
  if (!owner) throw new Error("Expected supported Facebook banner controller");
  owners.push(owner);
  return {owner, sdk, events, loadBannerAdAsync, hideBannerAdAsync, refreshEligibility,
    isVisible: () => visible, setVisible: (value: boolean) => {visible = value;}};
};

describe("Facebook expanded native banner lifecycle", () => {
  it("hides a visible banner when authorization becomes unknown without repeatedly refreshing that visit", async () => {
    const initial = {interstitialsEnabled: true, rewardedAdsEnabled: true, removeInterstitialAds: false};
    const read = jest.fn(async () => ({...initial, hasActiveSubscription: false}));
    let refreshBanner: () => void = () => undefined;
    const configuration = createFacebookAdConfiguration({initial, read, isActive: () => true,
      onChange: () => refreshBanner(), reportFailure: () => undefined});
    const harness = fixture(() => configuration.allows("interstitial"));
    refreshBanner = () => harness.owner.refresh();
    harness.refreshEligibility.mockImplementation(() => configuration.refreshEligibility("interstitial"));
    harness.owner.setMounted(true);
    harness.owner.setActivity("online");
    await waitUntil(() => read.mock.calls.length === 2 && harness.isVisible());
    read.mockRejectedValueOnce(new Error("Subscription temporarily unavailable"));
    await configuration.refreshEligibility("interstitial");
    await waitUntil(() => !harness.owner.getSnapshot().reserved);
    for (let turn = 0; turn < 10; turn++) await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(3);
    expect(harness.loadBannerAdAsync).toHaveBeenCalledTimes(1);
    expect(harness.hideBannerAdAsync).toHaveBeenCalledTimes(1);
    harness.owner.setActivity("playing");
    harness.owner.setActivity("online");
    await waitUntil(() => read.mock.calls.length === 5 && harness.isVisible());
    expect(harness.loadBannerAdAsync).toHaveBeenCalledTimes(2);
  });

  it.each(["subscription", "durable ad removal"])("never loads a banner for verified %s despite enabled feature flags", async reason => {
    const initial = {interstitialsEnabled: true, rewardedAdsEnabled: true, removeInterstitialAds: false};
    const configuration = createFacebookAdConfiguration({initial,
      read: async () => ({...initial, hasActiveSubscription: reason === "subscription", removeInterstitialAds: reason === "durable ad removal"}),
      isActive: () => true, onChange: () => undefined, reportFailure: () => undefined});
    const harness = fixture(() => configuration.allows("interstitial"));
    harness.refreshEligibility.mockImplementation(() => configuration.refreshEligibility("interstitial"));
    harness.owner.setMounted(true);
    harness.owner.setActivity("online");
    await waitUntil(() => harness.refreshEligibility.mock.calls.length === 1);
    for (let turn = 0; turn < 10; turn++) await Promise.resolve();
    expect(harness.loadBannerAdAsync).not.toHaveBeenCalled();
    expect(configuration.allows("interstitial")).toBe(false);
    expect(configuration.allows("rewarded")).toBe(reason === "durable ad removal");
  });

  it("verifies an unknown hidden entitlement once per visit and retries on the next menu visit", async () => {
    let allowed = false;
    const harness = fixture(() => allowed);
    harness.refreshEligibility.mockResolvedValue(false);
    harness.owner.setMounted(true);
    harness.owner.setActivity("online");
    await waitUntil(() => harness.refreshEligibility.mock.calls.length === 1);
    expect(harness.loadBannerAdAsync).not.toHaveBeenCalled();
    harness.owner.refresh();
    harness.owner.refresh();
    for (let turn = 0; turn < 10; turn++) await Promise.resolve();
    expect(harness.refreshEligibility).toHaveBeenCalledTimes(1);
    harness.refreshEligibility.mockImplementation(async () => {allowed = true; return true;});
    harness.owner.setActivity("playing");
    harness.owner.setActivity("online");
    await waitUntil(() => harness.refreshEligibility.mock.calls.length === 3);
    expect(harness.isVisible()).toBe(true);
    expect(harness.loadBannerAdAsync).toHaveBeenCalledTimes(1);
  });

  it("hides a late banner load before admitting a native dialog", async () => {
    const harness = fixture();
    const loading = deferred();
    const hiding = deferred();
    harness.loadBannerAdAsync.mockImplementationOnce(async () => {
      harness.events.push("loading"); await loading.promise; harness.setVisible(true); harness.events.push("loaded");
    });
    harness.hideBannerAdAsync.mockImplementationOnce(async () => {
      harness.events.push("hiding"); await hiding.promise; harness.setVisible(false); harness.events.push("hidden");
    });
    harness.owner.setMounted(true);
    harness.owner.setActivity("online");
    await waitUntil(() => harness.events.includes("loading"));
    const dialog = runFacebookSdkDialog(harness.sdk, async () => {
      harness.events.push(harness.isVisible() ? "dialog-over-banner" : "dialog");
      return {status: "success", value: "native-dialog-completed"};
    });
    expect(harness.owner.getSnapshot()).toEqual({reserved: true, interactionBlocked: true, retryable: false});
    expect(harness.events).toEqual(["loading"]);
    loading.resolve();
    await waitUntil(() => harness.events.includes("hiding"));
    expect(harness.events).toEqual(["loading", "loaded", "hiding"]);
    hiding.resolve();
    expect(await dialog).toEqual({status: "success", value: "native-dialog-completed"});
    expect(harness.events.slice(0, 5)).toEqual(["loading", "loaded", "hiding", "hidden", "dialog"]);
  });

  it("lets account cleanup retry a rejected retirement without releasing the blocked surface early", async () => {
    const harness = fixture();
    harness.owner.setMounted(true);
    harness.owner.setActivity("online");
    await waitUntil(() => harness.refreshEligibility.mock.calls.length === 2);
    harness.hideBannerAdAsync.mockRejectedValueOnce(new Error("Native hide failed"));
    await expect(harness.owner.retire()).rejects.toThrow("Native hide failed");
    expect(harness.isVisible()).toBe(true);
    expect(harness.owner.getSnapshot()).toEqual({reserved: true, interactionBlocked: true, retryable: true});
    await harness.owner.retire();
    expect(harness.isVisible()).toBe(false);
    expect(harness.owner.getSnapshot()).toEqual({reserved: false, interactionBlocked: false, retryable: false});
    expect(harness.events).toEqual(["load:review-banner:bottom", "hidden"]);
  });

  it("shows only on the menu and removes its reserved native surface before gameplay continues", async () => {
    const harness = fixture();
    harness.owner.setMounted(true);
    await runFacebookSdkDialog(harness.sdk, async () => ({status: "success", value: undefined}));
    expect(harness.owner.getSnapshot()).toEqual({reserved: false, interactionBlocked: false, retryable: false});
    expect(harness.events).toEqual([]);

    harness.owner.setActivity("online");
    await waitUntil(() => harness.refreshEligibility.mock.calls.length === 2);
    expect(harness.events).toEqual(["load:review-banner:bottom"]);
    const hiding = deferred();
    harness.hideBannerAdAsync.mockImplementationOnce(async () => {
      await hiding.promise; harness.setVisible(false); harness.events.push("hidden-for-gameplay");
    });
    harness.owner.setActivity("playing");
    expect(harness.owner.getSnapshot()).toEqual({reserved: true, interactionBlocked: true, retryable: false});
    hiding.resolve();
    await waitUntil(() => !harness.owner.getSnapshot().reserved);
    expect(harness.owner.getSnapshot()).toEqual({reserved: false, interactionBlocked: false, retryable: false});
    harness.owner.setActivity("racing");
    await runFacebookSdkDialog(harness.sdk, async () => ({status: "success", value: undefined}));
    expect(harness.events).toEqual(["load:review-banner:bottom", "hidden-for-gameplay"]);
  });

  it("removes a banner if the authoritative ad-free gate changes during loading", async () => {
    const harness = fixture();
    const loading = deferred();
    harness.loadBannerAdAsync.mockImplementationOnce(async () => {
      harness.events.push("loading"); await loading.promise; harness.setVisible(true);
    });
    harness.refreshEligibility.mockResolvedValueOnce(true).mockResolvedValue(false);
    harness.owner.setMounted(true);
    harness.owner.setActivity("online");
    await waitUntil(() => harness.events.includes("loading"));
    expect(harness.owner.getSnapshot().reserved).toBe(true);
    loading.resolve();
    await waitUntil(() => !harness.owner.getSnapshot().reserved);
    expect(harness.isVisible()).toBe(false);
    expect(harness.owner.getSnapshot()).toEqual({reserved: false, interactionBlocked: false, retryable: false});
    expect(harness.events).toEqual(["loading", "hidden"]);
  });

  it("refuses native dialogs until a failed banner hide is confirmed", async () => {
    const harness = fixture();
    harness.owner.setMounted(true);
    harness.owner.setActivity("online");
    await waitUntil(() => harness.refreshEligibility.mock.calls.length === 2);
    harness.hideBannerAdAsync.mockRejectedValue(new Error("Surface still visible"));
    const operation = async (): Promise<PlatformResult<string>> => {harness.events.push("dialog"); return {status: "success", value: "opened"};};
    expect(await runFacebookSdkDialog(harness.sdk, operation)).toEqual({status: "unavailable", message: "facebook-provider-surface-not-hidden"});
    expect(harness.isVisible()).toBe(true);
    expect(harness.events).toEqual(["load:review-banner:bottom"]);
    harness.hideBannerAdAsync.mockImplementation(async () => {harness.setVisible(false); harness.events.push("hidden");});
    expect(await runFacebookSdkDialog(harness.sdk, operation)).toEqual({status: "success", value: "opened"});
    expect(harness.events.slice(0, 3)).toEqual(["load:review-banner:bottom", "hidden", "dialog"]);
  });
});
