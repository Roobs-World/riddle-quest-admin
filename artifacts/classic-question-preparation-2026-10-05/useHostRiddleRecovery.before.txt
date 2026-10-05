import {afterEach, beforeEach, expect, it, jest} from "@jest/globals";
import type {BridgeRiddle} from "@qwordly/core/bridge";
import type {HostServices} from "../types";

/** Effects are committed after each simulated render, preserving hook ref ownership. */
const effects: Array<() => void | (() => void)> = [];
/** Stable ref cells retained across profile updates. */
const refs: Array<{
  /** Mutable hook value. */
  current: unknown;
}> = [];
/** Current render's ref position. */
let refIndex = 0;
/** Active lifecycle cleanup from the committed effect. */
let cleanup: (() => void) | undefined;
jest.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
  useRef: (initial: unknown) => {
    /** Every render advances in hook order, including previously initialized refs. */
    const index = refIndex++;
    return refs[index] ?? (refs[index] = {current: initial});
  },
  useState: <T>(initial: T) => [initial, jest.fn()],
}));
jest.mock("../../analytics/events", () => ({trackEvent: jest.fn()}));
jest.mock("../../observability/browserErrorReporter", () => ({captureBrowserException: jest.fn()}));
jest.mock("../preloadGameModals", () => ({preloadGameModals: async () => undefined}));
import {useHostRiddleLifecycle} from "../useHostRiddleLifecycle";
import {RIDDLE_LOAD_DEADLINE_MS} from "../riddleLoadDeadline";

/** Canonical issued question for the injected authority. */
const riddle: BridgeRiddle = {riddleId: "classic_2", text: "A tall animal", answerLength: 7,
  sessionToken: "00000000-0000-4000-8000-000000000002", gameMode: "classic", index: 2};
/** Promise whose resolution remains controlled across cleanup and profile changes. */
const deferred = <T>() => {
  /** Resolves the currently held authority operation. */
  let resolve!: (value: T) => void;
  /** Async authority operation retained by the test. */
  const promise = new Promise<T>(done => {resolve = done;});
  return {promise, resolve};
};
/** Creates one lifecycle around stable injected delivery callbacks. */
const setup = (loadRiddle: HostServices["loadRiddle"]) => {
  /** Records accepted riddle messages after authority work settles. */
  const postToGame = jest.fn();
  /** Records correlated operation acknowledgements. */
  const postOperation = jest.fn();
  /** Resynchronizes the frame only before actual recovery work. */
  const onRecoveryAttempt = jest.fn();
  /** Actual startup overlay accounting must return to zero when a bounded wait settles. */
  let activity = 0;
  /** Stable options for the context's mounted lifetime. */
  const options = {userId: "player", profile: {coins: 300}, initialGameMode: "classic" as const, locale: "en",
    services: {loadRiddle}, withActivity: async <T>(operation: () => Promise<T>) => {
      activity += 1;
      try {return await operation();} finally {activity -= 1;}
    },
    postToGame, postOperation, configurationWarning: null, setNotice: jest.fn(), onRecoveryAttempt};
  /** Exposed lifecycle under the same fake browser signals as the recovery owner. */
  const lifecycle = useHostRiddleLifecycle(options);
  cleanup = effects[0]() || undefined;
  return {lifecycle, options, postToGame, postOperation, onRecoveryAttempt,
    /** Number of recovery operations still owning the host activity boundary. */
    get activity() {return activity;}};
};

beforeEach(() => {
  refs.length = 0; effects.length = 0; refIndex = 0;
  jest.useFakeTimers();
  Object.defineProperty(globalThis, "window", {configurable: true, value: Object.assign(new EventTarget(), {
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
  })});
  Object.defineProperty(globalThis, "document", {configurable: true,
    value: Object.assign(new EventTarget(), {visibilityState: "visible"})});
  Object.defineProperty(globalThis, "navigator", {configurable: true, value: {onLine: true}});
});
afterEach(() => {cleanup?.(); cleanup = undefined; jest.useRealTimers();});

it("releases a hanging content wait and accepts only its recovery response", async () => {
  /** First request never settles before its delivery deadline. */
  const held = deferred<BridgeRiddle>();
  /** Retry returns new authority-owned content while the expired request remains pending. */
  const replacement = {...riddle, riddleId: "recovered-riddle"};
  /** Real recovery loop switches from hung transport to responsive transport. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(held.promise).mockResolvedValue(replacement);
  /** Mounted context owns both the expired wait and its automatic recovery. */
  const owner = setup(load);
  await jest.advanceTimersByTimeAsync(250 + RIDDLE_LOAD_DEADLINE_MS);
  expect(owner.activity).toBe(0);
  expect(owner.postOperation).toHaveBeenCalledWith(undefined, "loadRiddle", false, undefined, expect.any(String));
  await jest.advanceTimersByTimeAsync(1000);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.postToGame.mock.calls[0][0].payload.riddle.riddleId).toBe("recovered-riddle");
  held.resolve(riddle);
  await jest.advanceTimersByTimeAsync(0);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
});

it("settles an unresolved content wait immediately when its host retires", async () => {
  /** Underlying provider remains pending permanently. */
  const held = deferred<BridgeRiddle>();
  /** Host can release its wait without waiting for that transport to finish. */
  const owner = setup(() => held.promise);
  /** Correlated load remains pending until the context is retired. */
  const loading = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"}, "hung-unmount");
  /** Observe settlement without allowing the test to hang on the old implementation. */
  const settled = jest.fn();
  void loading.then(settled);
  cleanup?.(); cleanup = undefined;
  await jest.advanceTimersByTimeAsync(0);
  expect(settled).toHaveBeenCalledWith(false);
  expect(owner.postOperation).not.toHaveBeenCalled();
  expect(owner.postToGame).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it("bounds a hanging Classic fallback after authoritative Daily completion", async () => {
  /** Confirmed Daily completion may route into a Classic transport that never responds. */
  const held = deferred<BridgeRiddle>();
  /** Third request represents bounded recovery of the fallback rather than a Daily retry. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockRejectedValueOnce(
    Object.assign(new Error("Daily complete"), {code: "daily-completed"}),
  ).mockReturnValueOnce(held.promise).mockResolvedValue(riddle);
  /** Real mounted host accounts for the initial and fallback loading boundaries. */
  const owner = setup(load);
  /** Correlation must survive the expired fallback so the game can recover Next. */
  const loading = owner.lifecycle.loadRiddle({gameMode: "challenge", locale: "en"}, "daily-next");
  await jest.advanceTimersByTimeAsync(RIDDLE_LOAD_DEADLINE_MS);
  expect(await loading).toBe(false);
  expect(owner.activity).toBe(0);
  expect(owner.postOperation).toHaveBeenCalledWith("daily-next", "loadRiddle", false, undefined, expect.any(String));
  await jest.advanceTimersByTimeAsync(1000);
  expect(load.mock.calls.map(([input]) => input.gameMode)).toEqual(["challenge", "classic", "classic"]);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  held.resolve({...riddle, riddleId: "expired-fallback"});
  await jest.advanceTimersByTimeAsync(0);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
});

it("rejects a successful authority receipt after final unmount", async () => {
  /** The request finishes only after its game host has been retired. */
  const held = deferred<BridgeRiddle>();
  /** Mounted lifecycle starts a correlated load before retirement. */
  const owner = setup(() => held.promise);
  /** Async receipt retained while the context is disposed. */
  const loading = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"}, "held-load");
  cleanup?.(); cleanup = undefined;
  held.resolve(riddle);
  expect(await loading).toBe(false);
  expect(owner.postToGame).not.toHaveBeenCalled();
  expect(owner.postOperation).not.toHaveBeenCalled();
});

it("delivers the latest confirmed profile after a slow riddle load", async () => {
  /** Slow content response overlaps an authoritative profile refresh. */
  const held = deferred<BridgeRiddle>();
  /** Stable hook lifetime owns the pending load. */
  const owner = setup(() => held.promise);
  /** Original content request started at a 300-coin balance. */
  const loading = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"}, "held-load");
  refIndex = 0;
  useHostRiddleLifecycle({...owner.options, profile: {coins: 350}});
  held.resolve(riddle);
  expect(await loading).toBe(true);
  expect(owner.postToGame).toHaveBeenCalledWith(expect.objectContaining({
    payload: {riddle, profile: {coins: 350}},
  }));
});

it("retries on reconnection without waiting for outage backoff, and deduplicates signals", async () => {
  /** First recovery fails; subsequent recovery stays pending across repeated online events. */
  const held = deferred<BridgeRiddle>();
  /** Authority operation changes from outage to an eventually successful load. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockRejectedValueOnce(new Error("Unavailable"))
    .mockImplementation(() => held.promise);
  /** Real timer policy is driven through the injected browser events. */
  const owner = setup(load);
  await jest.advanceTimersByTimeAsync(250);
  expect(load).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event("online"));
  await jest.advanceTimersByTimeAsync(0);
  expect(load).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new Event("online"));
  await jest.advanceTimersByTimeAsync(0);
  expect(load).toHaveBeenCalledTimes(2);
  held.resolve(riddle);
  await jest.advanceTimersByTimeAsync(0);
  window.dispatchEvent(new Event("online"));
  await jest.advanceTimersByTimeAsync(0);
  expect(load).toHaveBeenCalledTimes(2);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
});

it("avoids offline requests and resumes only when returning to a connected game", async () => {
  /** The browser is offline before the initial recovery timer fires. */
  Object.defineProperty(navigator, "onLine", {configurable: true, value: false});
  /** Authority should not be contacted while the browser reports no connection. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockResolvedValue(riddle);
  /** Lifecycle retains event listeners while its startup timer is paused offline. */
  const owner = setup(load);
  await jest.advanceTimersByTimeAsync(30_000);
  expect(load).not.toHaveBeenCalled();
  expect(owner.onRecoveryAttempt).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "onLine", {configurable: true, value: true});
  Object.defineProperty(document, "visibilityState", {configurable: true, value: "hidden"});
  document.dispatchEvent(new Event("visibilitychange"));
  await jest.advanceTimersByTimeAsync(0);
  expect(load).not.toHaveBeenCalled();
  Object.defineProperty(document, "visibilityState", {configurable: true, value: "visible"});
  document.dispatchEvent(new Event("visibilitychange"));
  await jest.advanceTimersByTimeAsync(0);
  expect(load).toHaveBeenCalledTimes(1);
});

it("resets Classic recovery to the replacement account's confirmed position", async () => {
  /** First account explicitly requested a later progression position. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockResolvedValue(riddle);
  /** Mounted content lifecycle owns the first account's navigation pointer. */
  const owner = setup(load);
  await owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 17}, "old-next");
  cleanup?.();refIndex = 0;effects.length = 0;
  useHostRiddleLifecycle({...owner.options, userId: "replacement", profile: {coins: 100, classicIndex: 2}});
  cleanup = effects[0]() || undefined;
  await jest.advanceTimersByTimeAsync(250);
  expect(load).toHaveBeenLastCalledWith({gameMode: "classic", locale: "en", classicIndex: 2});
});
