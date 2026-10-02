import {createFacebookRewardedContinue} from "../FacebookRewardedContinue";
import type {AdsCapability, PlatformResult} from "../../platform/types";

const input = {gameMode: "classic" as const, riddleId: "classic-1", sessionToken: "session-token-00000001"};
const setup = () => {
  const showRewarded = jest.fn<Promise<PlatformResult<void>>, [string]>().mockResolvedValue({status: "success", value: undefined});
  const ads: AdsCapability = {rewardedAvailable: true, showRewarded, showInterstitial: jest.fn()};
  const claim = jest.fn().mockResolvedValue({newCoins: 0});
  const isActive = jest.fn(() => true);
  return {ads, showRewarded, claim, isActive, capability: createFacebookRewardedContinue({ads, claim, isActive})!};
};

describe("Facebook rewarded extra attempt", () => {
  it("requires an independently enabled placement", () => {
    const s = setup();
    expect(createFacebookRewardedContinue({...s, ads: undefined})).toBeUndefined();
    expect(createFacebookRewardedContinue({...s, ads: {...s.ads, rewardedAvailable: false}})).toBeUndefined();
  });
  it("claims only after the opt-in SDK video resolves and sends no amount or identity", async () => {
    const s = setup();
    await expect(s.capability.request(input)).resolves.toEqual({status: "success", value: {newCoins: 0}});
    expect(s.showRewarded).toHaveBeenCalledWith("continue");
    expect(s.showRewarded.mock.invocationCallOrder[0]).toBeLessThan(s.claim.mock.invocationCallOrder[0]);
    expect(s.claim).toHaveBeenCalledWith({...input, requestId: expect.stringContaining("rewarded-continue")});
  });
  it.each(["cancelled", "unavailable", "retryable-failure"] as const)("never claims on %s", async status => {
    const s = setup();
    s.showRewarded.mockResolvedValueOnce({status, message: "no-fill"} as PlatformResult<void>);
    await expect(s.capability.request(input)).resolves.toMatchObject({status});
    expect(s.claim).not.toHaveBeenCalled();
  });
  it("retries the same server claim without making the player watch again", async () => {
    const s = setup();
    s.claim.mockRejectedValueOnce(new Error("offline"));
    await expect(s.capability.request(input)).resolves.toMatchObject({status: "retryable-failure"});
    await expect(s.capability.request(input)).resolves.toMatchObject({status: "success"});
    expect(s.showRewarded).toHaveBeenCalledTimes(1);
    expect(s.claim.mock.calls[0]).toEqual(s.claim.mock.calls[1]);
  });
  it("does not transfer a completed video to another game session", async () => {
    const s = setup();
    await s.capability.request(input);
    await s.capability.request({...input, sessionToken: "session-token-00000002"});
    expect(s.showRewarded).toHaveBeenCalledTimes(2);
  });
  it("suppresses concurrent clicks and aborts on account deletion after video", async () => {
    const s = setup();
    let finish!: (value: PlatformResult<void>) => void;
    s.showRewarded.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    const first = s.capability.request(input);
    await expect(s.capability.request(input)).resolves.toMatchObject({status: "unavailable"});
    s.isActive.mockReturnValue(false);
    finish({status: "success", value: undefined});
    await expect(first).resolves.toMatchObject({status: "unavailable"});
    expect(s.claim).not.toHaveBeenCalled();
  });
  it("fails closed on malformed authoritative balance", async () => {
    const s = setup();
    s.claim.mockResolvedValue({newCoins: -100});
    await expect(s.capability.request(input)).resolves.toMatchObject({status: "retryable-failure"});
  });
});
