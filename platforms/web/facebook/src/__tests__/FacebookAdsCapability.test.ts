import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {performance as timeline} from "node:perf_hooks";
import {createFacebookAdsCapability} from "../FacebookAdsCapability";
import {createFacebookAdConfiguration, type FacebookAdFormat} from "../FacebookAdConfiguration";
import {createFacebookLevelInterstitial} from "../FacebookLevelInterstitial";
import {completionPresentationKey} from "../../../../../src/gameplay/session/completion/completionPresentation";
import type {CompletionResult} from "../../../../../src/platform/contracts/hostServices";
import type {HostCompletionInput} from "../../../../../src/progression/browser/hostCompletionEffects";
import type {FacebookInstantSdk} from "../fbinstant";
import {createFacebookInterstitialTrace} from "../ads/FacebookInterstitialTrace";
import {registerFacebookSdkDialogGuard} from "../FacebookSdkDialogGate";

/** Provides sdk with ad behavior. */
const sdkWithAd = () => {
  let requestedPlacement = "";
  /** Provides ad behavior. */
  const ad = {getPlacementID: jest.fn(() => requestedPlacement), loadAsync: jest.fn<() => Promise<void>>(async () => undefined),
    showAsync: jest.fn<() => Promise<void>>(async () => undefined)};
  /** Gets interstitial ad async. */
  const getInterstitialAdAsync = jest.fn(async (placement: string) => {requestedPlacement = placement; return ad;});
  return {ad, getInterstitialAdAsync, sdk: {
    getInterstitialAdAsync, getSupportedAPIs: () => ["getInterstitialAdAsync"],
  } as unknown as FacebookInstantSdk};
};

/** Provides SDK with an opt-in rewarded video placement. */
const sdkWithRewardedAd = () => {
  let requestedPlacement = "";
  /** Provides ad behavior. */
  const ad = {getPlacementID: jest.fn(() => requestedPlacement), loadAsync: jest.fn<() => Promise<void>>(async () => undefined),
    showAsync: jest.fn<() => Promise<void>>(async () => undefined)};
  /** Gets rewarded video async. */
  const getRewardedVideoAsync = jest.fn(async (placement: string) => {requestedPlacement = placement; return ad;});
  return {ad, getRewardedVideoAsync, sdk: {
    getRewardedVideoAsync, getSupportedAPIs: () => ["getRewardedVideoAsync"],
  } as unknown as FacebookInstantSdk};
};

/** Test hosts advertise the native ad format under examination. */
const requireAds = (options: Parameters<typeof createFacebookAdsCapability>[0]) => {
  const ads = createFacebookAdsCapability(options);
  if (!ads) throw new Error("Expected the test host to expose its ad capability.");
  return ads;
};

/** Lets entitlement or result ownership change while the provider is loading. */
const deferred = () => {
  let resolve: () => void;
  const promise = new Promise<void>(accept => {resolve = accept;});
  return {promise, resolve: () => resolve()};
};

const adFormats: FacebookAdFormat[] = ["interstitial", "rewarded"];

describe("Facebook interstitial trace integration", () => {
  const prefix = "riddle-quest:facebook:interstitial:";
  const originalPerformance = Object.getOwnPropertyDescriptor(globalThis, "performance");
  const phases = () => timeline.getEntriesByType("mark").filter(entry => entry.name.startsWith(prefix))
    .map(entry => entry.name.slice(prefix.length));
  beforeEach(() => {
    Object.defineProperty(globalThis, "performance", {configurable: true, value: timeline});
  });
  afterEach(() => {
    if (originalPerformance) Object.defineProperty(globalThis, "performance", originalPerformance);
    else Reflect.deleteProperty(globalThis, "performance");
    for (const phase of phases()) timeline.clearMarks(prefix + phase);
  });

  it("records each deferred admission boundary without changing SDK or predicate calls", async () => {
    const harness = sdkWithAd();
    const initialEligibility = deferred(), secondEligibility = deferred(), secondReading = deferred();
    const guarding = deferred(), guardEntered = deferred(), creating = deferred(), createEntered = deferred();
    const loading = deferred(), loadEntered = deferred(), showing = deferred(), showEntered = deferred();
    const trace = createFacebookInterstitialTrace();
    const lease = trace.begin();
    const refreshEligibility = jest.fn<(format: FacebookAdFormat) => Promise<boolean>>()
      .mockImplementationOnce(async () => {await initialEligibility.promise; return true;})
      .mockImplementationOnce(async () => {secondReading.resolve(); await secondEligibility.promise; return true;});
    const isActive = jest.fn(() => true), presentationIsCurrent = jest.fn(() => true);
    const capturePresentation = jest.fn(() => presentationIsCurrent), isPlacementCurrent = jest.fn(() => true);
    const adFree = jest.fn(() => false), now = jest.fn(() => 1_000_000);
    const beforeOpen = jest.fn(async () => {guardEntered.resolve(); await guarding.promise;});
    const afterClose = jest.fn(() => undefined);
    const unregister = registerFacebookSdkDialogGuard(harness.sdk, {beforeOpen, afterClose});
    harness.getInterstitialAdAsync.mockImplementation(async placement => {
      createEntered.resolve();
      await creating.promise;
      harness.ad.getPlacementID.mockReturnValue(placement);
      return harness.ad;
    });
    harness.ad.loadAsync.mockImplementation(async () => {loadEntered.resolve(); await loading.promise;});
    harness.ad.showAsync.mockImplementation(async () => {showEntered.resolve(); await showing.promise;});
    const options = {sdk: harness.sdk, placementId: "result-placement", adFree, isActive, capturePresentation,
      refreshEligibility, captureInterstitialTrace: trace.capture, now};
    const ads = requireAds(options);
    const result = ads.showInterstitial("result", isPlacementCurrent);
    try {
      expect(phases()).toEqual(["completion", "admission", "eligibility-initial"]);
      expect(refreshEligibility).toHaveBeenCalledTimes(1);
      expect(harness.getInterstitialAdAsync).not.toHaveBeenCalled();

      initialEligibility.resolve();
      await guardEntered.promise;
      expect(phases().slice(-2)).toEqual(["eligibility-initial-resolved", "dialog-guard"]);
      expect(harness.getInterstitialAdAsync).not.toHaveBeenCalled();
      guarding.resolve();
      await createEntered.promise;
      expect(phases().slice(-2)).toEqual(["dialog-operation", "create-invoked"]);
      expect(harness.ad.loadAsync).not.toHaveBeenCalled();
      creating.resolve();
      await loadEntered.promise;
      expect(phases().slice(-3)).toEqual(["create-resolved", "placement-before-load", "load-invoked"]);
      expect(harness.ad.getPlacementID).toHaveBeenCalledTimes(1);
      loading.resolve();
      await secondReading.promise;
      expect(phases().slice(-2)).toEqual(["load-resolved", "eligibility-after-load"]);
      expect(harness.ad.showAsync).not.toHaveBeenCalled();
      secondEligibility.resolve();
      await showEntered.promise;
      expect(phases().slice(-3)).toEqual(["eligibility-after-load-resolved", "placement-before-show", "show-invoked"]);
      showing.resolve();
      await expect(result).resolves.toEqual({status: "success", value: undefined});
      expect(phases()).toEqual(expect.arrayContaining(["show-resolved", "success"]));
      expect(harness.getInterstitialAdAsync).toHaveBeenCalledTimes(1);
      expect(harness.getInterstitialAdAsync).toHaveBeenCalledWith("result-placement");
      expect(harness.ad.loadAsync).toHaveBeenCalledTimes(1);
      expect(harness.ad.showAsync).toHaveBeenCalledTimes(1);
      expect(harness.ad.getPlacementID).toHaveBeenCalledTimes(2);
      expect(refreshEligibility.mock.calls).toEqual([["interstitial"], ["interstitial"]]);
      expect(beforeOpen).toHaveBeenCalledTimes(1);
      expect(afterClose).toHaveBeenCalledTimes(1);
      expect(capturePresentation).toHaveBeenCalledTimes(1);
      expect(isActive).toHaveBeenCalledTimes(8);
      expect(presentationIsCurrent).toHaveBeenCalledTimes(7);
      expect(isPlacementCurrent).toHaveBeenCalledTimes(7);
      expect(adFree).toHaveBeenCalledTimes(6);
      expect(now).toHaveBeenCalledTimes(2);
    } finally {
      for (const held of [initialEligibility, guarding, creating, loading, secondEligibility, showing]) held.resolve();
      await result;
      unregister();
      lease.close();
    }
  });

  it("identifies inactive-account suppression without evaluating later admission checks", async () => {
    const harness = sdkWithAd(), trace = createFacebookInterstitialTrace();
    trace.begin();
    const isActive = jest.fn(() => false), presentationIsCurrent = jest.fn(() => true);
    const isPlacementCurrent = jest.fn(() => true), refreshEligibility = jest.fn(async () => true);
    const adFree = jest.fn(() => false), now = jest.fn(() => 1_000_000);
    const ads = requireAds({sdk: harness.sdk, placementId: "result-placement", adFree, isActive,
      capturePresentation: () => presentationIsCurrent, refreshEligibility,
      captureInterstitialTrace: trace.capture, now});

    await expect(ads.showInterstitial("result", isPlacementCurrent)).resolves.toMatchObject({status: "unavailable"});
    expect(phases()).toEqual(expect.arrayContaining(["admission", "account-inactive", "unavailable"]));
    expect(phases()).not.toContain("eligibility-initial");
    expect(isActive).toHaveBeenCalledTimes(1);
    expect(presentationIsCurrent).not.toHaveBeenCalled();
    expect(isPlacementCurrent).not.toHaveBeenCalled();
    expect(refreshEligibility).not.toHaveBeenCalled();
    expect(harness.getInterstitialAdAsync).not.toHaveBeenCalled();
    expect(adFree).toHaveBeenCalledTimes(1);
    expect(now).toHaveBeenCalledTimes(1);
    trace.retire();
  });

  it.each(["eligibility", "show"] as const)("keeps a retired visit's late %s settlement out of its successor capture", async boundary => {
    const harness = sdkWithAd(), held = deferred(), entered = deferred();
    const oldVisit = createFacebookInterstitialTrace();
    oldVisit.begin();
    let active = true, foreground = true, settled = false;
    const refreshEligibility = jest.fn(async () => {
      if (boundary === "eligibility") {entered.resolve(); await held.promise;}
      return true;
    });
    harness.ad.showAsync.mockImplementation(async () => {entered.resolve(); await held.promise;});
    const ads = requireAds({sdk: harness.sdk, placementId: "result-placement", adFree: false,
      isActive: () => active, capturePresentation: () => () => foreground, refreshEligibility,
      captureInterstitialTrace: oldVisit.capture, now: () => 1_000_000});
    const result = ads.showInterstitial("result").then(value => {settled = true; return value;});
    try {
      await entered.promise;
      oldVisit.retire();
      active = false;
      foreground = false;
      const successor = createFacebookInterstitialTrace();
      const next = successor.begin();
      next.record("eligibility-initial");
      const successorMarks = timeline.getEntriesByType("mark").filter(entry => entry.name.startsWith(prefix));
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(harness.ad.showAsync).toHaveBeenCalledTimes(boundary === "show" ? 1 : 0);
      held.resolve();
      await expect(result).resolves.toMatchObject({status: boundary === "show" ? "success" : "unavailable"});
      expect(timeline.getEntriesByType("mark").filter(entry => entry.name.startsWith(prefix))).toEqual(successorMarks);
      expect(harness.getInterstitialAdAsync).toHaveBeenCalledTimes(boundary === "show" ? 1 : 0);
      expect(harness.ad.showAsync).toHaveBeenCalledTimes(boundary === "show" ? 1 : 0);
      next.record("finished");
      expect(phases()).toEqual(["completion", "eligibility-initial", "finished"]);
      next.close();
    } finally {
      held.resolve();
      await result;
      oldVisit.retire();
    }
  });

  it("keeps successful SDK admission unchanged when Performance is unavailable", async () => {
    Object.defineProperty(globalThis, "performance", {configurable: true,
      get: () => {throw new Error("User Timing unavailable");}});
    const harness = sdkWithAd(), trace = createFacebookInterstitialTrace();
    trace.begin();
    const refreshEligibility = jest.fn(async () => true);
    const ads = requireAds({sdk: harness.sdk, placementId: "result-placement", adFree: false,
      refreshEligibility, captureInterstitialTrace: trace.capture, now: () => 1_000_000});
    await expect(ads.showInterstitial("result")).resolves.toEqual({status: "success", value: undefined});
    expect(refreshEligibility).toHaveBeenCalledTimes(2);
    expect(harness.getInterstitialAdAsync).toHaveBeenCalledTimes(1);
    expect(harness.ad.loadAsync).toHaveBeenCalledTimes(1);
    expect(harness.ad.showAsync).toHaveBeenCalledTimes(1);
    expect(phases()).toEqual([]);
    trace.retire();
  });

  it("keeps an admitted display bound to its captured lease when the same visit begins another completion", async () => {
    const harness = sdkWithAd(), showing = deferred(), entered = deferred();
    const trace = createFacebookInterstitialTrace();
    trace.begin();
    harness.ad.showAsync.mockImplementation(async () => {entered.resolve(); await showing.promise;});
    const ads = requireAds({sdk: harness.sdk, placementId: "result-placement", adFree: false,
      captureInterstitialTrace: trace.capture, now: () => 1_000_000});
    const result = ads.showInterstitial("result");
    try {
      await entered.promise;
      const next = trace.begin();
      next.record("cadence-one");
      const successorMarks = timeline.getEntriesByType("mark").filter(entry => entry.name.startsWith(prefix));
      showing.resolve();
      await expect(result).resolves.toEqual({status: "success", value: undefined});
      expect(timeline.getEntriesByType("mark").filter(entry => entry.name.startsWith(prefix))).toEqual(successorMarks);
      expect(harness.ad.showAsync).toHaveBeenCalledTimes(1);
      expect(trace.capture()).toBe(next);
      next.close();
    } finally {
      showing.resolve();
      await result;
      trace.retire();
    }
  });
});

describe.each(adFormats)("Facebook %s returned placement binding", format => {
  const fixture = () => {
    const harness = format === "interstitial" ? sdkWithAd() : sdkWithRewardedAd();
    let active = true;
    const expected = format === "interstitial" ? "result-placement" : "continue-placement";
    const ads = requireAds({sdk: harness.sdk, placementId: " result-placement ", rewardedPlacementId: " continue-placement ",
      rewardedEnabled: true, adFree: false, isActive: () => active, now: () => 1_000_000});
    return {...harness, expected, setActive: (value: boolean) => {active = value;},
      show: () => format === "interstitial" ? ads.showInterstitial("result") : ads.showRewarded("continue")};
  };

  const inheritAdMethods = (ad: ReturnType<typeof sdkWithAd>["ad"], getPlacementID: () => unknown) => {
    const prototype = {getPlacementID, loadAsync: ad.loadAsync, showAsync: ad.showAsync};
    for (const method of ["getPlacementID", "loadAsync", "showAsync"]) Reflect.deleteProperty(ad, method);
    Object.setPrototypeOf(ad, prototype);
    return prototype;
  };

  it("loads and shows a native inherited-method handle whose placement metadata is undefined", async () => {
    const harness = fixture();
    const getPlacementID = jest.fn<() => unknown>(() => undefined);
    const native = inheritAdMethods(harness.ad, getPlacementID);
    expect(await harness.show()).toEqual({status: "success", value: undefined});
    expect(format === "interstitial" ? harness.sdk.getInterstitialAdAsync : harness.sdk.getRewardedVideoAsync)
      .toHaveBeenCalledWith(harness.expected);
    expect(getPlacementID).toHaveBeenCalledTimes(2);
    expect(getPlacementID.mock.contexts).toEqual([harness.ad, harness.ad]);
    expect(native.loadAsync).toHaveBeenCalledTimes(1);
    expect(native.showAsync).toHaveBeenCalledTimes(1);
    expect(getPlacementID.mock.invocationCallOrder[0]).toBeLessThan(native.loadAsync.mock.invocationCallOrder[0]!);
    expect(native.loadAsync.mock.invocationCallOrder[0]).toBeLessThan(getPlacementID.mock.invocationCallOrder[1]!);
    expect(getPlacementID.mock.invocationCallOrder[1]).toBeLessThan(native.showAsync.mock.invocationCallOrder[0]!);
  });

  it("rejects reported placement mismatch after initially omitted metadata before display", async () => {
    const harness = fixture();
    const getPlacementID = jest.fn<() => unknown>(() => "replacement-placement").mockReturnValueOnce(undefined);
    const native = inheritAdMethods(harness.ad, getPlacementID);
    expect(await harness.show()).toEqual({status: "retryable-failure", message: "facebook-ad-placement-invalid"});
    expect(getPlacementID).toHaveBeenCalledTimes(2);
    expect(native.loadAsync).toHaveBeenCalledTimes(1);
    expect(native.showAsync).not.toHaveBeenCalled();
  });

  it.each(["missing", "non-callable", "null", "malformed", "empty", "mismatched", "padded", "throwing"])(
    "rejects a %s placement getter before loading and allows a valid retry without consuming cooldown",
    async fault => {
      const harness = fixture();
      if (fault === "missing") Reflect.deleteProperty(harness.ad, "getPlacementID");
      else Object.defineProperty(harness.ad, "getPlacementID", {configurable: true, value:
        fault === "non-callable" ? harness.expected :
          fault === "null" ? () => null :
            fault === "malformed" ? () => 42 :
              fault === "empty" ? () => "" :
                fault === "mismatched" ? () => "another-format-placement" :
                  fault === "padded" ? () => ` ${harness.expected} ` :
                    () => {throw {code: "USER_INPUT", message: "Private provider failure"};}});

      expect(await harness.show()).toEqual({status: "retryable-failure", message: "facebook-ad-placement-invalid"});
      expect(harness.ad.loadAsync).not.toHaveBeenCalled();
      expect(harness.ad.showAsync).not.toHaveBeenCalled();
      Object.defineProperty(harness.ad, "getPlacementID", {configurable: true, value: () => harness.expected});
      expect(await harness.show()).toEqual({status: "success", value: undefined});
      expect(harness.ad.loadAsync).toHaveBeenCalledTimes(1);
      expect(harness.ad.showAsync).toHaveBeenCalledTimes(1);
    },
  );

  it("refuses to display a placement that changes during loading and preserves retry eligibility", async () => {
    const harness = fixture();
    harness.ad.loadAsync.mockImplementationOnce(async () => {harness.ad.getPlacementID.mockReturnValue("replacement-placement");});
    expect(await harness.show()).toEqual({status: "retryable-failure", message: "facebook-ad-placement-invalid"});
    expect(harness.ad.loadAsync).toHaveBeenCalledTimes(1);
    expect(harness.ad.showAsync).not.toHaveBeenCalled();
    harness.ad.getPlacementID.mockReturnValue(harness.expected);
    expect(await harness.show()).toEqual({status: "success", value: undefined});
    expect(harness.ad.loadAsync).toHaveBeenCalledTimes(2);
    expect(harness.ad.showAsync).toHaveBeenCalledTimes(1);
  });

  it.each(["load", "show"])("does not admit %s if the native placement getter retires its account", async phase => {
    const harness = fixture();
    let reads = 0;
    harness.ad.getPlacementID.mockImplementation(() => {
      reads++;
      if (reads === (phase === "load" ? 1 : 2)) harness.setActive(false);
      return harness.expected;
    });
    expect(await harness.show()).toMatchObject({status: "unavailable"});
    expect(harness.ad.loadAsync).toHaveBeenCalledTimes(phase === "load" ? 0 : 1);
    expect(harness.ad.showAsync).not.toHaveBeenCalled();
    harness.setActive(true);
    harness.ad.getPlacementID.mockReturnValue(harness.expected);
    expect(await harness.show()).toEqual({status: "success", value: undefined});
    expect(harness.ad.showAsync).toHaveBeenCalledTimes(1);
  });
});

describe("Facebook ads capability", () => {
  it("keeps a rewarded retry offer while unknown and acquires the SDK ad only after verification recovers", async () => {
    const harness = sdkWithRewardedAd();
    const initial = {interstitialsEnabled: true, rewardedAdsEnabled: true, removeInterstitialAds: false};
    const read = jest.fn(async () => ({...initial, hasActiveSubscription: false}));
    const configuration = createFacebookAdConfiguration({initial, read, isActive: () => true,
      onChange: () => undefined, reportFailure: () => undefined});
    const ads = requireAds({sdk: harness.sdk, placementId: "", rewardedPlacementId: "continue-placement",
      rewardedEnabled: () => configuration.allows("rewarded"),
      rewardedOfferAvailable: () => configuration.canOffer("rewarded"),
      adFree: () => !configuration.allows("interstitial"), refreshEligibility: configuration.refreshEligibility,
      now: () => 1_000_000});
    expect(ads.rewardedAvailable).toBe(true);
    expect(harness.getRewardedVideoAsync).not.toHaveBeenCalled();
    read.mockRejectedValueOnce(new Error("Subscription temporarily unavailable"));
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "unavailable"});
    expect(ads.rewardedAvailable).toBe(true);
    expect(harness.getRewardedVideoAsync).not.toHaveBeenCalled();
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "success"});
    expect(harness.getRewardedVideoAsync).toHaveBeenCalledTimes(1);
    expect(harness.ad.showAsync).toHaveBeenCalledTimes(1);
    read.mockResolvedValue({...initial, hasActiveSubscription: true});
    await configuration.refresh();
    expect(ads.rewardedAvailable).toBe(false);
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "unavailable"});
    expect(harness.getRewardedVideoAsync).toHaveBeenCalledTimes(1);
  });

  it("does not expose formats that the current Meta host fails to advertise", () => {
    /** SDK methods may exist for formats that are unavailable on this platform. */
    const harness = sdkWithAd();
    harness.sdk.getSupportedAPIs = () => [];
    expect(createFacebookAdsCapability({sdk: harness.sdk, placementId: "result", adFree: false})).toBeUndefined();
    /** Rewarded availability must be advertised independently. */
    const rewarded = sdkWithRewardedAd();
    rewarded.sdk.getSupportedAPIs = () => ["getInterstitialAdAsync"];
    expect(createFacebookAdsCapability({sdk: rewarded.sdk, placementId: "", rewardedPlacementId: "continue", rewardedEnabled: true, adFree: false})).toBeUndefined();
  });

  it("loads then shows only at a result and records only a successful impression", async () => {
    /** Provides harness behavior. */
    const harness = sdkWithAd();
    /** Provides now ms behavior. */
    let nowMs = 1_000_000;
    /** Provides ads behavior. */
    const ads = createFacebookAdsCapability({
      sdk: harness.sdk,
      placementId: "result-placement",
      adFree: false,
      now: () => nowMs,
    })!;

    await expect(ads.showInterstitial("startup")).resolves.toMatchObject({status: "unavailable"});
    await expect(ads.showInterstitial("result")).resolves.toEqual({status: "success", value: undefined});
    expect(harness.getInterstitialAdAsync).toHaveBeenCalledWith("result-placement");
    expect(harness.ad.loadAsync.mock.invocationCallOrder[0]).toBeLessThan(
      harness.ad.showAsync.mock.invocationCallOrder[0]!,
    );
    await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "unavailable"});
    nowMs += 90_000;
    await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "success"});
  });

  it("fails closed for missing configuration, ad-free accounts, and SDK failures", async () => {
    /** Provides harness behavior. */
    const harness = sdkWithAd();
    expect(createFacebookAdsCapability({sdk: harness.sdk, placementId: "", adFree: false})).toBeUndefined();
    /** Provides ad free behavior. */
    const adFree = createFacebookAdsCapability({sdk: harness.sdk, placementId: "result", adFree: true})!;
    await expect(adFree.showInterstitial("result")).resolves.toMatchObject({status: "unavailable"});
    harness.ad.showAsync.mockRejectedValueOnce(new Error("ADS_NO_FILL"));
    /** Provides failing behavior. */
    const failing = createFacebookAdsCapability({sdk: harness.sdk, placementId: "result", adFree: false})!;
    await expect(failing.showInterstitial("result")).resolves.toEqual({
      status: "retryable-failure",
      message: "ADS_NO_FILL",
    });
    await expect(failing.showRewarded("coins")).resolves.toMatchObject({status: "unavailable"});
  });

  it("shows only the allowlisted opt-in rewarded placement and suppresses a following interstitial", async () => {
    /** Provides rewarded behavior. */
    const rewarded = sdkWithRewardedAd();
    /** Provides now ms behavior. */
    let nowMs = 1_000_000;
    /** Provides ads behavior. */
    const ads = createFacebookAdsCapability({
      sdk: rewarded.sdk,
      placementId: "",
      rewardedPlacementId: "continue-placement",
      rewardedEnabled: true,
      adFree: false,
      now: () => nowMs,
    })!;

    await expect(ads.showRewarded("coins")).resolves.toMatchObject({status: "unavailable"});
    await expect(ads.showRewarded("continue")).resolves.toEqual({status: "success", value: undefined});
    expect(rewarded.getRewardedVideoAsync).toHaveBeenCalledWith("continue-placement");

    /** Provides both behavior. */
    const both = sdkWithAd();
    (both.sdk as FacebookInstantSdk).getRewardedVideoAsync = rewarded.getRewardedVideoAsync;
    both.sdk.getSupportedAPIs = () => ["getInterstitialAdAsync", "getRewardedVideoAsync"];
    /** Provides combined behavior. */
    const combined = createFacebookAdsCapability({
      sdk: both.sdk,
      placementId: "result-placement",
      rewardedPlacementId: "continue-placement",
      rewardedEnabled: true,
      adFree: false,
      now: () => nowMs,
    })!;
    await expect(combined.showRewarded("continue")).resolves.toMatchObject({status: "success"});
    await expect(combined.showInterstitial("result")).resolves.toMatchObject({status: "unavailable"});
    nowMs += 90_000;
    await expect(combined.showInterstitial("result")).resolves.toMatchObject({status: "success"});
  });

  it("suppresses concurrent callbacks and starts cooldown when the impression finishes", async () => {
    /** Provides harness behavior. */
    const harness = sdkWithAd();
    /** Provides release load behavior. */
    let releaseLoad!: () => void;
    harness.ad.loadAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseLoad = resolve;
        }),
    );
    /** Provides now ms behavior. */
    let nowMs = 1_000_000;
    /** Provides ads behavior. */
    const ads = createFacebookAdsCapability({
      sdk: harness.sdk,
      placementId: "result",
      adFree: false,
      now: () => nowMs,
    })!;

    /** Provides first behavior. */
    const first = ads.showInterstitial("result");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "unavailable"});
    expect(harness.getInterstitialAdAsync).toHaveBeenCalledTimes(1);
    nowMs += 60_000;
    releaseLoad();
    await expect(first).resolves.toMatchObject({status: "success"});
    nowMs += 89_999;
    await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "unavailable"});
    nowMs += 1;
    await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "success"});
  });

  it("contains clock failures and permanently suppresses after an unrecordable displayed impression", async () => {
    /** Provides before behavior. */
    const before = sdkWithAd();
    /** Provides invalid before behavior. */
    const invalidBefore = createFacebookAdsCapability({
      sdk: before.sdk,
      placementId: "result",
      adFree: false,
      now: () => {
        throw new Error("clock unavailable");
      },
    })!;
    await expect(invalidBefore.showInterstitial("result")).resolves.toEqual({
      status: "unavailable",
      message: "facebook-interstitial-clock-invalid",
    });
    expect(before.getInterstitialAdAsync).not.toHaveBeenCalled();

    /** Provides after behavior. */
    const after = sdkWithAd();
    /** Provides times behavior. */
    const times = [1_000_000, 999_999, 2_000_000];
    /** Provides invalid after behavior. */
    const invalidAfter = createFacebookAdsCapability({
      sdk: after.sdk,
      placementId: "result",
      adFree: false,
      now: () => times.shift()!,
    })!;
    await expect(invalidAfter.showInterstitial("result")).resolves.toEqual({
      status: "retryable-failure",
      message: "facebook-interstitial-clock-invalid",
    });
    expect(after.ad.showAsync).toHaveBeenCalledTimes(1);
    await expect(invalidAfter.showInterstitial("result")).resolves.toEqual({
      status: "unavailable",
      message: "facebook-interstitial-suppressed",
    });
    expect(after.getInterstitialAdAsync).toHaveBeenCalledTimes(1);
  });

  it.each(adFormats)("does not request a %s SDK ad when refreshed eligibility denies it", async format => {
    const harness = format === "interstitial" ? sdkWithAd() : sdkWithRewardedAd();
    const request = "getInterstitialAdAsync" in harness ? harness.getInterstitialAdAsync : harness.getRewardedVideoAsync;
    const refreshEligibility = jest.fn<(format: FacebookAdFormat) => Promise<boolean>>().mockResolvedValue(false);
    const ads = requireAds({sdk: harness.sdk, placementId: "result", rewardedPlacementId: "continue",
      rewardedEnabled: true, adFree: false, refreshEligibility});
    const show = () => format === "interstitial" ? ads.showInterstitial("result") : ads.showRewarded("continue");
    await expect(show()).resolves.toMatchObject({status: "unavailable"});
    expect(refreshEligibility).toHaveBeenCalledWith(format);
    expect(request).not.toHaveBeenCalled();
    expect(harness.ad.showAsync).not.toHaveBeenCalled();

    refreshEligibility.mockResolvedValue(true);
    await expect(show()).resolves.toMatchObject({status: "success"});
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(adFormats)("contains a failed %s eligibility refresh before invoking the SDK", async format => {
    const harness = format === "interstitial" ? sdkWithAd() : sdkWithRewardedAd();
    const request = "getInterstitialAdAsync" in harness ? harness.getInterstitialAdAsync : harness.getRewardedVideoAsync;
    const refreshEligibility = jest.fn<(format: FacebookAdFormat) => Promise<boolean>>()
      .mockRejectedValueOnce(new Error("configuration unavailable")).mockResolvedValue(true);
    const ads = requireAds({sdk: harness.sdk, placementId: "result", rewardedPlacementId: "continue",
      rewardedEnabled: true, adFree: false, refreshEligibility});
    const show = () => format === "interstitial" ? ads.showInterstitial("result") : ads.showRewarded("continue");
    await expect(show()).resolves.toMatchObject({status: "retryable-failure"});
    expect(request).not.toHaveBeenCalled();
    expect(harness.ad.showAsync).not.toHaveBeenCalled();
    await expect(show()).resolves.toMatchObject({status: "success"});
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(adFormats)("rechecks subscription eligibility after a %s ad finishes loading", async format => {
    const harness = format === "interstitial" ? sdkWithAd() : sdkWithRewardedAd();
    const loading = deferred(), started = deferred();
    harness.ad.loadAsync.mockImplementationOnce(() => {started.resolve(); return loading.promise;});
    let serverConfiguration = {interstitialsEnabled: true, rewardedAdsEnabled: true, removeInterstitialAds: false, hasActiveSubscription: false};
    const read = jest.fn(async () => serverConfiguration);
    const configuration = createFacebookAdConfiguration({initial: serverConfiguration, read,
      isActive: () => true, onChange: jest.fn(), reportFailure: jest.fn()});
    const ads = requireAds({sdk: harness.sdk, placementId: "result", rewardedPlacementId: "continue",
      rewardedEnabled: () => configuration.allows("rewarded"), adFree: () => !configuration.allows("interstitial"),
      refreshEligibility: configuration.refreshEligibility});
    const result = format === "interstitial" ? ads.showInterstitial("result") : ads.showRewarded("continue");
    await started.promise;
    serverConfiguration = {...serverConfiguration, hasActiveSubscription: true};
    loading.resolve();
    await expect(result).resolves.toMatchObject({status: "unavailable"});
    expect(read).toHaveBeenCalledTimes(2);
    expect(harness.ad.showAsync).not.toHaveBeenCalled();
    expect(configuration.allows("interstitial")).toBe(false);
    expect(configuration.allows("rewarded")).toBe(false);
  });

  it.each(adFormats)("does not acquire an initial %s ad while entitlement is unknown or after its account retires", async format => {
    const harness = format === "interstitial" ? sdkWithAd() : sdkWithRewardedAd();
    const awaitingEntitlement = deferred(), reading = deferred();
    let active = true;
    const initial = {interstitialsEnabled: true, rewardedAdsEnabled: true, removeInterstitialAds: false};
    const configuration = createFacebookAdConfiguration({initial,
      read: async () => {reading.resolve(); await awaitingEntitlement.promise; return {...initial, hasActiveSubscription: false};},
      isActive: () => active, onChange: jest.fn(), reportFailure: jest.fn()});
    const ads = requireAds({sdk: harness.sdk, placementId: "result", rewardedPlacementId: "continue",
      rewardedEnabled: () => configuration.allows("rewarded"), rewardedOfferAvailable: () => configuration.canOffer("rewarded"),
      adFree: () => !configuration.allows("interstitial"), isActive: () => active, refreshEligibility: configuration.refreshEligibility});
    const result = format === "interstitial" ? ads.showInterstitial("result") : ads.showRewarded("continue");
    await reading.promise;
    const request = format === "interstitial" ? harness.sdk.getInterstitialAdAsync : harness.sdk.getRewardedVideoAsync;
    expect(request).not.toHaveBeenCalled();
    active = false;
    awaitingEntitlement.resolve();
    await expect(result).resolves.toMatchObject({status: "unavailable"});
    expect(request).not.toHaveBeenCalled();
    expect(harness.ad.showAsync).not.toHaveBeenCalled();
  });

  it.each(["dismissed", "replaced"])("never displays a loaded interstitial after its result is %s", async reason => {
    const harness = sdkWithAd(), loading = deferred(), started = deferred();
    harness.ad.loadAsync.mockImplementationOnce(() => {started.resolve(); return loading.promise;});
    const ads = requireAds({sdk: harness.sdk, placementId: "result", adFree: false});
    const show = jest.fn(async (isCurrent: () => boolean) => {
      await expect(ads.showInterstitial("result", isCurrent)).resolves.toMatchObject({status: "unavailable"});
    });
    const cadence = createFacebookLevelInterstitial({show, isActive: () => true});
    const puzzle = (index: number): HostCompletionInput => ({gameMode: "classic",
      riddleId: `riddle-${index}`, sessionToken: `issued-session-${index}`});
    const win: CompletionResult = {attempts: 1, isCorrect: true, coinsEarned: 50, newlyUnlockedAchievementIds: []};
    await cadence.complete(puzzle(1), win);
    await cadence.complete(puzzle(2), win);
    const pending = cadence.complete(puzzle(3), win);
    await started.promise;
    if (reason === "dismissed") cadence.dismiss(completionPresentationKey(puzzle(3)));
    else await cadence.complete(puzzle(4), win);
    loading.resolve();
    await pending;
    expect(harness.getInterstitialAdAsync).toHaveBeenCalledTimes(1);
    expect(harness.ad.showAsync).not.toHaveBeenCalled();
  });

  it("allows voluntary rewarded video when only the durable interstitial entitlement is active", async () => {
    const harness = sdkWithAd(), rewarded = sdkWithRewardedAd();
    harness.sdk.getRewardedVideoAsync = rewarded.getRewardedVideoAsync;
    harness.sdk.getSupportedAPIs = () => ["getInterstitialAdAsync", "getRewardedVideoAsync"];
    const ads = requireAds({sdk: harness.sdk, placementId: "result", rewardedPlacementId: "continue",
      rewardedEnabled: true, adFree: true});
    await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "unavailable"});
    expect(harness.getInterstitialAdAsync).not.toHaveBeenCalled();
    expect(ads.rewardedAvailable).toBe(true);
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "success"});
    expect(rewarded.getRewardedVideoAsync).toHaveBeenCalledTimes(1);
    expect(rewarded.ad.showAsync).toHaveBeenCalledTimes(1);
  });
});
