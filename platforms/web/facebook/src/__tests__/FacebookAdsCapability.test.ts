import {describe, expect, it, jest} from "@jest/globals";
import {createFacebookAdsCapability} from "../FacebookAdsCapability";
import {createFacebookAdConfiguration, type FacebookAdFormat} from "../FacebookAdConfiguration";
import {createFacebookLevelInterstitial} from "../FacebookLevelInterstitial";
import {completionPresentationKey} from "../../../../../src/gameplay/session/completion/completionPresentation";
import type {CompletionResult} from "../../../../../src/platform/contracts/hostServices";
import type {HostCompletionInput} from "../../../../../src/progression/browser/hostCompletionEffects";
import type {FacebookInstantSdk} from "../fbinstant";

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

/** Valid test hosts always expose their configured placement. */
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

  it.each(["missing", "non-callable", "malformed", "mismatched", "padded", "throwing"])(
    "rejects a %s placement getter before loading and allows a valid retry without consuming cooldown",
    async fault => {
      const harness = fixture();
      if (fault === "missing") Reflect.deleteProperty(harness.ad, "getPlacementID");
      else Object.defineProperty(harness.ad, "getPlacementID", {configurable: true, value:
        fault === "non-callable" ? harness.expected :
          fault === "malformed" ? () => 42 :
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
    let serverConfiguration = {interstitialsEnabled: true, rewardedAdsEnabled: true, removeInterstitialAds: false};
    const read = jest.fn(async () => serverConfiguration);
    const configuration = createFacebookAdConfiguration({initial: serverConfiguration, read,
      isActive: () => true, onChange: jest.fn(), reportFailure: jest.fn()});
    const ads = requireAds({sdk: harness.sdk, placementId: "result", rewardedPlacementId: "continue",
      rewardedEnabled: () => configuration.allows("rewarded"), adFree: () => !configuration.allows("interstitial"),
      refreshEligibility: configuration.refreshEligibility});
    const result = format === "interstitial" ? ads.showInterstitial("result") : ads.showRewarded("continue");
    await started.promise;
    serverConfiguration = {...serverConfiguration, interstitialsEnabled: false, rewardedAdsEnabled: false};
    loading.resolve();
    await expect(result).resolves.toMatchObject({status: "unavailable"});
    expect(read).toHaveBeenCalledTimes(2);
    expect(harness.ad.showAsync).not.toHaveBeenCalled();
    expect(configuration.allows("interstitial")).toBe(false);
    expect(configuration.allows("rewarded")).toBe(false);
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
