import {afterEach, beforeEach, expect, it, jest} from "@jest/globals";
import type {HostServices} from "../../../hosted/hostTypes";
/** Stable hook cells support account replacement and retained callback regressions. */
const refs: Array<{
  /** Current hook value. */
  current: unknown}> = [];
/** Memoization preserves the account owner across unrelated profile renders. */
const memos: Array<{
  /** Stored dependency identities. */
  deps: unknown[];
  /** Stored result. */
  value: unknown}> = [];
/** Layout retirement is observed before the lifecycle's passive reset. */
const layouts: Array<{
  /** Stored dependencies. */
  deps: unknown[];
  /** Retires this layout lifetime. */
  cleanup?: () => void}> = [];
/** Each simulated render starts from the same hook positions. */
let refIndex = 0, memoIndex = 0, layoutIndex = 0;
jest.mock("react", () => ({useCallback: <T>(callback: T) => callback, useEffect: () => undefined,
  useRef: (current: unknown) => {
    /** Ref order advances on every render, including initialized cells. */
    const index = refIndex++; return refs[index] ?? (refs[index] = {current});
  },
  useMemo: (factory: () => unknown, deps: unknown[]) => {
    /** Memo dependencies follow React's identity comparison. */
    const i = memoIndex++, prior = memos[i];
    if (!prior || deps.some((value, index) => !Object.is(value, prior.deps[index]))) memos[i] = {deps, value: factory()};
    return memos[i]!.value;
  },
  useLayoutEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    /** Changed committed ownership synchronously retires the earlier account. */
    const i = layoutIndex++, prior = layouts[i];
    if (!prior || deps.some((value, index) => !Object.is(value, prior.deps[index]))) {
      prior?.cleanup?.(); layouts[i] = {deps, cleanup: effect() ?? undefined};
    }
  }, useState: <T>(initial: T) => [initial, jest.fn()]}));
jest.mock("../../analytics/events", () => ({trackEvent: jest.fn()}));
jest.mock("../../observability/browserErrorReporter", () => ({captureBrowserException: jest.fn()}));
jest.mock("../preloadGameModals", () => ({preloadGameModals: async () => undefined}));
import {useHostRiddleLifecycle} from "../useHostRiddleLifecycle";
import {RIDDLE_LOAD_DEADLINE_MS} from "../riddleLoadDeadline";
/** Authority-issued current and successor questions carry distinct immutable sessions. */
const question = (index: number): Awaited<ReturnType<HostServices["loadRiddle"]>> => ({riddleId: "q" + index,
  text: "What has keys?", answerLength: 5, gameMode: "classic", index,
  sessionToken: "00000000-0000-4000-8000-" + String(index).padStart(12, "0"),
  attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false});
/** Controlled optional read can settle after an ordinary Next or ownership replacement. */
const deferred = <T>() => {
  /** Resolves held authority work. */
  let resolve!: (value: T) => void;
  /** Rejects held authority work. */
  let reject!: (reason: Error) => void;
  /** Adapter operation held across explicit player actions. */
  const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
};
beforeEach(() => {refs.length = memos.length = layouts.length = 0; refIndex = memoIndex = layoutIndex = 0;});
afterEach(() => {jest.useRealTimers(); jest.restoreAllMocks();});
/** Initializes the real host lifecycle with read-only authority and visible-effect counters. */
const setup = () => {
  /** Counts actual guarded content reads independently of local delivery. */
  const load = jest.fn<HostServices["loadRiddle"]>(async input => question(input.classicIndex ?? 1));
  /** Optional preparation must not publish content or reset notices prematurely. */
  const post = jest.fn(), notice = jest.fn(), operation = jest.fn(), activity = jest.fn();
  /** Profile is read at delivery, never retained inside a prepared question. */
  const profile = {coins: 300, classicIndex: 1};
  /** Committed host options can change while old callbacks or reads remain pending. */
  const options = {userId: "player", accountGeneration: 1, profile, initialGameMode: "classic" as const, locale: "en",
    services: {loadRiddle: load}, canUsePreparedQuestions: () => true,
    withActivity: async <T>(callback: () => Promise<T>): Promise<T> => {activity(); return callback();}, postToGame: post,
    postOperation: operation, configurationWarning: null, setNotice: notice, onRecoveryAttempt: jest.fn()};
  /** Renders preserve hook cells while committing the latest ownership boundary. */
  const render = () => {refIndex = memoIndex = layoutIndex = 0; return useHostRiddleLifecycle(options);};
  /** First host lifetime admits normal startup and subsequent read-only preparation. */
  const lifecycle = render();
  return {lifecycle, render, options, load, post, notice, operation, activity, profile};
};
/** Preparation binds the successor to the exact question already delivered to this player. */
const prepare = {gameMode: "classic" as const, locale: "en", classicIndex: 2,
  sessionToken: question(1).sessionToken, riddleId: question(1).riddleId, prepareNext: true as const};
/** Ordinary explicit Next never carries preparation origin IDs into a provider resume request. */
const next = {gameMode: "classic" as const, locale: "en", classicIndex: 2};
/** Startup delivers the parent, then clears visible-effect counters. */
const start = async (owner: ReturnType<typeof setup>) => {
  await owner.lifecycle.loadRiddle({...next, classicIndex: 1}, "initial");
  owner.post.mockClear(); owner.notice.mockClear(); owner.operation.mockClear(); owner.activity.mockClear();
};
it("prepares silently and strips origin IDs from the guarded provider read", async () => {
  /** Only adapter work occurs during the visible victory. */
  const owner = setup(); await start(owner);
  expect(await owner.lifecycle.loadRiddle(prepare, "prepare-next")).toBe(true);
  expect(owner.load).toHaveBeenLastCalledWith(next, expect.any(AbortSignal));
  expect(owner.load).toHaveBeenCalledTimes(2);
  expect(owner.post).not.toHaveBeenCalled(); expect(owner.notice).not.toHaveBeenCalled();
  expect(owner.operation).not.toHaveBeenCalled(); expect(owner.activity).not.toHaveBeenCalled();
});
it("consumes once on explicit Next with the latest profile and no further guarded read", async () => {
  /** Optional preparation precedes input without capturing economy state. */
  const owner = setup(); await start(owner); await owner.lifecycle.loadRiddle(prepare);
  owner.options.profile = {coins: 450, classicIndex: 2};
  /** A normal balance render preserves prepared content ownership. */
  const current = owner.render();
  expect(await current.loadRiddle(next, "explicit-next")).toBe(true);
  expect(owner.load).toHaveBeenCalledTimes(2);
  expect(owner.post).toHaveBeenCalledTimes(1);
  expect(owner.post.mock.calls[0]![0]).toMatchObject({type: "host:riddleLoaded", requestId: "explicit-next",
    payload: {riddle: question(2), profile: {coins: 450}}});
  expect(owner.operation).toHaveBeenCalledWith("explicit-next", "loadRiddle", true, {riddleId: "q2"});
  await current.loadRiddle(next, "second-next"); expect(owner.load).toHaveBeenCalledTimes(3);
});
it("deduplicates pending and ready preparation for the same predecessor", async () => {
  /** Two preparation deliveries may overlap under StrictMode or bridge replay. */
  const owner = setup(); await start(owner);
  /** Pending adapter operation must remain the sole owner of this slot. */
  const held = deferred<ReturnType<typeof question>>(); owner.load.mockImplementationOnce(() => held.promise);
  /** Original optional request remains pending while a replay is admitted without a second read. */
  const pending = owner.lifecycle.loadRiddle(prepare);
  await Promise.resolve(); await Promise.resolve();
  await owner.lifecycle.loadRiddle(prepare); expect(owner.load).toHaveBeenCalledTimes(2);
  held.resolve(question(2)); await pending; await owner.lifecycle.loadRiddle(prepare);
  expect(owner.load).toHaveBeenCalledTimes(2);
});
it.each([15_000, 15_001, -1])("falls back when prepared content has invalid age %s", async age => {
  /** Expiry and backward wall-clock movement cannot admit local cached content. */
  const owner = setup(); await start(owner); jest.spyOn(Date, "now").mockReturnValue(100_000);
  await owner.lifecycle.loadRiddle(prepare); jest.spyOn(Date, "now").mockReturnValue(100_000 + age);
  await owner.lifecycle.loadRiddle(next, "expired-next"); expect(owner.load).toHaveBeenCalledTimes(3);
});
it.each([{sessionToken: question(3).sessionToken}, {riddleId: "foreign"}, {classicIndex: 3}, {locale: "fr"},
  {gameMode: "challenge" as const}, {authoritative: true}])("quietly rejects an unbound preparation %j", async changed => {
  /** Neither visible state nor backend work may be changed by another origin. */
  const owner = setup(); await start(owner);
  expect(await owner.lifecycle.loadRiddle({...prepare, ...changed})).toBe(false);
  expect(owner.load).toHaveBeenCalledTimes(1); expect(owner.post).not.toHaveBeenCalled(); expect(owner.notice).not.toHaveBeenCalled();
});
it.each([{authoritative: true}, {sessionToken: question(2).sessionToken, riddleId: "q2"},
  {classicIndex: 3}, {locale: "fr"}, {gameMode: "challenge" as const}])("preserves ordinary adapter loading for %j", async changed => {
  /** Resume, recovery, Daily and alternate content requests cannot consume the successor optimization. */
  const owner = setup(); await start(owner); await owner.lifecycle.loadRiddle(prepare);
  await owner.lifecycle.loadRiddle({...next, ...changed}, "ordinary"); expect(owner.load).toHaveBeenCalledTimes(3);
});
it.each([false, "throws"])('falls back when current target admission is %s', async admission => {
  /** Deletion or a failed gate query revokes already issued local content. */
  const owner = setup(); await start(owner); await owner.lifecycle.loadRiddle(prepare);
  owner.options.canUsePreparedQuestions = () => {if (admission === "throws") throw new Error("gate unavailable"); return false;};
  await owner.render().loadRiddle(next, "closed-gate"); expect(owner.load).toHaveBeenCalledTimes(3);
});
it("rejects preparation while the synchronous gate is closed", async () => {
  /** No optional authority read is attempted after account retirement. */
  const owner = setup(); await start(owner); owner.options.canUsePreparedQuestions = () => false;
  expect(await owner.render().loadRiddle(prepare)).toBe(false); expect(owner.load).toHaveBeenCalledTimes(1);
});
it("quietly tolerates preparation failure and retains the explicit Next path", async () => {
  /** An optional network failure cannot schedule host recovery or reset readiness. */
  const owner = setup(); await start(owner); owner.load.mockRejectedValueOnce(new Error("offline"));
  expect(await owner.lifecycle.loadRiddle(prepare)).toBe(false);
  expect(owner.post).not.toHaveBeenCalled(); expect(owner.notice).not.toHaveBeenCalled(); expect(owner.operation).not.toHaveBeenCalled();
  await owner.lifecycle.loadRiddle(next, "retry-next"); expect(owner.load).toHaveBeenCalledTimes(3);
});
it("bounds an optional read and ignores its late completion", async () => {
  /** A stalled adapter never holds optional preparation forever. */
  const owner = setup(); await start(owner); jest.useFakeTimers();
  /** Adapter result retained past the content deadline. */
  const held = deferred<ReturnType<typeof question>>(); owner.load.mockImplementationOnce(() => held.promise);
  /** Deadline races the held authority result using the real content lifecycle helper. */
  const pending = owner.lifecycle.loadRiddle(prepare);
  await Promise.resolve(); await Promise.resolve();
  await jest.advanceTimersByTimeAsync(RIDDLE_LOAD_DEADLINE_MS); expect(await pending).toBe(false);
  held.resolve(question(2)); await Promise.resolve(); expect(owner.post).not.toHaveBeenCalled(); expect(owner.notice).not.toHaveBeenCalled();
  await owner.lifecycle.loadRiddle(next, "after-deadline"); expect(owner.load).toHaveBeenCalledTimes(3);
});
it("keeps a pending preparation from replacing the result of an ordinary Next", async () => {
  /** Input does not wait on a speculative read that has not become ready. */
  const owner = setup(); await start(owner);
  /** Old prepared result belongs to the now-dismissed predecessor. */
  const held = deferred<ReturnType<typeof question>>(); owner.load.mockImplementationOnce(() => held.promise);
  /** Optional read is overtaken by the ordinary correlated load. */
  const pending = owner.lifecycle.loadRiddle(prepare);
  await Promise.resolve(); await Promise.resolve(); await owner.lifecycle.loadRiddle(next, "next-now");
  held.resolve(question(2)); expect(await pending).toBe(false);
  expect(owner.post).toHaveBeenCalledTimes(1); expect(owner.post.mock.calls[0]![0]).toMatchObject({requestId: "next-now"});
});
it.each(["userId", "accountGeneration", "locale", "services"] as const)("retires pending reads and retained preparation callbacks after %s changes", async key => {
  /** Ownership must change before passive host reset can run. */
  const owner = setup(); await start(owner);
  /** Read admitted by the previous committed account. */
  const held = deferred<ReturnType<typeof question>>(); owner.load.mockImplementationOnce(() => held.promise);
  /** A retained old callback must not issue provider work in the replacement scope. */
  const pending = owner.lifecycle.loadRiddle(prepare);
  await Promise.resolve(); await Promise.resolve();
  if (key === "userId") owner.options.userId = "replacement";
  if (key === "accountGeneration") owner.options.accountGeneration = 2;
  if (key === "locale") owner.options.locale = "fr";
  if (key === "services") owner.options.services = {loadRiddle: jest.fn<HostServices["loadRiddle"]>(async () => question(3))};
  /** New callbacks cannot use the old account visit’s delivered predecessor either. */
  const current = owner.render(); expect(await current.loadRiddle(prepare)).toBe(false);
  held.resolve(question(2)); expect(await pending).toBe(false);
  expect(await owner.lifecycle.loadRiddle(prepare)).toBe(false); expect(owner.load).toHaveBeenCalledTimes(2);
});
it("retires prepared content on layout unmount before passive cleanup", async () => {
  /** The owning frame may disappear before a queued preparation callback is sampled. */
  const owner = setup(); await start(owner); await owner.lifecycle.loadRiddle(prepare);
  layouts[0]!.cleanup?.(); expect(await owner.lifecycle.loadRiddle(prepare)).toBe(false);
  expect(owner.load).toHaveBeenCalledTimes(2);
});
it.each([question(1), question(3), {...question(2), gameMode: "challenge" as const}])("rejects an adapter response that is not the exact distinct successor %j", async response => {
  /** Invalid issuance quietly leaves ordinary loading intact. */
  const owner = setup(); await start(owner); owner.load.mockResolvedValueOnce(response);
  expect(await owner.lifecycle.loadRiddle(prepare)).toBe(false);
  await owner.lifecycle.loadRiddle(next, "valid-next"); expect(owner.load).toHaveBeenCalledTimes(3);
});
it("does not let an older failed preparation clear a newer slot for the same predecessor", async () => {
  /** An ordinary failed Next discards the old preparation without replacing its displayed parent. */
  const owner = setup(); await start(owner);
  /** First optional read is held until a replacement preparation is ready. */
  const held = deferred<ReturnType<typeof question>>(); owner.load.mockImplementationOnce(() => held.promise);
  /** Original read retains the same predecessor identity but no longer owns the cache slot. */
  const old = owner.lifecycle.loadRiddle(prepare);
  await Promise.resolve(); await Promise.resolve();
  owner.load.mockRejectedValueOnce(new Error("ordinary unavailable")); await owner.lifecycle.loadRiddle(next, "failed-next");
  await owner.lifecycle.loadRiddle(prepare); held.reject(new Error("old optional read failed")); expect(await old).toBe(false);
  await owner.lifecycle.loadRiddle(next, "prepared-retry"); expect(owner.load).toHaveBeenCalledTimes(4);
});
