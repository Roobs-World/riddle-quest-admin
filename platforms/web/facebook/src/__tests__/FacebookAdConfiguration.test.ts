import {describe, expect, it, jest} from "@jest/globals";
import {createFacebookAdConfiguration, type FacebookAdFormat} from "../FacebookAdConfiguration";
import {parseFacebookClientConfiguration} from "../facebookCallableResponses";

type Configuration = Parameters<typeof createFacebookAdConfiguration>[0]["initial"];
type VerifiedConfiguration = Awaited<ReturnType<Parameters<typeof createFacebookAdConfiguration>[0]["read"]>>;
const enabled: Configuration = {interstitialsEnabled: true, rewardedAdsEnabled: true, removeInterstitialAds: false};
const eligible: VerifiedConfiguration = {...enabled, hasActiveSubscription: false};
const subscribed: VerifiedConfiguration = {...enabled, hasActiveSubscription: true};
const adFormats: FacebookAdFormat[] = ["interstitial", "rewarded"];

/** Holds a configuration read across a concurrent request or account retirement. */
const deferred = <T>() => {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {resolve = accept; reject = fail;});
  return {promise, resolve: (value: T) => resolve(value), reject: (error: unknown) => reject(error)};
};

const setup = (initial: Configuration = enabled) => {
  const read = jest.fn<() => Promise<VerifiedConfiguration>>().mockResolvedValue({...initial, hasActiveSubscription: false});
  const isActive = jest.fn(() => true), onChange = jest.fn(), reportFailure = jest.fn();
  return {read, isActive, onChange, reportFailure,
    configuration: createFacebookAdConfiguration({initial, read, isActive, onChange, reportFailure})};
};

describe("Facebook ad configuration", () => {
  it("suppresses a verified subscriber even when an older server enables both ad formats", async () => {
    const configuration = createFacebookAdConfiguration({
      initial: enabled,
      read: async () => ({...enabled, hasActiveSubscription: true}),
      isActive: () => true,
      onChange: jest.fn(),
      reportFailure: jest.fn(),
    });
    await configuration.refresh();
    expect(configuration.allows("rewarded")).toBe(false);
    expect(configuration.allows("interstitial")).toBe(false);
  });

  it("offers an unknown rewarded entitlement for retry without authorizing an impression", async () => {
    const {configuration, read} = setup();
    expect(configuration.allows("rewarded")).toBe(false);
    expect(configuration.canOffer("rewarded")).toBe(true);
    read.mockRejectedValueOnce(new Error("temporarily unavailable"));
    await expect(configuration.refreshEligibility("rewarded")).resolves.toBe(false);
    expect(configuration.canOffer("rewarded")).toBe(true);
  });

  it.each(["missing response", "read failure"])("suppresses both formats after %s and recovers on a later valid read", async reason => {
    const {configuration, read, onChange, reportFailure} = setup();
    await configuration.refresh();
    expect(configuration.allows("interstitial")).toBe(true);
    expect(configuration.allows("rewarded")).toBe(true);
    if (reason === "missing response") read.mockImplementationOnce(async () => ({...parseFacebookClientConfiguration(undefined), hasActiveSubscription: false}));
    else read.mockRejectedValueOnce(new Error("configuration unavailable"));
    await configuration.refresh();
    expect(configuration.allows("interstitial")).toBe(false);
    expect(configuration.allows("rewarded")).toBe(false);
    expect(configuration.canOffer("rewarded")).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(reportFailure).toHaveBeenCalledTimes(1);

    await expect(configuration.refreshEligibility("rewarded")).resolves.toBe(true);
    expect(configuration.allows("interstitial")).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(reportFailure).toHaveBeenCalledTimes(1);
  });

  it("shares concurrent resume refreshes and publishes the newly subscribed state once", async () => {
    const {configuration, read, onChange} = setup();
    const pending = deferred<VerifiedConfiguration>();
    read.mockReturnValueOnce(pending.promise);
    const resumes = [configuration.refresh(), configuration.refresh(), configuration.refresh()];
    expect(read).toHaveBeenCalledTimes(1);
    pending.resolve(subscribed);
    await Promise.all(resumes);
    expect(configuration.allows("interstitial")).toBe(false);
    expect(configuration.allows("rewarded")).toBe(false);
    expect(configuration.canOffer("rewarded")).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);

    read.mockResolvedValue(subscribed);
    await configuration.refresh();
    expect(read).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each(adFormats)("requires a fresh %s eligibility read after an older resume request finishes", async format => {
    const {configuration, read} = setup();
    const resumeRead = deferred<VerifiedConfiguration>(), displayRead = deferred<VerifiedConfiguration>(), displayReadStarted = deferred<void>();
    read.mockReturnValueOnce(resumeRead.promise).mockImplementationOnce(() => {
      displayReadStarted.resolve(undefined);
      return displayRead.promise;
    });
    const resume = configuration.refresh();
    const authorized = jest.fn();
    const eligibility = configuration.refreshEligibility(format);
    const observed = eligibility.then(authorized);
    expect(read).toHaveBeenCalledTimes(1);

    resumeRead.resolve(eligible);
    await resume;
    await displayReadStarted.promise;
    expect(read).toHaveBeenCalledTimes(2);
    expect(authorized).not.toHaveBeenCalled();
    displayRead.resolve(subscribed);
    await expect(eligibility).resolves.toBe(false);
    await observed;
    expect(authorized).toHaveBeenCalledWith(false);
  });

  it.each(["success", "failure"])("ignores a late %s after its account retires", async outcome => {
    const {configuration, read, isActive, onChange, reportFailure} = setup();
    const pending = deferred<VerifiedConfiguration>();
    read.mockReturnValueOnce(pending.promise);
    const refreshing = configuration.refreshEligibility("rewarded");
    isActive.mockReturnValue(false);
    if (outcome === "success") pending.resolve(subscribed);
    else pending.reject(new Error("old account request failed"));
    await expect(refreshing).resolves.toBe(false);
    expect(configuration.allows("interstitial")).toBe(false);
    expect(configuration.allows("rewarded")).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(reportFailure).not.toHaveBeenCalled();
    await configuration.refresh();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps durable interstitial removal independent from opt-in rewarded eligibility", async () => {
    const {configuration, read} = setup({...enabled, removeInterstitialAds: true});
    await configuration.refresh();
    expect(configuration.allows("interstitial")).toBe(false);
    expect(configuration.allows("rewarded")).toBe(true);
    read.mockResolvedValueOnce(subscribed);
    await configuration.refresh();
    expect(configuration.allows("interstitial")).toBe(false);
    expect(configuration.allows("rewarded")).toBe(false);
  });

  it("keeps a known subscriber's offer hidden when the next entitlement read fails", async () => {
    const {configuration, read, onChange} = setup();
    read.mockResolvedValueOnce(subscribed);
    await configuration.refresh();
    read.mockRejectedValueOnce(new Error("temporarily unavailable"));
    await configuration.refresh();
    expect(configuration.canOffer("rewarded")).toBe(false);
    expect(configuration.allows("rewarded")).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    await configuration.refresh();
    expect(configuration.canOffer("rewarded")).toBe(true);
    expect(configuration.allows("rewarded")).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
