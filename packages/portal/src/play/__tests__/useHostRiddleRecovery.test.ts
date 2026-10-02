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
  /** Stable options for the context's mounted lifetime. */
  const options = {userId: "player", profile: {coins: 300}, initialGameMode: "classic" as const, locale: "en",
    services: {loadRiddle}, withActivity: <T>(operation: () => Promise<T>) => operation(),
    postToGame, postOperation, configurationWarning: null, setNotice: jest.fn(), onRecoveryAttempt};
  /** Exposed lifecycle under the same fake browser signals as the recovery owner. */
  const lifecycle = useHostRiddleLifecycle(options);
  cleanup = effects[0]() || undefined;
  return {lifecycle, options, postToGame, postOperation, onRecoveryAttempt};
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
