import {describe, expect, jest, test} from "@jest/globals";
import {createFacebookNotificationCapability} from "../FacebookNotificationCapability";
import type {FacebookInstantSdk} from "../fbinstant";
import {createFacebookAdsCapability} from "../FacebookAdsCapability";

/** Required Meta APIs advertised by a host capable of prompting. */
const APIs = ["player.canSubscribeBotAsync", "player.isSubscribedBotAsync", "player.subscribeBotAsync"];
/** Builds an isolated Meta subscription fixture without any other platform SDK. */
const fixture = () => {
  /** Provider-owned consent state. */
  let subscribed = false;
  /** SDK methods involved in subscription only. */
  const player = {
    canSubscribeBotAsync: jest.fn(async () => true),
    isSubscribedBotAsync: jest.fn(async () => subscribed),
    subscribeBotAsync: jest.fn(async () => {subscribed = true;}),
  };
  /** Only the adapter's relevant SDK boundary is needed for these tests. */
  const sdk = {player, getSupportedAPIs: () => APIs} as unknown as FacebookInstantSdk;
  return {sdk, player, accept: () => {subscribed = true;}};
};

describe("Facebook bot notification permission", () => {
  test("does not open an ad over Meta's subscription dialog and releases the provider UI afterward", async () => {
    /** Isolated provider fixture. */
    const {sdk, player, accept} = fixture();
    sdk.getSupportedAPIs = () => [...APIs, "getRewardedVideoAsync"];
    sdk.getRewardedVideoAsync = jest.fn(async () => ({loadAsync: async () => undefined, showAsync: async () => undefined}));
    /** Releases the subscription dialog after testing concurrent ad suppression. */
    let release!: () => void;
    /** Signals that Meta UI is currently occupied. */
    let opened!: () => void;
    /** Pending platform dialog. */
    const pending = new Promise<void>(resolve => {release = resolve;});
    /** Test observes the actual dialog call rather than relying on a timeout. */
    const dialogOpened = new Promise<void>(resolve => {opened = resolve;});
    player.subscribeBotAsync.mockImplementation(async () => {opened(); await pending; accept();});
    /** Permission operation under test. */
    const permission = createFacebookNotificationCapability(sdk)!.requestPermission();
    await dialogOpened;
    /** Ad adapter sharing the same Meta SDK instance. */
    const ads = createFacebookAdsCapability({sdk, placementId: "", rewardedPlacementId: "continue", rewardedEnabled: true, adFree: false})!;
    await expect(ads.showRewarded("continue")).resolves.toEqual({status: "unavailable", message: "facebook-provider-dialog-in-progress"});
    expect(sdk.getRewardedVideoAsync).not.toHaveBeenCalled();
    release();
    await permission;
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "success"});
    expect(sdk.getRewardedVideoAsync).toHaveBeenCalledTimes(1);
  });

  test("checks eligibility then confirms Meta consent instead of treating a fulfilled dialog as acceptance", async () => {
    /** Isolated provider fixture. */
    const {sdk, player} = fixture();
    /** Capability under test. */
    const capability = createFacebookNotificationCapability(sdk)!;
    await expect(capability.requestPermission()).resolves.toEqual({status: "success", value: undefined});
    expect(player.canSubscribeBotAsync).toHaveBeenCalledTimes(1);
    expect(player.subscribeBotAsync).toHaveBeenCalledTimes(1);
    expect(player.isSubscribedBotAsync).toHaveBeenCalledTimes(2);
    await expect(capability.requestPermission()).resolves.toMatchObject({status: "success"});
    expect(player.subscribeBotAsync).toHaveBeenCalledTimes(1);
  });

  test("does not prompt existing subscribers or ineligible players", async () => {
    /** Isolated provider fixture. */
    const {sdk, player, accept} = fixture();
    accept();
    await expect(createFacebookNotificationCapability(sdk)!.requestPermission()).resolves.toMatchObject({status: "success"});
    expect(player.canSubscribeBotAsync).not.toHaveBeenCalled();
    expect(player.subscribeBotAsync).not.toHaveBeenCalled();
    player.isSubscribedBotAsync.mockResolvedValue(false);
    player.canSubscribeBotAsync.mockResolvedValue(false);
    await expect(createFacebookNotificationCapability(sdk)!.requestPermission()).resolves.toMatchObject({status: "unavailable"});
    expect(player.subscribeBotAsync).not.toHaveBeenCalled();
  });

  test.each(APIs)("fails closed when the host does not advertise %s", (missing) => {
    /** Isolated provider fixture. */
    const {sdk} = fixture();
    sdk.getSupportedAPIs = () => APIs.filter(api => api !== missing);
    expect(createFacebookNotificationCapability(sdk)).toBeUndefined();
  });

  test("does not expose a capability when an advertised implementation is missing", () => {
    /** Isolated provider fixture. */
    const {sdk} = fixture();
    delete sdk.player.subscribeBotAsync;
    expect(createFacebookNotificationCapability(sdk)).toBeUndefined();
  });

  test.each(["USER_INPUT", "USER_CANCELLED"])("treats Meta %s as dismissal", async (code) => {
    /** Isolated provider fixture. */
    const {sdk, player} = fixture();
    player.subscribeBotAsync.mockRejectedValue({code});
    await expect(createFacebookNotificationCapability(sdk)!.requestPermission()).resolves.toEqual({status: "cancelled"});
  });

  test("never records acceptance without provider consent and bounds errors", async () => {
    /** Isolated provider fixture. */
    const {sdk, player} = fixture();
    player.subscribeBotAsync.mockResolvedValue(undefined);
    /** Capability under test. */
    const capability = createFacebookNotificationCapability(sdk)!;
    await expect(capability.requestPermission()).resolves.toEqual({status: "cancelled"});
    player.isSubscribedBotAsync.mockRejectedValue(new Error("provider-sensitive-detail"));
    await expect(capability.requestPermission()).resolves.toEqual({
      status: "retryable-failure", message: "facebook-notification-prompt-failed",
    });
  });

  test("coalesces concurrent requests and does not manufacture scheduling or cancellation", async () => {
    /** Isolated provider fixture. */
    const {sdk, player, accept} = fixture();
    /** Releases the provider dialog. */
    let release!: () => void;
    /** Provider dialog remains open until the test accepts it. */
    const pending = new Promise<void>(resolve => {release = resolve;});
    /** Signals that the provider dialog has actually opened. */
    let opened!: () => void;
    /** Avoids timing assumptions about asynchronous SDK eligibility checks. */
    const dialogOpened = new Promise<void>(resolve => {opened = resolve;});
    player.subscribeBotAsync.mockImplementation(async () => {opened(); await pending; accept();});
    /** Capability under test. */
    const capability = createFacebookNotificationCapability(sdk)!;
    /** Simultaneous callers share one prompt operation. */
    const attempts = [capability.requestPermission(), capability.requestPermission()];
    await dialogOpened;
    expect(player.subscribeBotAsync).toHaveBeenCalledTimes(1);
    release();
    await expect(Promise.all(attempts)).resolves.toEqual([
      {status: "success", value: undefined}, {status: "success", value: undefined},
    ]);
    expect(player.subscribeBotAsync).toHaveBeenCalledTimes(1);
    await expect(capability.schedule("d1", Date.now(), {})).resolves.toMatchObject({status: "unavailable"});
    await expect(capability.cancel("id")).resolves.toMatchObject({status: "unavailable"});
  });
});
