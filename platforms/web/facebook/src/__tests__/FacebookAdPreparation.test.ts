import {afterEach, describe, expect, it, jest} from "@jest/globals";
import {createFacebookAdsCapability} from "../FacebookAdsCapability";
import {isFacebookSdkDialogOpen, runFacebookSdkDialog} from "../FacebookSdkDialogGate";
import type {FacebookAdInstance, FacebookInstantSdk} from "../fbinstant";

const deadlineMs = 30_000;
const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Value>((accept, fail) => {resolve = accept; reject = fail;});
  return {promise, resolve, reject};
};
const fixture = (format: "rewarded" | "interstitial") => {
  const ad = {getPlacementID: () => "placement", loadAsync: jest.fn<() => Promise<void>>(async () => undefined),
    showAsync: jest.fn<() => Promise<void>>(async () => undefined)};
  const create = jest.fn<() => Promise<FacebookAdInstance>>(async () => ad);
  const sdk = {getSupportedAPIs: () => ["getRewardedVideoAsync", "getInterstitialAdAsync"],
    getRewardedVideoAsync: create, getInterstitialAdAsync: create} as unknown as FacebookInstantSdk;
  const ads = createFacebookAdsCapability({sdk, placementId: "placement", rewardedPlacementId: "placement",
    rewardedEnabled: true, adFree: false, now: () => 1_000_000});
  if (!ads) throw new Error("Expected ad capability");
  return {ad, create, sdk, ads, show: () => format === "rewarded" ? ads.showRewarded("continue") : ads.showInterstitial("result")};
};

afterEach(() => {jest.useRealTimers();});

describe.each(["rewarded", "interstitial"] as const)("Facebook %s preparation deadline", format => {
  it.each(["create", "load"] as const)("releases game UI after stalled %s without admitting a late ad or duplicate preparation", async phase => {
    jest.useFakeTimers();
    const harness = fixture(format);
    const creation = deferred<FacebookAdInstance>();
    const loading = deferred<void>();
    if (phase === "create") harness.create.mockReturnValueOnce(creation.promise);
    else harness.ad.loadAsync.mockImplementationOnce(() => loading.promise);
    let outcome: unknown;
    const pending = harness.show().then(result => {outcome = result;});
    await jest.advanceTimersByTimeAsync(deadlineMs);
    expect(outcome).toEqual({status: "retryable-failure", message: `facebook-ad-${phase}-timeout`});
    await pending;
    expect(isFacebookSdkDialogOpen(harness.sdk)).toBe(false);
    // Eligibility stays visible; admission blocks another attempt until native preparation settles.
    expect(harness.ads.rewardedAvailable).toBe(true);
    expect(harness.ad.showAsync).not.toHaveBeenCalled();
    await expect(harness.show()).resolves.toMatchObject({status: "unavailable"});
    expect(harness.create).toHaveBeenCalledTimes(1);
    await expect(runFacebookSdkDialog(harness.sdk, async () => ({status: "success", value: undefined})))
      .resolves.toMatchObject({status: "success"});

    if (phase === "create") creation.resolve(harness.ad);
    else loading.resolve();
    await jest.advanceTimersByTimeAsync(0);
    expect(harness.ad.showAsync).not.toHaveBeenCalled();
    expect(harness.ad.loadAsync).toHaveBeenCalledTimes(phase === "create" ? 0 : 1);
    expect(harness.ads.rewardedAvailable).toBe(true);
    await expect(harness.show()).resolves.toMatchObject({status: "success"});
    expect(harness.ad.showAsync).toHaveBeenCalledTimes(1);
  });

  it("does not release an admitted native display merely because the preparation deadline passed", async () => {
    jest.useFakeTimers();
    const harness = fixture(format);
    const display = deferred<void>();
    harness.ad.showAsync.mockImplementationOnce(() => display.promise);
    let settled = false;
    const pending = harness.show().then(result => {settled = true; return result;});
    await jest.advanceTimersByTimeAsync(deadlineMs * 2);
    expect(harness.ad.showAsync).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    expect(isFacebookSdkDialogOpen(harness.sdk)).toBe(true);
    display.resolve();
    await expect(pending).resolves.toMatchObject({status: "success"});
    expect(isFacebookSdkDialogOpen(harness.sdk)).toBe(false);
  });

  it("drains a late loading rejection and permits a fresh attempt without keeping a timer", async () => {
    jest.useFakeTimers();
    const harness = fixture(format);
    const loading = deferred<void>();
    harness.ad.loadAsync.mockImplementationOnce(() => loading.promise);
    const pending = harness.show();
    await jest.advanceTimersByTimeAsync(deadlineMs);
    await expect(pending).resolves.toMatchObject({status: "retryable-failure"});
    expect(jest.getTimerCount()).toBe(0);
    loading.reject(new Error("native load ended after observer deadline"));
    await jest.advanceTimersByTimeAsync(0);
    expect(harness.ad.showAsync).not.toHaveBeenCalled();
    await expect(harness.show()).resolves.toMatchObject({status: "success"});
    expect(jest.getTimerCount()).toBe(0);
  });
});
