import {describe, expect, it, jest} from "@jest/globals";
import {AndroidReferralController} from "../androidReferralController";
import type {AndroidReferralBackend, AndroidReferralStatus, AndroidReferralToken} from "../androidReferrals";
/** Retains token for this operation. */
const token = "a".repeat(43);
/** Retains ready for this operation. */
const ready: AndroidReferralStatus = {kind: "ready", canBind: true, bound: false, settled: false, rewardCoins: 100};
/** Retains fixture for this operation. */
function fixture(status: AndroidReferralStatus = ready) {
  /** Retains current for this operation. */
  let current = status;
  /** Retains backend for this operation. */
  const backend = {
    status: jest.fn(async () => current),
    create: jest.fn(async () => ({token, expiresAtMs: 1000, rewardCoins: 100})),
    bind: jest.fn(async (_token: string, _expectedOwnerId?: string) => {current = {kind: "ready", canBind: false, bound: true, settled: false, rewardCoins: 100}; return {alreadyBound: false, expiresAtMs: 1000};}),
  } satisfies AndroidReferralBackend;
  /** Retains share for this operation. */
  const share = jest.fn(async (_url: string) => undefined);
  return {backend, share, controller: new AndroidReferralController(backend, share)};
}
describe("Android referral controller", () => {
  it("requires durable Google identity before share or acceptance", async () => {
    /** Retains f for this operation. */
    const f = fixture({kind: "google-required"}); await f.controller.start();
    await f.controller.invite(); await f.controller.accept(token);
    expect(f.backend.create).not.toHaveBeenCalled(); expect(f.backend.bind).not.toHaveBeenCalled();
  });
  it("loads without binding and accepts only after the player's explicit action", async () => {
    /** Retains f for this operation. */
    const f = fixture(); await f.controller.start(); expect(f.backend.bind).not.toHaveBeenCalled();
    await f.controller.accept(token);
    expect(f.backend.bind).toHaveBeenCalledWith(token, undefined);
    expect(f.controller.getSnapshot().status).toMatchObject({bound: true, settled: false});
  });
  it("shares only a server-issued opaque link and never treats sharing as acquisition", async () => {
    /** Retains f for this operation. */
    const f = fixture(); await f.controller.start(); await f.controller.invite();
    expect(f.share).toHaveBeenCalledWith(`riddlequest://referral?token=${token}`);
    expect(f.backend.bind).not.toHaveBeenCalled(); expect(f.controller.getSnapshot().status).toEqual(ready);
  });
  it("drops a share result after the account/view retires", async () => {
    /** Retains f for this operation. */
    const f = fixture();
    /** Retains release for this operation. */
    let release: (value: AndroidReferralToken) => void = () => {};
    f.backend.create.mockImplementationOnce(() => new Promise(resolve => {release = resolve;}));
    await f.controller.start();
    /** Retains pending for this operation. */
    const pending = f.controller.invite(); f.controller.dispose();
    release({token, expiresAtMs: 1000, rewardCoins: 100}); await pending;
    expect(f.share).not.toHaveBeenCalled();
  });
  it("cannot dispatch work from a retired or synchronously retired view", async () => {
    /** Retains retired for this operation. */
    const retired = fixture(); await retired.controller.start(); retired.controller.dispose();
    await retired.controller.invite(); await retired.controller.accept(token);
    expect(retired.backend.create).not.toHaveBeenCalled(); expect(retired.backend.bind).not.toHaveBeenCalled();
    /** Retains during publish for this operation. */
    const duringPublish = fixture(); await duringPublish.controller.start();
    duringPublish.controller.subscribe(() => {if (duringPublish.controller.getSnapshot().busy) duringPublish.controller.dispose();});
    await duringPublish.controller.accept(token);
    expect(duringPublish.backend.bind).not.toHaveBeenCalled();
  });

  it("keeps server state on a failed bind and permits an explicit retry", async () => {
    /** Retains f for this operation. */
    const f = fixture(); f.backend.bind.mockRejectedValueOnce(new Error("offline"));
    await f.controller.start(); await f.controller.accept(token); expect(f.controller.getSnapshot().failed).toBe(true);
    await f.controller.accept(token); expect(f.controller.getSnapshot()).toMatchObject({failed: false, status: {bound: true}});
  });
});
