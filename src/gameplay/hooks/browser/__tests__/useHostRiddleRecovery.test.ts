import {afterEach, beforeEach, expect, it, jest} from "@jest/globals";
import type {BridgeRiddle, HostToGameMessage} from "../../../../platform/bridge/messages";
import type {HostServices} from "../../../../platform/contracts/hostServices";

/** Effects are committed after each simulated render, preserving hook ref ownership. */
const effects: Array<() => void | (() => void)> = [];
/** Stable ref cells retained across profile updates. */
const refs: Array<{
  /** Mutable hook value. */
  current: unknown;
}> = [];
/** Memo cells retain ownership across unchanged dependency renders. */
const memos: Array<{
  /** React compares each dependency by identity. */
  deps: unknown[];
  /** Stable computed value for the admitted render. */
  value: unknown;
}> = [];
/** Committed layout lifetimes retire before passive effects. */
const layouts: Array<{
  /** Dependencies that admitted this layout. */
  deps: unknown[];
  /** Disposal owned by this layout only. */
  cleanup?: () => void;
}> = [];
/** Current render's independent hook positions. */
let refIndex = 0, memoIndex = 0, layoutIndex = 0;
/** Begins a new render without discarding committed hook cells. */
const beginRender = () => {refIndex = memoIndex = layoutIndex = 0;};
/** Retires committed layouts and the current passive recovery owner. */
const retire = () => {layouts.forEach(layout => layout.cleanup?.()); cleanup?.(); cleanup = undefined;};
/** Active lifecycle cleanup from the committed effect. */
let cleanup: (() => void) | undefined;
jest.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useMemo: (factory: () => unknown, deps: unknown[]) => {
    /** Unchanged ownership reuses the same memo object, as in mounted React. */
    const index = memoIndex++, prior = memos[index];
    if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) memos[index] = {deps, value: factory()};
    return memos[index]!.value;
  },
  useLayoutEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    /** Layout retirement happens at commit, before the retained passive cleanup. */
    const index = layoutIndex++, prior = layouts[index];
    if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) {
      prior?.cleanup?.(); layouts[index] = {deps, cleanup: effect() || undefined};
    }
  },
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
  useRef: (initial: unknown) => {
    /** Every render advances in hook order, including previously initialized refs. */
    const index = refIndex++;
    return refs[index] ?? (refs[index] = {current: initial});
  },
  useState: <T>(initial: T) => [initial, jest.fn()],
}));
jest.mock("../../../../observability/analytics/events", () => ({trackEvent: jest.fn()}));
jest.mock("../../../../observability/browserErrorReporter", () => ({captureBrowserException: jest.fn()}));
jest.mock("../../../../app/modals/preloadGameModals", () => ({preloadGameModals: async () => undefined}));
import {useHostRiddleLifecycle} from "../useHostRiddleLifecycle";
import {RIDDLE_LOAD_DEADLINE_MS} from "../../../browser/questions/riddleLoadDeadline";

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
const setup = (loadRiddle: HostServices["loadRiddle"], extra: {
  /** Host has retired the game frame after a failed bridge validation. */
  recoverySuspended?: boolean;
  /** Optional target-owned Classic and Daily preparation. */
  preloadInitialRiddles?: HostServices["preloadInitialRiddles"];
} = {}) => {
  /** Records accepted riddle messages after authority work settles. */
  const postToGame = jest.fn<(message: HostToGameMessage) => void>();
  /** Records correlated operation acknowledgements. */
  const postOperation = jest.fn();
  /** Resynchronizes the frame only before actual recovery work. */
  const onRecoveryAttempt = jest.fn();
  /** Actual startup overlay accounting must return to zero when a bounded wait settles. */
  let activity = 0;
  /** Stable options for the context's mounted lifetime. */
  const options = {userId: "player", profile: {coins: 300}, initialGameMode: "classic" as const, locale: "en",
    services: {loadRiddle, preloadInitialRiddles: extra.preloadInitialRiddles}, withActivity: async <T>(operation: () => Promise<T>) => {
      activity += 1;
      try {return await operation();} finally {activity -= 1;}
    },
    postToGame, postOperation, configurationWarning: null, setNotice: jest.fn(), onRecoveryAttempt, ...extra};
  /** Exposed lifecycle under the same fake browser signals as the recovery owner. */
  const lifecycle = useHostRiddleLifecycle(options);
  cleanup = effects[0]() || undefined;
  return {lifecycle, options, postToGame, postOperation, onRecoveryAttempt,
    /** Number of recovery operations still owning the host activity boundary. */
    get activity() {return activity;}};
};

beforeEach(() => {
  refs.length = effects.length = memos.length = layouts.length = 0; beginRender();
  jest.useFakeTimers();
  Object.defineProperty(globalThis, "window", {configurable: true, value: Object.assign(new EventTarget(), {
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
  })});
  Object.defineProperty(globalThis, "document", {configurable: true,
    value: Object.assign(new EventTarget(), {visibilityState: "visible"})});
  Object.defineProperty(globalThis, "navigator", {configurable: true, value: {onLine: true}});
});
afterEach(() => {retire(); jest.useRealTimers();});

it("starts no authority read while a retired game frame suspends recovery", async () => {
  /** Any read here would be an unrequested authority request behind the recovery screen. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockResolvedValue(riddle);
  /** Host whose bridge validation failed before the first recovery timer fired. */
  const owner = setup(load, {recoverySuspended: true});
  await jest.advanceTimersByTimeAsync(30_000);
  window.dispatchEvent(new Event("online"));
  document.dispatchEvent(new Event("visibilitychange"));
  await jest.advanceTimersByTimeAsync(30_000);
  expect(load).not.toHaveBeenCalled();
  expect(owner.onRecoveryAttempt).not.toHaveBeenCalled();
});

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
  expect(load.mock.calls[0][1]?.aborted).toBe(true);
  expect(owner.postOperation).toHaveBeenCalledWith(undefined, "loadRiddle", false, undefined, expect.any(String));
  await jest.advanceTimersByTimeAsync(1000);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.postToGame.mock.calls[0][0].payload.riddle.riddleId).toBe("recovered-riddle");
  held.resolve(riddle);
  await jest.advanceTimersByTimeAsync(0);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
});


it("observes late provider rejection after a content deadline without changing recovered content", async () => {
  /** Original provider remains admitted beyond the bounded delivery wait. */
  let reject!: (error: Error) => void;
  /** Its late rejection is still observed after local controls have recovered. */
  const held = new Promise<BridgeRiddle>((_resolve, fail) => {reject = fail;});
  /** Recovery admits its own read while the original provider is still pending. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(held).mockResolvedValue(riddle);
  /** Actual host lifecycle retains responsibility for both promise outcomes. */
  const owner = setup(load);
  await jest.advanceTimersByTimeAsync(250 + RIDDLE_LOAD_DEADLINE_MS);
  expect(load.mock.calls[0][1]?.aborted).toBe(true);
  await jest.advanceTimersByTimeAsync(1000);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.postOperation).toHaveBeenCalledTimes(2);
  reject(new Error("Expired provider failed late"));
  await jest.advanceTimersByTimeAsync(1000);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.postOperation).toHaveBeenCalledTimes(2);
  expect(owner.onRecoveryAttempt).toHaveBeenCalledTimes(2);
  expect(owner.options.setNotice).toHaveBeenLastCalledWith(null);
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
  retire();
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
  expect(load.mock.calls[1][1]?.aborted).toBe(true);
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
  retire();
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
  beginRender();
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
  retire(); beginRender();effects.length = 0;
  useHostRiddleLifecycle({...owner.options, userId: "replacement", profile: {coins: 100, classicIndex: 2}});
  cleanup = effects[0]() || undefined;
  await jest.advanceTimersByTimeAsync(250);
  expect(load).toHaveBeenLastCalledWith({gameMode: "classic", locale: "en", classicIndex: 2}, expect.any(AbortSignal));
});

it("keeps the newer question's draft when an older correlated load resolves last", async () => {
  /** Real bridge validation and the actual game reducer reproduce the board replacement seam. */
  const {createGameMessageRouter} = await import("../../../../platform/bridge/browser/bridgeRouter");
  /** Typed letters belong to the question actually delivered through the bridge. */
  const {createInitialGameSession, gameSessionReducer} = await import("../../../session/gameSession");
  /** Earlier network read completes only after a newer read becomes playable. */
  const held = deferred<BridgeRiddle>();
  /** Newer question has its own authority-issued session identity. */
  const newer = {...riddle, attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false, index: 3, sessionToken: "00000000-0000-4000-8000-000000000003"};
  /** Independent correlated calls reach the adapter concurrently. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(held.promise).mockResolvedValue(newer);
  /** Mounted lifecycle owns both content requests. */
  const owner = setup(load);
  /** Exact board state delivered through the production bridge router. */
  let board = createInitialGameSession();
  /** Every parsed delivery can be awaited before simulating native game actions. */
  const deliveries: Promise<unknown>[] = [];
  /** Production validation applies the same load action as the game message hook. */
  const router = createGameMessageRouter({init: jest.fn(), authState: jest.fn(), operationResult: jest.fn(),
    pause: jest.fn(), resume: jest.fn(), riddleLoaded: message => {
      board = gameSessionReducer(board, {type: "loadRiddle", riddle: message.payload.riddle});
    }});
  owner.options.postToGame.mockImplementation(message => {
    if (message.type === "host:riddleLoaded") deliveries.push(router({...message, payload: {riddle: message.payload.riddle}}));
  });
  /** The first correlated request remains in flight when the second is admitted. */
  const olderLoad = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 2}, "older-load");
  expect(await owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 3}, "newer-load")).toBe(true);
  await Promise.all(deliveries);
  board = gameSessionReducer(board, {type: "typeLetter", letter: "C"});
  expect(board.currentLetters[0]).toBe("C");
  held.resolve({...riddle, attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false});
  /** Superseded delivery returns a retired outcome without rebuilding the board. */
  const olderAccepted = await olderLoad;
  await Promise.all(deliveries);
  expect(board.riddle?.sessionToken).toBe(newer.sessionToken);
  expect(board.currentLetters[0]).toBe("C");
  expect(olderAccepted).toBe(false);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.postOperation).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(2);
});

it("releases obsolete startup activity before its provider settles and ignores its late failure", async () => {
  /** Old transport remains admitted but must relinquish its loading overlay immediately. */
  let reject!: (reason: Error) => void;
  /** Independent transport result deliberately outlives the delivery wait. */
  const older = new Promise<BridgeRiddle>((_resolve, fail) => {reject = fail;});
  /** Current transport remains held until the test explicitly makes it playable. */
  const newer = deferred<BridgeRiddle>();
  /** Latest request must keep its own activity after the old request retires. */
  const owner = setup(jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(older).mockReturnValueOnce(newer.promise));
  /** Supersession should finish this delivery before the transport rejects. */
  const oldLoad = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"}, "older-load");
  /** New load independently owns the remaining startup activity. */
  const newLoad = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"}, "newer-load");
  expect(await oldLoad).toBe(false);
  expect(owner.activity).toBe(1);
  newer.resolve(riddle);
  expect(await newLoad).toBe(true);
  expect(owner.activity).toBe(0);
  reject(new Error("Obsolete transport failed"));
  await jest.advanceTimersByTimeAsync(1000);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.postOperation).toHaveBeenCalledTimes(1);
  expect(owner.options.setNotice).toHaveBeenLastCalledWith(null);
  expect(owner.onRecoveryAttempt).not.toHaveBeenCalled();
});

it("keeps the newest failure retryable instead of reviving an older success", async () => {
  /** Obsolete authority read can still resolve after the latest request fails. */
  const old = deferred<BridgeRiddle>();
  /** Only failure of the newest delivery should schedule recovery. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(old.promise)
    .mockRejectedValueOnce(new Error("Latest question unavailable")).mockResolvedValue(riddle);
  /** Mounted lifecycle schedules recovery for the current failure. */
  const owner = setup(load);
  /** Earlier request retires as soon as the newer request is admitted. */
  const oldLoad = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 2}, "older-load");
  expect(await owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 3}, "newer-load")).toBe(false);
  old.resolve(riddle); expect(await oldLoad).toBe(false);
  expect(owner.postToGame).not.toHaveBeenCalled();
  expect(owner.postOperation).toHaveBeenCalledTimes(1);
  expect(owner.postOperation.mock.calls[0]).toEqual(["newer-load", "loadRiddle", false, undefined, expect.stringContaining("Latest question unavailable")]);
  await jest.advanceTimersByTimeAsync(250);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(load.mock.calls[2][0].classicIndex).toBe(3);
  expect(owner.onRecoveryAttempt).toHaveBeenCalledTimes(1);
});

it.each(["before-daily-result", "during-classic-fallback"])("retires an obsolete Daily transition %s", async phase => {
  /** Daily and its fallback both have controllable result boundaries. */
  let completeDaily!: (reason: Error) => void;
  /** Daily completion is expected routing, but only for the latest request. */
  const daily = new Promise<BridgeRiddle>((_resolve, reject) => {completeDaily = reject;});
  /** Classic fallback may already have reached the provider when superseded. */
  const fallback = deferred<BridgeRiddle>();
  /** Daily completion error carries the same authoritative routing code as production. */
  const completed = Object.assign(new Error("Daily completed"), {code: "daily-completed"});
  /** Latest explicit Classic request succeeds independently of the old Daily routing work. */
  const load = jest.fn<HostServices["loadRiddle"]>(input => input.gameMode === "challenge" ? daily
    : input.classicIndex === 9 ? Promise.resolve({...riddle, index: 9}) : fallback.promise);
  /** Mounted host owns the complete Daily-to-Classic asynchronous chain. */
  const owner = setup(load);
  /** Original Daily request remains pending at the selected transition boundary. */
  const oldLoad = owner.lifecycle.loadRiddle({gameMode: "challenge", locale: "en"}, "daily-old");
  if (phase === "during-classic-fallback") {
    completeDaily(completed); await jest.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(2);
  }
  expect(await owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 9}, "classic-current")).toBe(true);
  completeDaily(completed); fallback.resolve(riddle);
  expect(await oldLoad).toBe(false);
  await jest.advanceTimersByTimeAsync(1000);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.postToGame.mock.calls[0][0]).toMatchObject({requestId: "classic-current", payload: {riddle: {index: 9}}});
  expect(load).toHaveBeenCalledTimes(phase === "during-classic-fallback" ? 3 : 2);
  expect(owner.postOperation).toHaveBeenCalledTimes(1);
  expect(owner.activity).toBe(0);
});

it("shares one automatic read without letting its cleanup retire a newer correlated read", async () => {
  /** Automatic startup requests coalesce around one provider operation. */
  const automatic = deferred<BridgeRiddle>();
  /** Correlated successor retains ownership when the shared old promise settles. */
  const correlated = deferred<BridgeRiddle>();
  /** Only two physical reads should be admitted for three caller requests. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(automatic.promise).mockReturnValueOnce(correlated.promise);
  /** Mounted host preserves automatic deduplication while serializing delivery ownership. */
  const owner = setup(load);
  /** First automatic read is shared by the second automatic caller. */
  const first = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"});
  /** Additional ready/recovery signals cannot supersede their own shared load. */
  const shared = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"});
  expect(load).toHaveBeenCalledTimes(1);
  /** Correlated request genuinely supersedes the earlier automatic load. */
  const current = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"}, "current");
  expect(await first).toBe(false); expect(await shared).toBe(false);
  expect(owner.activity).toBe(1);
  automatic.resolve(riddle);
  correlated.resolve({...riddle, index: 3});
  expect(await current).toBe(true);
  expect(load).toHaveBeenCalledTimes(2);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.postToGame.mock.calls[0][0]).toMatchObject({requestId: "current", payload: {riddle: {index: 3}}});
});

it("counts one shared startup failure once after repeated reconnect signals", async () => {
  /** One provider request stays pending while multiple browser recovery events arrive. */
  let reject!: (reason: Error) => void;
  /** Actual content delivery shares this operation among automatic callers. */
  const held = new Promise<BridgeRiddle>((_resolve, fail) => {reject = fail;});
  /** The first retry becomes playable without another provider failure. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(held).mockResolvedValue(riddle);
  /** Mounted recovery owns the pending request, browser listeners and outage backoff. */
  const owner = setup(load);
  await jest.advanceTimersByTimeAsync(250);
  for (let index = 0; index < 20; index += 1) {
    window.dispatchEvent(new Event("online"));
    await jest.advanceTimersByTimeAsync(10);
  }
  expect(load).toHaveBeenCalledTimes(1);
  reject(new Error("Shared startup content failed"));
  await jest.advanceTimersByTimeAsync(1000);
  expect(load).toHaveBeenCalledTimes(2);
  expect(owner.onRecoveryAttempt).toHaveBeenCalledTimes(2);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.activity).toBe(0);
});

it.each(["account", "generation", "locale", "provider"])("keeps the replacement load when old passive cleanup follows a %s commit", async kind => {
  /** Old provider work deliberately outlives the owning commit. */
  const held = deferred<BridgeRiddle>();
  /** Replacement receipt has its own immutable question identity. */
  const replacement = {...riddle, index: 6, sessionToken: "00000000-0000-4000-8000-000000000006"};
  /** Both contexts use real deadline and delivery behavior around held authority work. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(held.promise).mockResolvedValue(replacement);
  /** Initial committed content lifetime captures the retained callback. */
  const owner = setup(load);
  /** Old correlated request is admitted before context replacement. */
  const old = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"}, "old-context");
  /** Passive cleanup is intentionally retained until the replacement has loaded. */
  const oldPassiveCleanup = cleanup;
  beginRender(); effects.length = 0;
  /** Each changed value independently replaces ordinary content ownership. */
  const options = {...owner.options, userId: kind === "account" ? "replacement" : "player",
    accountGeneration: kind === "generation" ? 2 : undefined, locale: kind === "locale" ? "fr" : "en",
    services: kind === "provider" ? {loadRiddle: load} : owner.options.services};
  /** Synchronous layout commit retires the old delivery before passive cleanup. */
  const current = useHostRiddleLifecycle(options);
  expect(await old).toBe(false);
  expect(await current.loadRiddle({gameMode: "classic", locale: options.locale}, "new-context")).toBe(true);
  oldPassiveCleanup?.(); cleanup = effects[0]() || undefined;
  held.resolve(riddle);
  expect(await owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"}, "retained-old-callback")).toBe(false);
  await jest.advanceTimersByTimeAsync(1000);
  expect(load).toHaveBeenCalledTimes(2);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.postToGame.mock.calls[0][0]).toMatchObject({requestId: "new-context", payload: {riddle: replacement}});
  expect(owner.postOperation).toHaveBeenCalledTimes(1);
  expect(owner.activity).toBe(0);
});

it("keeps an admitted load across recovery callback replacement", async () => {
  /** A presentation callback can change without changing account or provider ownership. */
  const held = deferred<BridgeRiddle>();
  /** Initial content wait remains admitted until its provider responds. */
  const owner = setup(() => held.promise);
  /** Original visible request must survive the callback-only commit. */
  const loading = owner.lifecycle.loadRiddle({gameMode: "classic", locale: "en"}, "same-context");
  beginRender();
  useHostRiddleLifecycle({...owner.options, onRecoveryAttempt: jest.fn()});
  held.resolve(riddle);
  expect(await loading).toBe(true);
  expect(owner.postToGame).toHaveBeenCalledTimes(1);
  expect(owner.activity).toBe(0);
});

it("starts no automatic recovery read while the game frame is retired by a failed bridge", async () => {
  /** Any authority read here would be the defect: the frame that could display it is gone. */
  const load = jest.fn<HostServices["loadRiddle"]>().mockResolvedValue(riddle);
  /** The host has already replaced the game with bridge startup recovery. */
  const owner = setup(load, {recoverySuspended: true});
  await jest.advanceTimersByTimeAsync(250);
  window.dispatchEvent(new Event("online"));
  await jest.advanceTimersByTimeAsync(30_000);
  expect(load).not.toHaveBeenCalled();
  expect(owner.onRecoveryAttempt).not.toHaveBeenCalled();
  expect(owner.postToGame).not.toHaveBeenCalled();
});


it("starts no content warmups for a retired game frame", () => {
  /** Each invocation may issue Classic and Daily provider downloads. */
  const preload = jest.fn();
  setup(jest.fn(), {recoverySuspended: true, preloadInitialRiddles: preload});
  expect(preload).not.toHaveBeenCalled();
});

it("keeps content warmups available for an active game frame", () => {
  /** Active startup still benefits from target-owned preparation. */
  const preload = jest.fn();
  setup(jest.fn(), {preloadInitialRiddles: preload});
  expect(preload).toHaveBeenCalledWith("en", expect.any(AbortSignal));
  expect(preload).toHaveBeenCalledTimes(1);
});

it("does not warm a replacement account after bridge retirement", () => {
  /** Original active startup has already warmed its own content. */
  const preload = jest.fn();
  /** Mounted recovery owner retains the original admitted preparation. */
  const owner = setup(jest.fn(), {preloadInitialRiddles: preload});
  expect(preload).toHaveBeenCalledTimes(1);
  cleanup?.(); effects.length = 0; beginRender();
  useHostRiddleLifecycle({...owner.options, userId: "replacement-player", recoverySuspended: true});
  cleanup = effects[0]() || undefined;
  expect(preload).toHaveBeenCalledTimes(1);
});


it("retires deferred warmup admission when the owner unmounts", () => {
  /** Target facade receives a signal before its lazy adapter finishes loading. */
  const preload = jest.fn();
  setup(jest.fn(), {preloadInitialRiddles: preload});
  /** Original signal owns only this content context. */
  const signal = preload.mock.calls[0]![1] as AbortSignal;
  expect(signal.aborted).toBe(false);
  retire();
  expect(signal.aborted).toBe(true);
});

it("retires deferred warmup admission when bridge suspension commits", () => {
  /** No new context read or warmup is required to retire the old request. */
  const preload = jest.fn();
  /** Stable account and provider keep their original visible read ownership. */
  const owner = setup(jest.fn(), {preloadInitialRiddles: preload});
  /** Original facade admission is independently revocable. */
  const signal = preload.mock.calls[0]![1] as AbortSignal;
  beginRender(); useHostRiddleLifecycle({...owner.options, recoverySuspended: true});
  expect(signal.aborted).toBe(true);
  expect(preload).toHaveBeenCalledTimes(1);
});

it.each(['preview','paid'] as const)('preserves recovery target across a failed %s successor load',async kind=>{
 /** Authority calls expose the actual automatic recovery index. */
 const load=jest.fn<HostServices['loadRiddle']>().mockRejectedValueOnce(new Error('ordinary load unavailable')).mockRejectedValueOnce(new Error('successor load unavailable')).mockResolvedValue({...riddle,index:kind==='preview'?1:2});
 /** Mounted lifecycle retains canonical recovery ownership. */
 const owner=setup(load);
 expect(await owner.lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1},'ordinary-owned')).toBe(false);
 expect(await owner.lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:2},kind==='preview'?'skip-preview-held':'skip-paid')).toBe(false);
 await jest.advanceTimersByTimeAsync(250);
 expect(load).toHaveBeenLastCalledWith({gameMode:'classic',locale:'en',classicIndex:kind==='preview'?1:2},expect.any(AbortSignal));
});

it('keeps held canonical delivery alive when an optional preview fails',async()=>{
 /** Issued current question bounds its optional successor. */
 const parent={...riddle,index:1,sessionToken:'00000000-0000-4000-8000-000000000001'};
 /** Canonical wait stays admitted across the failed optional read. */
 const held=deferred<BridgeRiddle>();
 /** Original content, held canonical reload, and failed preview. */
 const load=jest.fn<HostServices['loadRiddle']>().mockResolvedValueOnce(parent).mockReturnValueOnce(held.promise).mockRejectedValueOnce(new Error('Preview unavailable'));
 /** Actual mounted host owns independent delivery waits. */
 const owner=setup(load);
 expect(await owner.lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1},'initial')).toBe(true);
 /** Held ordinary request may not be retired by speculative work. */
 const canonical=owner.lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1},'canonical');
 expect(await owner.lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:2},'skip-preview-held')).toBe(false);
 expect(load.mock.calls[1][1]?.aborted).toBe(false);
 held.resolve(parent);expect(await canonical).toBe(true);
 expect(owner.postToGame.mock.calls.some(call=>call[0].requestId==='skip-preview-held')).toBe(false);
});
it('rejects a late optional preview after newer canonical delivery starts',async()=>{
 /** Current issued origin of the optional read. */
 const parent={...riddle,index:1,sessionToken:'00000000-0000-4000-8000-000000000001'};
 /** Optional authority result retained while a canonical request starts. */
 const held=deferred<BridgeRiddle>();
 /** New canonical question outranks the retained optional reply. */
 const newer={...riddle,index:3,sessionToken:'00000000-0000-4000-8000-000000000003'};
 /** Distinct provider waits expose their ownership ordering. */
 const load=jest.fn<HostServices['loadRiddle']>().mockResolvedValueOnce(parent).mockReturnValueOnce(held.promise).mockResolvedValueOnce(newer);
 /** Mounted context owns the latest visible content. */
 const owner=setup(load);
 await owner.lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1},'initial');
 /** Optional request is pending before canonical advancement. */
 const preview=owner.lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:2},'skip-preview-held');
 await jest.advanceTimersByTimeAsync(0);expect(load).toHaveBeenCalledTimes(2);
 expect(await owner.lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:3},'canonical-newer')).toBe(true);
 held.resolve(riddle);expect(await preview).toBe(false);
 expect(owner.postToGame.mock.calls.at(-1)?.[0]).toMatchObject({requestId:'canonical-newer',payload:{riddle:newer}});
});
