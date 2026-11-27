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
    expect(actions.getSnapshot().actions).toContain("follow-community");
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
    expect(actions.getSnapshot().actions).toEqual(["follow-community"]);
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
    expect(actions.getSnapshot().actions).toEqual(["quit"]);
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
    expect(first.getSnapshot().actions).not.toContain("create-shortcut");
    first.retire();

    const replacement = requireActions(harness.options);
    await replacement.refresh();
    expect(replacement.getSnapshot().actions).not.toContain("create-shortcut");
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
    expect(actions.getSnapshot().actions).toContain("create-shortcut");
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
