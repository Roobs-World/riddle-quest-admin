import {afterEach, describe, expect, it, jest} from "@jest/globals";
import {createFacebookPlayerSettingsActions} from "../../engagement/FacebookPlayerSettingsActions";
import {runFacebookSdkDialog} from "../../FacebookSdkDialogGate";
import type {FacebookInstantSdk} from "../../fbinstant";

const botApis = ["player.canSubscribeBotAsync", "player.isSubscribedBotAsync", "player.subscribeBotAsync"];
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => {resolve = accept;});
  return {promise, resolve};
};
const fixture = (enabled = true, apis = botApis) => {
  let subscribed = false, active = true;
  const status = jest.fn<() => Promise<boolean>>(async () => subscribed);
  const eligibility = jest.fn<() => Promise<boolean>>(async () => true);
  const subscribe = jest.fn<() => Promise<void>>(async () => {subscribed = true;});
  const save = jest.fn<FacebookInstantSdk["player"]["setDataAsync"]>();
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined, startGameAsync: async () => undefined,
    setLoadingProgress: () => undefined, onPause: () => undefined, getSupportedAPIs: () => apis,
    player: {getID: () => "bot-fixture", getSignedPlayerInfoAsync: async () => {throw new Error("unused");},
      getDataAsync: async () => ({}), setDataAsync: save, flushDataAsync: async () => undefined,
      canSubscribeBotAsync: eligibility, isSubscribedBotAsync: status, subscribeBotAsync: subscribe},
  };
  const actions = createFacebookPlayerSettingsActions({sdk, isActive: () => active, messengerBotEnabled: enabled,
    flushBeforeQuit: async () => undefined});
  return {sdk, actions, status, eligibility, subscribe, save,
    setSubscribed: (value: boolean) => {subscribed = value;}, retireOwner: () => {active = false;}};
};
afterEach(() => {jest.useRealTimers();});

describe("separate Facebook Messenger bot consent", () => {
  it.each(["disabled", ...botApis])("does not probe or expose unapproved/missing support (%s)", missing => {
    const f = fixture(missing !== "disabled", botApis.filter(api => api !== missing));
    expect(f.actions).toBeUndefined();
    expect(f.status).not.toHaveBeenCalled();
    expect(f.subscribe).not.toHaveBeenCalled();
  });

  it("restores permission status without subscribing and requires a separate explicit action", async () => {
    const f = fixture();
    await f.actions!.refresh();
    expect(f.actions!.getSnapshot().actions).toEqual(["subscribe-messenger-bot"]);
    expect(f.subscribe).not.toHaveBeenCalled();
    await expect(f.actions!.run("subscribe-messenger-bot")).resolves.toBe("success");
    expect(f.eligibility).toHaveBeenCalledTimes(2);
    expect(f.subscribe).toHaveBeenCalledTimes(1);
    expect(f.actions!.getSnapshot().actions).toEqual([]);
    expect(f.save).not.toHaveBeenCalled();
  });

  it("does not offer an already subscribed player another prompt", async () => {
    const f = fixture();
    f.setSubscribed(true);
    await f.actions!.refresh();
    expect(f.actions!.getSnapshot().actions).toEqual([]);
    expect(f.eligibility).not.toHaveBeenCalled();
    expect(f.subscribe).not.toHaveBeenCalled();
  });

  it("honors Meta eligibility changes immediately before prompting", async () => {
    const f = fixture();
    await f.actions!.refresh();
    f.eligibility.mockResolvedValue(false);
    await expect(f.actions!.run("subscribe-messenger-bot")).resolves.toBe("unavailable");
    expect(f.subscribe).not.toHaveBeenCalled();
  });

  it("does not infer permission from a failed status read", async () => {
    const f = fixture();
    f.status.mockRejectedValue(new Error("network failure"));
    await f.actions!.refresh();
    expect(f.actions!.getSnapshot().actions).toEqual([]);
    expect(f.eligibility).not.toHaveBeenCalled();
  });

  it.each(["panel", "account"])("cancels a pending eligibility read when its %s retires", async kind => {
    const f = fixture();
    await f.actions!.refresh();
    const pendingEligibility = deferred<boolean>(), started = deferred<void>();
    f.eligibility.mockImplementation(() => {started.resolve(); return pendingEligibility.promise;});
    const panel = new AbortController();
    const pending = f.actions!.run("subscribe-messenger-bot", panel.signal);
    await started.promise;
    if (kind === "panel") panel.abort(); else {f.retireOwner(); f.actions!.retire();}
    await expect(pending).resolves.toBe("cancelled");
    pendingEligibility.resolve(true);
    expect(f.subscribe).not.toHaveBeenCalled();
  });

  it("reconciles an admitted rejection and suppresses another offer when permission was granted", async () => {
    const f = fixture();
    await f.actions!.refresh();
    f.subscribe.mockImplementation(async () => {f.setSubscribed(true); throw new Error("response lost");});
    await expect(f.actions!.run("subscribe-messenger-bot")).resolves.toBe("error");
    expect(f.status).toHaveBeenCalledTimes(3);
    expect(f.actions!.getSnapshot()).toEqual({actions: [], pendingAction: null});
    await expect(f.actions!.run("subscribe-messenger-bot")).resolves.toBe("unavailable");
    expect(f.subscribe).toHaveBeenCalledTimes(1);
  });

  it("keeps admitted native permission observed after the panel closes", async () => {
    const f = fixture();
    await f.actions!.refresh();
    const native = deferred<void>(), started = deferred<void>();
    f.subscribe.mockImplementation(async () => {started.resolve(); await native.promise; f.setSubscribed(true);});
    const panel = new AbortController();
    const pending = f.actions!.run("subscribe-messenger-bot", panel.signal);
    await started.promise;
    panel.abort();
    await expect(runFacebookSdkDialog(f.sdk, async () => ({status: "success", value: undefined})))
      .resolves.toMatchObject({status: "unavailable"});
    native.resolve();
    await expect(pending).resolves.toBe("cancelled");
    expect(f.status).toHaveBeenCalledTimes(3);
    expect(f.actions!.getSnapshot()).toEqual({actions: [], pendingAction: null});
  });

  it("bounds a hung optional status query", async () => {
    jest.useFakeTimers();
    const f = fixture();
    f.status.mockImplementation(() => new Promise(() => undefined));
    const refresh = f.actions!.refresh();
    await jest.advanceTimersByTimeAsync(8000);
    await refresh;
    expect(f.actions!.getSnapshot().actions).toEqual([]);
    expect(f.subscribe).not.toHaveBeenCalled();
  });
});
