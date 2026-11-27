import {createFacebookAdsCapability} from "../FacebookAdsCapability";
import type {FacebookInstantSdk} from "../fbinstant";

/** Provides sdk with ad behavior. */
const sdkWithAd = () => {
  /** Provides ad behavior. */
  const ad = {loadAsync: jest.fn(async () => undefined), showAsync: jest.fn(async () => undefined)};
  /** Gets interstitial ad async. */
  const getInterstitialAdAsync = jest.fn(async () => ad);
  return {ad, getInterstitialAdAsync, sdk: {
    getInterstitialAdAsync, getSupportedAPIs: () => ["getInterstitialAdAsync"],
  } as unknown as FacebookInstantSdk};
};

/** Provides SDK with an opt-in rewarded video placement. */
const sdkWithRewardedAd = () => {
  /** Provides ad behavior. */
  const ad = {loadAsync: jest.fn(async () => undefined), showAsync: jest.fn(async () => undefined)};
  /** Gets rewarded video async. */
  const getRewardedVideoAsync = jest.fn(async () => ad);
  return {ad, getRewardedVideoAsync, sdk: {
    getRewardedVideoAsync, getSupportedAPIs: () => ["getRewardedVideoAsync"],
  } as unknown as FacebookInstantSdk};
};

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
});
