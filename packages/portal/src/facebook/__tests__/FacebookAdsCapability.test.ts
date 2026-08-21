import {createFacebookAdsCapability} from "../FacebookAdsCapability";
import type {FacebookInstantSdk} from "../fbinstant";

const sdkWithAd = () => {
  const ad = {loadAsync: jest.fn(async () => undefined), showAsync: jest.fn(async () => undefined)};
  const getInterstitialAdAsync = jest.fn(async () => ad);
  return {ad, getInterstitialAdAsync, sdk: {getInterstitialAdAsync} as unknown as FacebookInstantSdk};
};

describe("Facebook ads capability", () => {
  it("loads then shows only at a result and records only a successful impression", async () => {
    const harness = sdkWithAd();
    let nowMs = 1_000_000;
    const ads = createFacebookAdsCapability({
      sdk: harness.sdk,
      placementId: "result-placement",
      adFree: false,
      now: () => nowMs,
    })!;

    await expect(ads.showInterstitial("startup")).resolves.toMatchObject({status: "unavailable"});
    await expect(ads.showInterstitial("result")).resolves.toEqual({status: "success", value: undefined});
    expect(harness.getInterstitialAdAsync).toHaveBeenCalledWith("result-placement");
    expect(harness.ad.loadAsync.mock.invocationCallOrder[0])
      .toBeLessThan(harness.ad.showAsync.mock.invocationCallOrder[0]!);
    await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "unavailable"});
    nowMs += 90_000;
    await expect(ads.showInterstitial("result")).resolves.toMatchObject({status: "success"});
  });

  it("fails closed for missing configuration, ad-free accounts, and SDK failures", async () => {
    const harness = sdkWithAd();
    expect(createFacebookAdsCapability({sdk: harness.sdk, placementId: "", adFree: false})).toBeUndefined();
    const adFree = createFacebookAdsCapability({sdk: harness.sdk, placementId: "result", adFree: true})!;
    await expect(adFree.showInterstitial("result")).resolves.toMatchObject({status: "unavailable"});
    harness.ad.showAsync.mockRejectedValueOnce(new Error("ADS_NO_FILL"));
    const failing = createFacebookAdsCapability({sdk: harness.sdk, placementId: "result", adFree: false})!;
    await expect(failing.showInterstitial("result")).resolves.toEqual({
      status: "retryable-failure",
      message: "ADS_NO_FILL",
    });
    await expect(failing.showRewarded("coins")).resolves.toMatchObject({status: "unavailable"});
  });

  it("suppresses concurrent callbacks and starts cooldown when the impression finishes", async () => {
    const harness = sdkWithAd();
    let releaseLoad!: () => void;
    harness.ad.loadAsync.mockImplementationOnce(() => new Promise<void>((resolve) => { releaseLoad = resolve; }));
    let nowMs = 1_000_000;
    const ads = createFacebookAdsCapability({
      sdk: harness.sdk, placementId: "result", adFree: false, now: () => nowMs,
    })!;

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
    const before = sdkWithAd();
    const invalidBefore = createFacebookAdsCapability({
      sdk: before.sdk,
      placementId: "result",
      adFree: false,
      now: () => { throw new Error("clock unavailable"); },
    })!;
    await expect(invalidBefore.showInterstitial("result")).resolves.toEqual({
      status: "unavailable",
      message: "facebook-interstitial-clock-invalid",
    });
    expect(before.getInterstitialAdAsync).not.toHaveBeenCalled();

    const after = sdkWithAd();
    const times = [1_000_000, 999_999, 2_000_000];
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
