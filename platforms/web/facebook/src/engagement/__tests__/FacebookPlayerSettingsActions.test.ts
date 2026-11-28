import {describe, expect, it, jest} from "@jest/globals";
import {registerFacebookSdkDialogGuard, runFacebookSdkDialog} from "../../FacebookSdkDialogGate";
import type {FacebookInstantSdk} from "../../fbinstant";
import {createFacebookPlayerSettingsActions, type FacebookPlayerSettingsActionsOptions} from "../FacebookPlayerSettingsActions";
import type {FacebookQuitTraceRecorder} from "../FacebookQuitTrace";

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
  const flushBeforeQuit = jest.fn<FacebookPlayerSettingsActionsOptions["flushBeforeQuit"]>(async () => undefined);
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

const quitTracePhases = () => performance.getEntriesByType("mark")
  .filter(entry => entry.name.startsWith("riddle-quest:facebook:quit:"))
  .map(entry => entry.name.slice("riddle-quest:facebook:quit:".length));

const installFrameHost = () => {
  const requestDescriptor = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame");
  const cancelDescriptor = Object.getOwnPropertyDescriptor(globalThis, "cancelAnimationFrame");
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = -1;
  const request = jest.fn<typeof requestAnimationFrame>(callback => {
    const id = ++nextId;
    callbacks.set(id, callback);
    return id;
  });
  const cancel = jest.fn<typeof cancelAnimationFrame>(id => {callbacks.delete(id);});
  Object.defineProperty(globalThis, "requestAnimationFrame", {configurable: true, value: request});
  Object.defineProperty(globalThis, "cancelAnimationFrame", {configurable: true, value: cancel});
  return {
    request, cancel, pending: () => callbacks.size,
    frame: () => {
      const next = callbacks.entries().next().value;
      if (!next) return;
      callbacks.delete(next[0]);
      next[1](0);
    },
    restore: () => {
      if (requestDescriptor) Object.defineProperty(globalThis, "requestAnimationFrame", requestDescriptor);
      else Reflect.deleteProperty(globalThis, "requestAnimationFrame");
      if (cancelDescriptor) Object.defineProperty(globalThis, "cancelAnimationFrame", cancelDescriptor);
      else Reflect.deleteProperty(globalThis, "cancelAnimationFrame");
    },
  };
};

describe("Facebook player Settings actions", () => {
  it("uses delivered frames to recover the Quit deadline while timers stall and keeps the original save ordered on retry", async () => {
    jest.useFakeTimers({doNotFake: ["performance"]});
    const frames = installFrameHost();
    const harness = fixture();
    const original = deferred<void>();
    const originalStarted = deferred<void>();
    const fresh = deferred<void>();
    const freshStarted = deferred<void>();
    harness.flushBeforeQuit.mockImplementationOnce(() => {
      originalStarted.resolve();
      return original.promise;
    }).mockImplementationOnce(() => {
      freshStarted.resolve();
      return fresh.promise;
    });
    const actions = requireActions(harness.options);
    let outcome = "pending";
    const quitting = actions.run("quit").then(result => {outcome = result; return result;});
    let retry: ReturnType<typeof actions.run> | undefined;
    try {
      await originalStarted.promise;
      const expiredCallback = frames.request.mock.calls[0]?.[0];
      jest.setSystemTime(Date.now() + 14_999);
      frames.frame();
      expect(actions.getSnapshot().pendingAction).toBe("quit");
      jest.setSystemTime(Date.now() + 1);
      frames.frame();
      await jest.advanceTimersByTimeAsync(0);
      expect(outcome).toBe("unsaved");
      await expect(quitting).resolves.toBe("unsaved");
      expect(actions.getSnapshot().pendingAction).toBeNull();
      expect(frames.pending()).toBe(0);
      expect(harness.quit).not.toHaveBeenCalled();
      retry = actions.run("quit");
      await jest.advanceTimersByTimeAsync(0);
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(1);
      expect(frames.pending()).toBe(1);
      const scheduled = frames.request.mock.calls.length;
      expiredCallback?.(0);
      expect(frames.request).toHaveBeenCalledTimes(scheduled);
      expect(frames.pending()).toBe(1);
      expect(actions.getSnapshot().pendingAction).toBe("quit");
      original.resolve();
      await freshStarted.promise;
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(2);
      expect(harness.quit).not.toHaveBeenCalled();
      fresh.resolve();
      await expect(retry).resolves.toBe("success");
      expect(harness.quit).toHaveBeenCalledTimes(1);
      expect(frames.pending()).toBe(0);
    } finally {
      original.resolve();
      fresh.resolve();
      await quitting;
      await retry;
      frames.restore();
      jest.useRealTimers();
    }
  });

  it.each(["saved", "save failed", "panel closed", "retired"])("cancels frame handle zero after preparation is %s and ignores retained callbacks", async condition => {
    const frames = installFrameHost();
    const harness = fixture();
    const save = deferred<void>();
    const started = deferred<void>();
    harness.flushBeforeQuit.mockImplementation(async () => {
      started.resolve();
      await save.promise;
      if (condition === "save failed") throw new Error("save unavailable");
    });
    const actions = requireActions(harness.options);
    const panel = new AbortController();
    const quitting = actions.run("quit", panel.signal);
    try {
      await started.promise;
      expect(frames.pending()).toBe(1);
      const retained = frames.request.mock.calls[0]?.[0];
      if (condition === "panel closed") panel.abort();
      else if (condition === "retired") actions.retire();
      else save.resolve();
      await expect(quitting).resolves.toBe(condition === "saved" ? "success" : condition === "save failed" ? "unsaved" : "cancelled");
      expect(frames.cancel).toHaveBeenCalledWith(0);
      expect(frames.pending()).toBe(0);
      expect(actions.getSnapshot().pendingAction).toBeNull();
      const requested = frames.request.mock.calls.length;
      retained?.(0);
      expect(frames.request).toHaveBeenCalledTimes(requested);
      expect(frames.pending()).toBe(0);
      expect(harness.quit).toHaveBeenCalledTimes(condition === "saved" ? 1 : 0);
    } finally {
      save.resolve();
      await quitting;
      frames.restore();
    }
  });

  it("does not start a frame deadline while the native dialog guard owns Quit admission", async () => {
    jest.useFakeTimers({doNotFake: ["performance"]});
    const frames = installFrameHost();
    const harness = fixture();
    const guard = deferred<void>();
    const removeGuard = registerFacebookSdkDialogGuard(harness.sdk, {beforeOpen: () => guard.promise, afterClose: () => undefined});
    const actions = requireActions(harness.options);
    const panel = new AbortController();
    const quitting = actions.run("quit", panel.signal);
    try {
      await jest.advanceTimersByTimeAsync(15_001);
      frames.frame();
      expect(frames.request).not.toHaveBeenCalled();
      expect(actions.getSnapshot().pendingAction).toBe("quit");
      expect(harness.flushBeforeQuit).not.toHaveBeenCalled();
      panel.abort();
      guard.resolve();
      await expect(quitting).resolves.toBe("cancelled");
      expect(frames.request).not.toHaveBeenCalled();
      expect(harness.quit).not.toHaveBeenCalled();
    } finally {
      guard.resolve();
      await quitting;
      removeGuard();
      frames.restore();
      jest.useRealTimers();
    }
  });

  it.each(["request missing", "cancel missing", "request getter throws", "cancel getter throws", "request throws", "later request throws", "cancel throws"])("preserves timer recovery when the optional frame host has %s", async condition => {
    jest.useFakeTimers({doNotFake: ["performance"]});
    const frames = installFrameHost();
    const fail = () => {throw new Error("animation frames unavailable");};
    if (condition.endsWith("missing")) {
      Object.defineProperty(globalThis, condition.startsWith("request") ? "requestAnimationFrame" : "cancelAnimationFrame", {configurable: true, value: undefined});
    } else if (condition.includes("getter")) {
      Object.defineProperty(globalThis, condition.startsWith("request") ? "requestAnimationFrame" : "cancelAnimationFrame", {configurable: true, get: fail});
    } else if (condition === "request throws") frames.request.mockImplementation(fail);
    else if (condition === "cancel throws") frames.cancel.mockImplementation(fail);
    const harness = fixture();
    const save = deferred<void>();
    const started = deferred<void>();
    harness.flushBeforeQuit.mockImplementation(() => {started.resolve(); return save.promise;});
    const actions = requireActions(harness.options);
    const quitting = actions.run("quit");
    try {
      await started.promise;
      if (condition === "later request throws") {
        frames.request.mockImplementation(fail);
        expect(() => frames.frame()).not.toThrow();
      }
      await jest.advanceTimersByTimeAsync(15_000);
      await expect(quitting).resolves.toBe("unsaved");
      expect(actions.getSnapshot().pendingAction).toBeNull();
      expect(harness.quit).not.toHaveBeenCalled();
      const requested = frames.request.mock.calls.length;
      expect(() => frames.frame()).not.toThrow();
      expect(frames.request).toHaveBeenCalledTimes(requested);
      expect(frames.pending()).toBe(0);
    } finally {
      save.resolve();
      await quitting;
      frames.restore();
      jest.useRealTimers();
    }
  });

  it("records a held native guard without claiming Quit preparation has started", async () => {
    const harness = fixture();
    const hidden = deferred<void>();
    const removeGuard = registerFacebookSdkDialogGuard(harness.sdk, {
      beforeOpen: () => hidden.promise, afterClose: () => undefined,
    });
    const actions = requireActions(harness.options);
    const quitting = actions.run("quit");
    try {
      expect(quitTracePhases()).toEqual(["guard"]);
      expect(harness.flushBeforeQuit).not.toHaveBeenCalled();
      expect(harness.quit).not.toHaveBeenCalled();
      hidden.resolve();
      await expect(quitting).resolves.toBe("success");
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "invoke", "returned", "finished"]);
      expect(harness.quit).toHaveBeenCalledTimes(1);
    } finally {
      hidden.resolve();
      await quitting;
      removeGuard();
    }
  });

  it("records projection and presence waits before the actual Quit call", async () => {
    const harness = fixture();
    const projection = deferred<void>();
    const projectionStarted = deferred<void>();
    const presence = deferred<void>();
    const presenceStarted = deferred<void>();
    harness.flushBeforeQuit.mockImplementation(async trace => {
      trace("projection");
      projectionStarted.resolve();
      await projection.promise;
      trace("presence");
      presenceStarted.resolve();
      await presence.promise;
    });
    harness.quit.mockImplementation(() => {
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "projection", "presence", "invoke"]);
    });
    const quitting = requireActions(harness.options).run("quit");
    try {
      await projectionStarted.promise;
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "projection"]);
      expect(harness.quit).not.toHaveBeenCalled();
      projection.resolve();
      await presenceStarted.promise;
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "projection", "presence"]);
      expect(harness.quit).not.toHaveBeenCalled();
      presence.resolve();
      await expect(quitting).resolves.toBe("success");
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "projection", "presence", "invoke", "returned", "finished"]);
      expect(harness.quit).toHaveBeenCalledTimes(1);
    } finally {
      projection.resolve();
      presence.resolve();
      await quitting;
    }
  });

  it("keeps an expired save's later presence work out of the retry trace", async () => {
    const harness = fixture();
    const oldSave = deferred<void>();
    const newSave = deferred<void>();
    harness.flushBeforeQuit.mockImplementationOnce(async trace => {
      trace("projection");
      await oldSave.promise;
      trace("presence");
    }).mockImplementationOnce(async trace => {
      trace("projection");
      await newSave.promise;
    });
    const actions = requireActions(harness.options);
    jest.useFakeTimers({doNotFake: ["performance"]});
    const first = actions.run("quit");
    let retry: ReturnType<typeof actions.run> | undefined;
    try {
      await jest.advanceTimersByTimeAsync(15_000);
      await expect(first).resolves.toBe("unsaved");
      retry = actions.run("quit");
      await jest.advanceTimersByTimeAsync(0);
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "previous-preparation"]);
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(1);
      oldSave.resolve();
      await jest.advanceTimersByTimeAsync(0);
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(2);
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "previous-preparation", "projection"]);
      expect(harness.quit).not.toHaveBeenCalled();
      newSave.resolve();
      await expect(retry).resolves.toBe("success");
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "previous-preparation", "projection", "invoke", "returned", "finished"]);
      expect(harness.quit).toHaveBeenCalledTimes(1);
    } finally {
      oldSave.resolve();
      newSave.resolve();
      await first;
      await retry;
      jest.useRealTimers();
    }
  });

  it("records actual late presence while timeout delivery is suspended without allowing a late Quit", async () => {
    const harness = fixture();
    const projection = deferred<void>();
    const projectionStarted = deferred<void>();
    const presence = deferred<void>();
    const presenceStarted = deferred<void>();
    harness.flushBeforeQuit.mockImplementation(async trace => {
      trace("projection");
      projectionStarted.resolve();
      await projection.promise;
      trace("presence");
      presenceStarted.resolve();
      await presence.promise;
    });
    const actions = requireActions(harness.options);
    jest.useFakeTimers({doNotFake: ["performance"]});
    const quitting = actions.run("quit");
    try {
      await projectionStarted.promise;
      jest.setSystemTime(Date.now() + 15_001);
      projection.resolve();
      await presenceStarted.promise;
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "projection", "presence"]);
      expect(actions.getSnapshot().pendingAction).toBe("quit");
      expect(harness.quit).not.toHaveBeenCalled();
      presence.resolve();
      await expect(quitting).resolves.toBe("unsaved");
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "projection", "presence", "finished"]);
      expect(actions.getSnapshot().pendingAction).toBeNull();
      expect(harness.quit).not.toHaveBeenCalled();
    } finally {
      projection.resolve();
      presence.resolve();
      await quitting;
      jest.useRealTimers();
    }
  });

  it("freezes retired preparation before its late save and finally can affect a new owner's trace", async () => {
    const old = fixture();
    const saved = deferred<void>();
    const saving = deferred<void>();
    let oldRecord: FacebookQuitTraceRecorder | undefined;
    old.flushBeforeQuit.mockImplementation(async trace => {
      oldRecord = trace;
      trace("projection");
      saving.resolve();
      await saved.promise;
      trace("presence");
    });
    const oldActions = requireActions(old.options);
    const previous = oldActions.run("quit");
    try {
      await saving.promise;
      oldActions.retire();
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "projection", "retired"]);
      oldRecord?.("presence");
      expect(quitTracePhases()).not.toContain("presence");
      const current = fixture();
      await expect(requireActions(current.options).run("quit")).resolves.toBe("success");
      expect(quitTracePhases()).toEqual(["guard", "operation", "preparation", "invoke", "returned", "finished"]);
      const newest = performance.getEntriesByType("mark").filter(entry => entry.name.startsWith("riddle-quest:facebook:quit:"));
      saved.resolve();
      await expect(previous).resolves.toBe("cancelled");
      oldRecord?.("presence");
      oldActions.retire();
      expect(performance.getEntriesByType("mark").filter(entry => entry.name.startsWith("riddle-quest:facebook:quit:"))).toEqual(newest);
      expect(old.quit).not.toHaveBeenCalled();
      expect(current.quit).toHaveBeenCalledTimes(1);
    } finally {
      oldActions.retire();
      saved.resolve();
      await previous;
    }
  });

  it.each(["unavailable", "cleanup throws", "mark throws"])("keeps save order and Quit outcome unchanged when Performance is %s", async failure => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "performance");
    const timeline = failure === "unavailable" ? undefined : {
      clearMarks: () => {if (failure === "cleanup throws") throw new Error("unavailable");},
      mark: () => {throw new Error("unavailable");},
    };
    Object.defineProperty(globalThis, "performance", {configurable: true, value: timeline});
    try {
      const order: string[] = [];
      const harness = fixture();
      harness.flushBeforeQuit.mockImplementation(async trace => {
        trace("projection");
        order.push("projection");
        await Promise.resolve();
        trace("presence");
        order.push("presence");
      });
      harness.quit.mockImplementation(() => {order.push("quit");});
      const actions = requireActions(harness.options);
      await expect(actions.run("quit")).resolves.toBe("success");
      expect(order).toEqual(["projection", "presence", "quit"]);
      expect(actions.getSnapshot().pendingAction).toBeNull();
      expect(harness.reportFailure).not.toHaveBeenCalled();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "performance", descriptor);
      else Reflect.deleteProperty(globalThis, "performance");
    }
  });

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

  it("restores Settings after 15 seconds of unsettled Quit preparation without quitting on late completion", async () => {
    const harness = fixture();
    const saving = deferred<void>();
    const saved = deferred<void>();
    harness.flushBeforeQuit.mockImplementationOnce(() => {saving.resolve(); return saved.promise;});
    const actions = requireActions(harness.options);
    let outcome = "pending";
    jest.useFakeTimers();
    const quitting = actions.run("quit").then(result => {outcome = result; return result;});
    try {
      await saving.promise;
      await jest.advanceTimersByTimeAsync(14_999);
      expect(outcome).toBe("pending");
      expect(actions.getSnapshot().pendingAction).toBe("quit");
      await jest.advanceTimersByTimeAsync(1);
      expect({outcome, pendingAction: actions.getSnapshot().pendingAction}).toEqual({outcome: "unsaved", pendingAction: null});
      expect(actions.getSnapshot().actions).toContainEqual({id: "quit", labelKey: "Settings.QUIT_GAME_BUTTON"});
      await expect(runFacebookSdkDialog(harness.sdk, async () => ({status: "success", value: undefined})))
        .resolves.toEqual({status: "success", value: undefined});
      saved.resolve();
      await jest.advanceTimersByTimeAsync(0);
      expect(harness.quit).not.toHaveBeenCalled();
    } finally {
      saved.resolve();
      await quitting;
      jest.useRealTimers();
    }
  });

  it("joins outstanding preparation on retry, then saves newer progress before quitting", async () => {
    const harness = fixture();
    const oldSave = deferred<void>();
    const newerSave = deferred<void>();
    const saving = deferred<void>();
    harness.flushBeforeQuit.mockImplementationOnce(() => {saving.resolve(); return oldSave.promise;})
      .mockImplementationOnce(() => newerSave.promise);
    const actions = requireActions(harness.options);
    let firstOutcome = "pending";
    jest.useFakeTimers();
    const first = actions.run("quit").then(result => {firstOutcome = result; return result;});
    let retry: ReturnType<typeof actions.run> | undefined;
    try {
      await saving.promise;
      await jest.advanceTimersByTimeAsync(15_000);
      expect(firstOutcome).toBe("unsaved");
      retry = actions.run("quit");
      await jest.advanceTimersByTimeAsync(0);
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(1);
      oldSave.resolve();
      await jest.advanceTimersByTimeAsync(0);
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(2);
      expect(harness.quit).not.toHaveBeenCalled();
      newerSave.resolve();
      await expect(retry).resolves.toBe("success");
      expect(harness.quit).toHaveBeenCalledTimes(1);
    } finally {
      oldSave.resolve();
      newerSave.resolve();
      await first;
      await retry;
      jest.useRealTimers();
    }
  });

  it("does not enqueue a fresh save for an expired retry and allows a later fresh Quit attempt", async () => {
    const harness = fixture();
    const saved = deferred<void>();
    const saving = deferred<void>();
    harness.flushBeforeQuit.mockImplementationOnce(() => {saving.resolve(); return saved.promise;});
    const actions = requireActions(harness.options);
    let firstOutcome = "pending";
    let retryOutcome = "pending";
    jest.useFakeTimers();
    const first = actions.run("quit").then(result => {firstOutcome = result; return result;});
    let retry: ReturnType<typeof actions.run> | undefined;
    try {
      await saving.promise;
      await jest.advanceTimersByTimeAsync(15_000);
      expect(firstOutcome).toBe("unsaved");
      retry = actions.run("quit").then(result => {retryOutcome = result; return result;});
      await jest.advanceTimersByTimeAsync(15_000);
      expect(retryOutcome).toBe("unsaved");
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(1);
      saved.resolve();
      await jest.advanceTimersByTimeAsync(0);
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(1);
      expect(harness.quit).not.toHaveBeenCalled();
      await expect(actions.run("quit")).resolves.toBe("success");
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(2);
      expect(harness.quit).toHaveBeenCalledTimes(1);
    } finally {
      saved.resolve();
      await first;
      await retry;
      jest.useRealTimers();
    }
  });

  it.each(["panel-closed", "retired"])("releases unsettled Quit admission when %s without cancelling the save", async condition => {
    const harness = fixture();
    const saving = deferred<void>();
    const saved = deferred<void>();
    harness.flushBeforeQuit.mockImplementationOnce(() => {saving.resolve(); return saved.promise;});
    const actions = requireActions(harness.options);
    const panel = new AbortController();
    let outcome = "pending";
    jest.useFakeTimers();
    const quitting = actions.run("quit", panel.signal).then(result => {outcome = result; return result;});
    try {
      await saving.promise;
      if (condition === "panel-closed") panel.abort();
      else actions.retire();
      await jest.advanceTimersByTimeAsync(0);
      expect({outcome, pendingAction: actions.getSnapshot().pendingAction}).toEqual({outcome: "cancelled", pendingAction: null});
      await expect(runFacebookSdkDialog(harness.sdk, async () => ({status: "success", value: undefined})))
        .resolves.toEqual({status: "success", value: undefined});
      saved.resolve();
      await jest.advanceTimersByTimeAsync(0);
      expect(harness.quit).not.toHaveBeenCalled();
      expect(harness.reportFailure).not.toHaveBeenCalled();
    } finally {
      saved.resolve();
      await quitting;
      jest.useRealTimers();
    }
  });

  it("rejects a late saved result even when the timeout callback has not run", async () => {
    const harness = fixture();
    const saving = deferred<void>();
    const saved = deferred<void>();
    harness.flushBeforeQuit.mockImplementationOnce(() => {saving.resolve(); return saved.promise;});
    const actions = requireActions(harness.options);
    jest.useFakeTimers();
    const quitting = actions.run("quit");
    try {
      await saving.promise;
      jest.setSystemTime(Date.now() + 15_000);
      saved.resolve();
      await expect(quitting).resolves.toBe("unsaved");
      expect(harness.quit).not.toHaveBeenCalled();
      expect(actions.getSnapshot().pendingAction).toBeNull();
    } finally {
      saved.resolve();
      await quitting;
      jest.useRealTimers();
    }
  });

  it("does not time out or bypass a pending native-dialog guard while preparing to Quit", async () => {
    const harness = fixture();
    const cleanup = deferred<void>();
    const stop = registerFacebookSdkDialogGuard(harness.sdk, {beforeOpen: () => cleanup.promise, afterClose: () => undefined});
    const actions = requireActions(harness.options);
    const panel = new AbortController();
    let outcome = "pending";
    jest.useFakeTimers();
    const quitting = actions.run("quit", panel.signal).then(result => {outcome = result; return result;});
    try {
      await jest.advanceTimersByTimeAsync(30_000);
      expect(outcome).toBe("pending");
      expect(harness.flushBeforeQuit).not.toHaveBeenCalled();
      expect(harness.quit).not.toHaveBeenCalled();
      panel.abort();
      cleanup.resolve();
      await expect(quitting).resolves.toBe("cancelled");
    } finally {
      panel.abort();
      cleanup.resolve();
      await quitting;
      stop();
      jest.useRealTimers();
    }
  });

  it.each(["retired", "account-replaced"])("clears pending Quit without restoring actions after becoming %s while saving", async condition => {
    const harness = fixture();
    const actions = requireActions(harness.options);
    const saving = deferred<void>();
    const saved = deferred<void>();
    const eligible = deferred<boolean>();
    harness.canCreateShortcutAsync.mockReturnValueOnce(eligible.promise);
    const refreshing = actions.refresh();
    const published: ReturnType<typeof actions.getSnapshot>[] = [];
    const unsubscribe = actions.subscribe(() => published.push(actions.getSnapshot()));
    harness.flushBeforeQuit.mockImplementationOnce(() => {saving.resolve(); return saved.promise;});
    const quitting = actions.run("quit");
    try {
      await saving.promise;
      expect(actions.getSnapshot().pendingAction).toBe("quit");
      expect(harness.quit).not.toHaveBeenCalled();
      if (condition === "retired") actions.retire();
      else harness.setActive(false);
      saved.resolve();
      await expect(quitting).resolves.toBe("cancelled");
      expect(actions.getSnapshot()).toEqual({actions: [], pendingAction: null});
      expect(published.at(-1)).toEqual({actions: [], pendingAction: null});

      const clearedSnapshot = actions.getSnapshot();
      const notificationsAfterCancellation = published.length;
      harness.setActive(true);
      eligible.resolve(true);
      await refreshing;
      await actions.refresh();
      await expect(actions.run("quit")).resolves.toBe("unavailable");
      expect(actions.getSnapshot()).toBe(clearedSnapshot);
      expect(published).toHaveLength(notificationsAfterCancellation);
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(1);
      expect(harness.quit).not.toHaveBeenCalled();
      expect(harness.createShortcutAsync).not.toHaveBeenCalled();
      expect(harness.reportFailure).not.toHaveBeenCalled();
    } finally {
      saved.resolve();
      eligible.resolve(true);
      await quitting;
      await refreshing;
      unsubscribe();
    }
  });

  it.each(["panel-closed", "deadline"])("clears inactive-owner Quit on %s while retaining the unfinished save", async condition => {
    const harness = fixture();
    const actions = requireActions(harness.options);
    const saving = deferred<void>();
    const saved = deferred<void>();
    let saveSettled = false;
    void saved.promise.then(() => {saveSettled = true;});
    harness.flushBeforeQuit.mockImplementationOnce(() => {saving.resolve(); return saved.promise;});
    const published: ReturnType<typeof actions.getSnapshot>[] = [];
    const unsubscribe = actions.subscribe(() => published.push(actions.getSnapshot()));
    const panel = new AbortController();
    jest.useFakeTimers();
    const quitting = actions.run("quit", panel.signal);
    try {
      await saving.promise;
      harness.setActive(false);
      if (condition === "panel-closed") panel.abort();
      else await jest.advanceTimersByTimeAsync(15_000);
      await expect(quitting).resolves.toBe("cancelled");
      expect(saveSettled).toBe(false);
      expect(actions.getSnapshot()).toEqual({actions: [], pendingAction: null});
      expect(published.at(-1)).toEqual({actions: [], pendingAction: null});

      harness.setActive(true);
      await expect(actions.run("quit")).resolves.toBe("unavailable");
      saved.resolve();
      await jest.advanceTimersByTimeAsync(0);
      expect(saveSettled).toBe(true);
      expect(actions.getSnapshot()).toEqual({actions: [], pendingAction: null});
      expect(harness.flushBeforeQuit).toHaveBeenCalledTimes(1);
      expect(harness.quit).not.toHaveBeenCalled();
      expect(harness.reportFailure).not.toHaveBeenCalled();
    } finally {
      panel.abort();
      saved.resolve();
      await quitting;
      unsubscribe();
      jest.useRealTimers();
    }
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
