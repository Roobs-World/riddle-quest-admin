import {describe, expect, it, jest} from "@jest/globals";
import {registerFacebookSdkDialogGuard, runFacebookSdkDialog} from "../../FacebookSdkDialogGate";
import type {FacebookInstantSdk} from "../../fbinstant";
import {createFacebookPlayerSettingsActions, type FacebookPlayerSettingsActionsOptions} from "../FacebookPlayerSettingsActions";

const SUPPORTED_APIS = ["canCreateShortcutAsync", "createShortcutAsync", "community.canFollowOfficialPageAsync",
  "community.followOfficialPageAsync", "community.canJoinOfficialGroupAsync", "community.joinOfficialGroupAsync", "quit"];

const deferred = <Value,>() => {
  let accept: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>(resolve => {accept = resolve;});
  return {promise, resolve: (value: Value) => {
    if (!accept) throw new Error("Deferred promise was not initialized");
    accept(value);
  }};
};

const fixture = (supported = SUPPORTED_APIS) => {
  const canCreateShortcutAsync = jest.fn<() => Promise<boolean>>(async () => true);
  const createShortcutAsync = jest.fn<() => Promise<void>>(async () => undefined);
  const canFollowOfficialPageAsync = jest.fn<() => Promise<boolean>>(async () => true);
  const followOfficialPageAsync = jest.fn<() => Promise<void>>(async () => undefined);
  const canJoinOfficialGroupAsync = jest.fn<() => Promise<boolean>>(async () => true);
  const joinOfficialGroupAsync = jest.fn<() => Promise<void>>(async () => undefined);
  const quit = jest.fn<() => void>();
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined,
    setLoadingProgress: () => undefined,
    startGameAsync: async () => undefined,
    getSupportedAPIs: () => supported,
    onPause: () => undefined,
    player: {
      getID: () => "settings-player",
      getSignedPlayerInfoAsync: async () => {throw new Error("Not used by Settings");},
      getDataAsync: async () => ({}),
      setDataAsync: async () => undefined,
      flushDataAsync: async () => undefined,
    },
    canCreateShortcutAsync, createShortcutAsync, quit,
    community: {canFollowOfficialPageAsync, followOfficialPageAsync, canJoinOfficialGroupAsync, joinOfficialGroupAsync},
  };
  let active = true;
  const flushBeforeQuit = jest.fn<() => Promise<void>>(async () => undefined);
  const reportFailure = jest.fn<NonNullable<FacebookPlayerSettingsActionsOptions["reportFailure"]>>();
  const options = {sdk, isActive: () => active, flushBeforeQuit, reportFailure};
  return {sdk, options, canCreateShortcutAsync, createShortcutAsync, canFollowOfficialPageAsync,
    followOfficialPageAsync, canJoinOfficialGroupAsync, joinOfficialGroupAsync, quit, flushBeforeQuit, reportFailure,
    setActive: (value: boolean) => {active = value;}};
};

const requireActions = (options: FacebookPlayerSettingsActionsOptions) => {
  const actions = createFacebookPlayerSettingsActions(options);
  if (!actions) throw new Error("Expected supported Settings actions");
  return actions;
};

describe("Facebook player Settings actions", () => {
  it.each(["unknown-action", "__proto__", "constructor"])("rejects unrecognized action ID %s without invoking the SDK", async id => {
    const setup = fixture();
    const actions = requireActions(setup.options);
    await actions.refresh();
    const snapshot = actions.getSnapshot();
    await expect(actions.run(id)).resolves.toBe("unavailable");
    expect(actions.getSnapshot()).toBe(snapshot);
    expect(setup.createShortcutAsync).not.toHaveBeenCalled();
    expect(setup.followOfficialPageAsync).not.toHaveBeenCalled();
    expect(setup.joinOfficialGroupAsync).not.toHaveBeenCalled();
    expect(setup.flushBeforeQuit).not.toHaveBeenCalled();
    expect(setup.quit).not.toHaveBeenCalled();
  });

  it("cancels a closed Settings panel before a delayed native prompt and keeps the action retryable", async () => {
    const setup = fixture();
    const actions = requireActions(setup.options);
    await actions.refresh();
    const cleanup = deferred<void>();
    const stop = registerFacebookSdkDialogGuard(setup.sdk, {beforeOpen: () => cleanup.promise, afterClose: () => undefined});
    const panel = new AbortController();
    const pending = actions.run("follow-community", panel.signal);
    panel.abort();
    cleanup.resolve();
    await expect(pending).resolves.toBe("cancelled");
    expect(setup.followOfficialPageAsync).not.toHaveBeenCalled();
    expect(actions.getSnapshot().actions).toContainEqual({id: "follow-community", labelKey: "Settings.FOLLOW_COMMUNITY_BUTTON"});
    stop();
    await expect(actions.run("follow-community")).resolves.toBe("success");
    expect(setup.followOfficialPageAsync).toHaveBeenCalledTimes(1);
  });

  it("does not prompt if Settings closes while Meta checks eligibility", async () => {
    const setup = fixture();
    const actions = requireActions(setup.options);
    await actions.refresh();
    const eligibility = deferred<boolean>();
    let checking!: () => void;
    const started = new Promise<void>(resolve => {checking = resolve;});
    setup.canFollowOfficialPageAsync.mockImplementation(() => {checking(); return eligibility.promise;});
    const panel = new AbortController();
    const pending = actions.run("follow-community", panel.signal);
    await started;
    panel.abort();
    eligibility.resolve(true);
    await expect(pending).resolves.toBe("cancelled");
    expect(setup.followOfficialPageAsync).not.toHaveBeenCalled();
  });

  it("releases native action admission when Settings closes during an unsettled eligibility check", async () => {
    const setup = fixture();
    const actions = requireActions(setup.options);
    await actions.refresh();
    const eligibility = deferred<boolean>();
    const started = deferred<void>();
    setup.canFollowOfficialPageAsync.mockImplementationOnce(() => {started.resolve(); return eligibility.promise;});
    const panel = new AbortController();
    let outcome = "pending";
    jest.useFakeTimers();
    const pending = actions.run("follow-community", panel.signal).then(result => {outcome = result; return result;});
    try {
      await started.promise;
      panel.abort();
      await jest.advanceTimersByTimeAsync(0);
      const next = await runFacebookSdkDialog(setup.sdk, async () => {
        await setup.joinOfficialGroupAsync();
        return {status: "success", value: undefined};
      });
      expect({outcome, pendingAction: actions.getSnapshot().pendingAction,
        nextStatus: next.status, nextNativeOpened: setup.joinOfficialGroupAsync.mock.calls.length > 0}).toEqual({
        outcome: "cancelled", pendingAction: null, nextStatus: "success", nextNativeOpened: true,
      });
    } finally {
      eligibility.resolve(true);
      await pending;
      jest.useRealTimers();
    }
    expect(setup.followOfficialPageAsync).not.toHaveBeenCalled();
    expect(actions.getSnapshot().actions).toContainEqual({id: "follow-community", labelKey: "Settings.FOLLOW_COMMUNITY_BUTTON"});
  });

  it("bounds a stalled eligibility check and allows a fresh retry without a late prompt", async () => {
    const setup = fixture();
    const actions = requireActions(setup.options);
    await actions.refresh();
    const eligibility = deferred<boolean>();
    const started = deferred<void>();
    setup.canFollowOfficialPageAsync.mockImplementationOnce(() => {started.resolve(); return eligibility.promise;});
    let outcome = "pending";
    jest.useFakeTimers();
    const pending = actions.run("follow-community").then(result => {outcome = result; return result;});
    try {
      await started.promise;
      await jest.advanceTimersByTimeAsync(7_999);
      expect(outcome).toBe("pending");
      await jest.advanceTimersByTimeAsync(1);
      expect({outcome, pendingAction: actions.getSnapshot().pendingAction}).toEqual({outcome: "unavailable", pendingAction: null});
      await expect(runFacebookSdkDialog(setup.sdk, async () => ({status: "success", value: undefined}))).resolves.toEqual({status: "success", value: undefined});
      eligibility.resolve(true);
      await pending;
      expect(setup.followOfficialPageAsync).not.toHaveBeenCalled();
      await actions.refresh();
      await expect(actions.run("follow-community")).resolves.toBe("success");
      expect(setup.followOfficialPageAsync).toHaveBeenCalledTimes(1);
    } finally {
      eligibility.resolve(true);
      await pending;
      jest.useRealTimers();
    }
  });

  it("retires unsettled shortcut preparation without consuming the replacement account's prompt", async () => {
    const setup = fixture();
    const actions = requireActions(setup.options);
    await actions.refresh();
    const eligibility = deferred<boolean>();
    const started = deferred<void>();
    setup.canCreateShortcutAsync.mockImplementationOnce(() => {started.resolve(); return eligibility.promise;});
    let outcome = "pending";
    jest.useFakeTimers();
    const pending = actions.run("create-shortcut").then(result => {outcome = result; return result;});
    try {
      await started.promise;
      actions.retire();
      await jest.advanceTimersByTimeAsync(0);
      expect(outcome).toBe("cancelled");
      expect(actions.getSnapshot()).toEqual({actions: [], pendingAction: null});
      const replacement = requireActions(setup.options);
      await replacement.refresh();
      await expect(replacement.run("create-shortcut")).resolves.toBe("success");
      eligibility.resolve(true);
      await pending;
      expect(setup.createShortcutAsync).toHaveBeenCalledTimes(1);
    } finally {
      eligibility.resolve(true);
      await pending;
      jest.useRealTimers();
    }
  });

  it("ignores a late eligibility rejection after cancellation and keeps the action retryable", async () => {
    const setup = fixture();
    const actions = requireActions(setup.options);
    await actions.refresh();
    const eligibility = deferred<void>();
    const started = deferred<void>();
    setup.canFollowOfficialPageAsync.mockImplementationOnce(() => {
      started.resolve();
      return eligibility.promise.then(() => {throw new Error("Late provider eligibility failure");});
    });
    const panel = new AbortController();
    let outcome = "pending";
    jest.useFakeTimers();
    const pending = actions.run("follow-community", panel.signal).then(result => {outcome = result; return result;});
    try {
      await started.promise;
      panel.abort();
      await jest.advanceTimersByTimeAsync(0);
      expect(outcome).toBe("cancelled");
      eligibility.resolve();
      await jest.advanceTimersByTimeAsync(0);
      expect(setup.followOfficialPageAsync).not.toHaveBeenCalled();
      expect(setup.reportFailure).not.toHaveBeenCalled();
      await expect(actions.run("follow-community")).resolves.toBe("success");
      expect(setup.followOfficialPageAsync).toHaveBeenCalledTimes(1);
    } finally {
      eligibility.resolve();
      await pending;
      jest.useRealTimers();
    }
  });

  it.each(["panel closes", "account retires"])("keeps an admitted native prompt exclusive when %s beyond the eligibility deadline", async reason => {
    const setup = fixture();
    const actions = requireActions(setup.options);
    await actions.refresh();
    const opened = deferred<void>();
    const dismissed = deferred<void>();
    setup.followOfficialPageAsync.mockImplementationOnce(() => {opened.resolve(); return dismissed.promise;});
    const panel = new AbortController();
    let outcome = "pending";
    jest.useFakeTimers();
    const pending = actions.run("follow-community", panel.signal).then(result => {outcome = result; return result;});
    try {
      await opened.promise;
      if (reason === "panel closes") panel.abort();
      else actions.retire();
      await jest.advanceTimersByTimeAsync(60_000);
      expect(outcome).toBe("pending");
      const blocked = await runFacebookSdkDialog(setup.sdk, async () => {
        await setup.joinOfficialGroupAsync();
        return {status: "success", value: undefined};
      });
      expect(blocked.status).toBe("unavailable");
      expect(setup.joinOfficialGroupAsync).not.toHaveBeenCalled();
      dismissed.resolve();
      await expect(pending).resolves.toBe("cancelled");
      await expect(runFacebookSdkDialog(setup.sdk, async () => ({status: "success", value: undefined}))).resolves.toEqual({status: "success", value: undefined});
    } finally {
      dismissed.resolve();
      await pending;
      jest.useRealTimers();
    }
  });

  it("bounds initial eligibility probes without losing healthy actions or later recovery", async () => {
    const setup = fixture();
    const eligibility = deferred<boolean>();
    setup.canFollowOfficialPageAsync.mockReturnValueOnce(eligibility.promise);
    const actions = requireActions(setup.options);
    let refreshed = false;
    jest.useFakeTimers();
    const pending = actions.refresh().then(() => {refreshed = true;});
    try {
      await jest.advanceTimersByTimeAsync(8_000);
      expect(refreshed).toBe(true);
      expect(actions.getSnapshot().actions.map(action => action.id)).toEqual(["create-shortcut", "join-community", "quit"]);
      eligibility.resolve(true);
      await pending;
      expect(actions.getSnapshot().actions.map(action => action.id)).toEqual(["create-shortcut", "join-community", "quit"]);
      await actions.refresh();
      expect(actions.getSnapshot().actions.map(action => action.id)).toEqual(["create-shortcut", "follow-community", "join-community", "quit"]);
      expect(setup.followOfficialPageAsync).not.toHaveBeenCalled();
    } finally {
      eligibility.resolve(true);
      await pending;
      jest.useRealTimers();
    }
  });

  it("rejects late eligibility even when a throttled timer has not run", async () => {
    const setup = fixture();
    const actions = requireActions(setup.options);
    await actions.refresh();
    const eligibility = deferred<boolean>();
    const started = deferred<void>();
    setup.canFollowOfficialPageAsync.mockImplementationOnce(() => {started.resolve(); return eligibility.promise;});
    jest.useFakeTimers();
    const pending = actions.run("follow-community");
    try {
      await started.promise;
      jest.setSystemTime(Date.now() + 8_001);
      eligibility.resolve(true);
      await expect(pending).resolves.toBe("unavailable");
      expect(setup.followOfficialPageAsync).not.toHaveBeenCalled();
      expect(actions.getSnapshot().pendingAction).toBeNull();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      eligibility.resolve(true);
      await pending;
      jest.useRealTimers();
    }
  });

  it("waits for native surface cleanup before releasing a cancelled action's dialog ownership", async () => {
    const setup = fixture();
    const actions = requireActions(setup.options);
    await actions.refresh();
    const hiding = deferred<void>();
    const hidden = deferred<void>();
    const stop = registerFacebookSdkDialogGuard(setup.sdk, {
      beforeOpen: () => {hiding.resolve(); return hidden.promise;}, afterClose: () => undefined,
    });
    const panel = new AbortController();
    let outcome = "pending";
    jest.useFakeTimers();
    const pending = actions.run("follow-community", panel.signal).then(result => {outcome = result; return result;});
    try {
      await hiding.promise;
      panel.abort();
      await jest.advanceTimersByTimeAsync(60_000);
      expect(outcome).toBe("pending");
      expect(setup.canFollowOfficialPageAsync).toHaveBeenCalledTimes(1);
      const blocked = await runFacebookSdkDialog(setup.sdk, async () => ({status: "success", value: undefined}));
      expect(blocked.status).toBe("unavailable");
      hidden.resolve();
      await expect(pending).resolves.toBe("cancelled");
      expect(setup.followOfficialPageAsync).not.toHaveBeenCalled();
    } finally {
      hidden.resolve();
      await pending;
      stop();
      jest.useRealTimers();
    }
    await expect(runFacebookSdkDialog(setup.sdk, async () => ({status: "success", value: undefined}))).resolves.toEqual({status: "success", value: undefined});
  });

  it("requires independently advertised and callable APIs before probing or displaying actions", async () => {
    const unsupported = fixture([]);
    expect(createFacebookPlayerSettingsActions(unsupported.options)).toBeUndefined();
    expect(unsupported.canCreateShortcutAsync).not.toHaveBeenCalled();

    const missing = fixture(["canCreateShortcutAsync", "createShortcutAsync"]);
    delete missing.sdk.createShortcutAsync;
    expect(createFacebookPlayerSettingsActions(missing.options)).toBeUndefined();

    const malformed = fixture(["quit"]);
    Object.defineProperty(malformed.sdk, "quit", {value: 42});
    expect(createFacebookPlayerSettingsActions(malformed.options)).toBeUndefined();

    const partial = fixture(["community.canFollowOfficialPageAsync", "community.followOfficialPageAsync"]);
    const actions = requireActions(partial.options);
    expect(actions.getSnapshot().actions).toEqual([]);
    await actions.refresh();
    expect(actions.getSnapshot().actions).toEqual([{id: "follow-community", labelKey: "Settings.FOLLOW_COMMUNITY_BUTTON"}]);
    expect(partial.canCreateShortcutAsync).not.toHaveBeenCalled();
    expect(partial.canJoinOfficialGroupAsync).not.toHaveBeenCalled();
    expect(partial.followOfficialPageAsync).not.toHaveBeenCalled();
  });

  it("hides false or failed eligibility without opening any native prompt", async () => {
    const harness = fixture();
    harness.canCreateShortcutAsync.mockResolvedValue(false);
    harness.canFollowOfficialPageAsync.mockResolvedValue(false);
    harness.canJoinOfficialGroupAsync.mockRejectedValue({code: "GROUP_NOT_LINKED"});
    const actions = requireActions(harness.options);
    await actions.refresh();
    expect(actions.getSnapshot().actions).toEqual([{id: "quit", labelKey: "Settings.QUIT_GAME_BUTTON"}]);
    await expect(actions.run("create-shortcut")).resolves.toBe("unavailable");
    expect(harness.createShortcutAsync).not.toHaveBeenCalled();
    expect(harness.followOfficialPageAsync).not.toHaveBeenCalled();
    expect(harness.joinOfficialGroupAsync).not.toHaveBeenCalled();
    expect(harness.reportFailure).not.toHaveBeenCalled();
  });

  it.each(["USER_INPUT", "USER_CANCELLED"])("never repeats a shortcut prompt after %s, including capability replacement", async code => {
    const harness = fixture();
    harness.createShortcutAsync.mockRejectedValueOnce({code});
    const first = requireActions(harness.options);
    await first.refresh();
    await expect(first.run("create-shortcut")).resolves.toBe("cancelled");
    expect(first.getSnapshot().actions).not.toContainEqual(expect.objectContaining({id: "create-shortcut"}));
    first.retire();

    const replacement = requireActions(harness.options);
    await replacement.refresh();
    expect(replacement.getSnapshot().actions).not.toContainEqual(expect.objectContaining({id: "create-shortcut"}));
    await expect(replacement.run("create-shortcut")).resolves.toBe("unavailable");
    expect(harness.createShortcutAsync).toHaveBeenCalledTimes(1);
    expect(harness.reportFailure).not.toHaveBeenCalled();
  });

  it("keeps the shortcut attempt available when another SDK dialog owns the native surface", async () => {
    const harness = fixture();
    const actions = requireActions(harness.options);
    await actions.refresh();
    const closeDialog = deferred<void>();
    const occupied = runFacebookSdkDialog(harness.sdk, async () => {
      await closeDialog.promise;
      return {status: "success", value: undefined};
    });
    await expect(actions.run("create-shortcut")).resolves.toBe("unavailable");
    expect(harness.createShortcutAsync).not.toHaveBeenCalled();
    expect(actions.getSnapshot().actions).toContainEqual({id: "create-shortcut", labelKey: "Settings.ADD_SHORTCUT_BUTTON"});
    closeDialog.resolve();
    await occupied;
    await expect(actions.run("create-shortcut")).resolves.toBe("success");
    expect(harness.createShortcutAsync).toHaveBeenCalledTimes(1);
  });

  it("rejects concurrent actions while awaiting the player's native dialog choice", async () => {
    const harness = fixture();
    const actions = requireActions(harness.options);
    await actions.refresh();
    const opened = deferred<void>();
    const dismissed = deferred<void>();
    harness.followOfficialPageAsync.mockImplementationOnce(() => {opened.resolve(); return dismissed.promise;});
    const following = actions.run("follow-community");
    await opened.promise;
    expect(actions.getSnapshot().pendingAction).toBe("follow-community");
    await expect(actions.run("quit")).resolves.toBe("unavailable");
    expect(harness.flushBeforeQuit).not.toHaveBeenCalled();
    expect(harness.quit).not.toHaveBeenCalled();
    dismissed.resolve();
    await expect(following).resolves.toBe("success");
    expect(actions.getSnapshot().pendingAction).toBeNull();
  });

  it("leaves the game open on save failure even when diagnostic reporting throws", async () => {
    const harness = fixture();
    harness.flushBeforeQuit.mockRejectedValueOnce(new Error("Save unavailable"));
    harness.reportFailure.mockImplementation(() => {throw new Error("Diagnostics unavailable");});
    const actions = requireActions(harness.options);
    await expect(actions.run("quit")).resolves.toBe("unsaved");
    expect(harness.quit).not.toHaveBeenCalled();
    expect(actions.getSnapshot().pendingAction).toBeNull();
    await expect(actions.run("quit")).resolves.toBe("success");
    expect(harness.quit).toHaveBeenCalledTimes(1);
  });

  it.each(["retired", "account-replaced"])("does not quit after becoming %s while saving", async condition => {
    const harness = fixture();
    const actions = requireActions(harness.options);
    const saving = deferred<void>();
    const saved = deferred<void>();
    harness.flushBeforeQuit.mockImplementationOnce(() => {saving.resolve(); return saved.promise;});
    const quitting = actions.run("quit");
    await saving.promise;
    expect(harness.quit).not.toHaveBeenCalled();
    if (condition === "retired") actions.retire();
    else harness.setActive(false);
    saved.resolve();
    await expect(quitting).resolves.toBe("cancelled");
    expect(harness.quit).not.toHaveBeenCalled();
  });

  it("does not open or consume the shortcut after retirement during its final eligibility probe", async () => {
    const harness = fixture();
    const actions = requireActions(harness.options);
    await actions.refresh();
    const probing = deferred<void>();
    const eligible = deferred<boolean>();
    harness.canCreateShortcutAsync.mockImplementationOnce(() => {probing.resolve(); return eligible.promise;});
    const creating = actions.run("create-shortcut");
    await probing.promise;
    actions.retire();
    eligible.resolve(true);
    await expect(creating).resolves.toBe("cancelled");
    expect(harness.createShortcutAsync).not.toHaveBeenCalled();
    expect(actions.getSnapshot()).toEqual({actions: [], pendingAction: null});

    const replacement = requireActions(harness.options);
    await replacement.refresh();
    await expect(replacement.run("create-shortcut")).resolves.toBe("success");
  });

  it("does not republish eligibility after the owning Settings session retires", async () => {
    const harness = fixture();
    const eligible = deferred<boolean>();
    harness.canCreateShortcutAsync.mockReturnValueOnce(eligible.promise);
    const actions = requireActions(harness.options);
    const changed = jest.fn();
    actions.subscribe(changed);
    const refresh = actions.refresh();
    actions.retire();
    const notificationsAtRetirement = changed.mock.calls.length;
    eligible.resolve(true);
    await refresh;
    expect(actions.getSnapshot()).toEqual({actions: [], pendingAction: null});
    expect(changed).toHaveBeenCalledTimes(notificationsAtRetirement);
    expect(harness.createShortcutAsync).not.toHaveBeenCalled();
  });

  it("normalizes native failures and releases the gate when the logger also fails", async () => {
    const harness = fixture();
    harness.followOfficialPageAsync.mockRejectedValueOnce(new Error("Native error"));
    harness.reportFailure.mockImplementation(() => {throw new Error("Logger error");});
    const actions = requireActions(harness.options);
    await actions.refresh();
    await expect(actions.run("follow-community")).resolves.toBe("error");
    expect(actions.getSnapshot().pendingAction).toBeNull();
    await expect(actions.run("follow-community")).resolves.toBe("success");
    expect(harness.followOfficialPageAsync).toHaveBeenCalledTimes(2);
  });
});
