import {MockJestPlatform} from "../MockJestPlatform";
import {startJestSession} from "../startup";

it("runs identity, Firebase auth and recovery in startup order", async () => {
  const order: string[] = [];
  const platform = new MockJestPlatform();
  platform.init = async () => { order.push("init"); return {status: "success", value: undefined}; };
  platform.getPlayerSigned = async () => { order.push("signed"); return {player: platform.player, playerSigned: "signed"}; };
  platform.getProfile = async () => { order.push("profile"); return null; };
  const backend = {exchangeIdentity: async () => { order.push("exchange"); return {customToken: "firebase", uid: "uid"}; }};
  const purchases = {reconcile: async () => { order.push("recover"); return {status: "success", value: 0}; }};
  const result = await startJestSession(platform, backend as never, purchases as never, async () => { order.push("firebase"); });
  expect(result).toMatchObject({status: "success", value: {firebaseAuthenticated: true}});
  expect(order).toEqual(["init", "signed", "exchange", "firebase", "recover", "profile"]);
  expect(platform.progress).toEqual([5, 15, 28, 42, 58, 72]);
});

it("returns retryable failure without claiming readiness", async () => {
  const platform = new MockJestPlatform();
  const result = await startJestSession(platform, {exchangeIdentity: async () => { throw new Error("offline"); }} as never, {} as never, async () => {});
  expect(result).toEqual({status: "retryable-failure", message: "offline"});
  expect(platform.loaded).toBe(false);
});

it("initializes the SDK before reporting manual loading progress", async () => {
  const platform = new MockJestPlatform();
  let initialized = false;
  platform.init = async () => {
    initialized = true;
    return {status: "success", value: undefined};
  };
  platform.setLoadingProgress = (progress) => {
    if (!initialized) throw new Error("SDK not initialized. Call JestSDK.init() first.");
    platform.progress.push(progress);
  };
  const backend = {exchangeIdentity: async () => ({customToken: "firebase", uid: "uid"})};
  const purchases = {reconcile: async () => ({status: "success", value: 0})};

  const result = await startJestSession(platform, backend as never, purchases as never, async () => {});

  expect(result.status).toBe("success");
  expect(platform.progress[0]).toBe(5);
});
