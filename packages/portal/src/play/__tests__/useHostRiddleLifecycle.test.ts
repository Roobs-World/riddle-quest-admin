import {expect, it, jest} from "@jest/globals";
import type {HostServices} from "../types";
jest.mock("react", () => ({useCallback: <T>(callback: T) => callback, useEffect: () => undefined,
  useMemo: <T>(factory: () => T) => factory(), useLayoutEffect: (effect: () => void) => effect(),
  useRef: <T>(current: T) => ({current}), useState: <T>(initial: T) => [initial, jest.fn()]}));
jest.mock("../../analytics/events", () => ({trackEvent: jest.fn()}));
jest.mock("../../observability/browserErrorReporter", () => ({captureBrowserException: jest.fn()}));
jest.mock("../preloadGameModals", () => ({preloadGameModals: async () => undefined}));
import {useHostRiddleLifecycle} from "../useHostRiddleLifecycle";

it.each(["functions/deadline-exceeded", "deadline-exceeded"])("renders a translated recovery notice for callable timeout %s", async (code) => {
  /** Real lifecycle catch receives the same structured error as the callable SDK. */
  const services = {loadRiddle: async () => {throw Object.assign(new Error("deadline-exceeded"), {code});}};
  /** Captures the notice and correlated failure delivered to the player. */
  const notice = jest.fn();
  /** Observes the correlated authority failure sent to the current question request. */
  const operation = jest.fn();
  /** Real lifecycle receives the injected callable timeout. */
  const lifecycle = useHostRiddleLifecycle({userId: "player", profile: null, initialGameMode: "classic", locale: "en",
    services, withActivity: callback => callback(), postToGame: jest.fn(),
    postOperation: operation, configurationWarning: null, setNotice: notice, onRecoveryAttempt: jest.fn()});
  expect(await lifecycle.loadRiddle({gameMode: "classic", locale: "en"}, "timed-out-question")).toBe(false);
  /** Existing translated recovery copy expected for both callable timeout spellings. */
  const expected = "Service temporarily unavailable. Please try again.";
  expect(notice).toHaveBeenLastCalledWith(expected);
  expect(operation).toHaveBeenLastCalledWith("timed-out-question", "loadRiddle", false, undefined, expected);
});
it.each([undefined, "load-after-daily-win"])("loads Classic after authoritative Daily completion, preserving correlation %s", async (requestId) => {
  /** Injected authority loader records fallback attempts and correlated failures. */
  const load = jest.fn<HostServices["loadRiddle"]>(async input => {
    if (input.gameMode === "challenge") throw Object.assign(new Error("Today's daily challenge is already complete."), {code: "daily-completed"});
    return {riddleId: "classic_2", text: "A very tall animal", answerLength: 7,
      sessionToken: "00000000-0000-4000-8000-000000000002", gameMode: "classic", index: 2};
  });
  /** Observed outbound game messages used to verify successful content delivery. */
  const post = jest.fn();
  /** Observed player-facing failure notices retained during Classic fallback. */
  const notice = jest.fn();
  /** Correlated completion is a routing decision, never a failed player command. */
  const operation = jest.fn();
  /** Real host content lifecycle bound to the injected loader and callbacks. */
  const lifecycle = useHostRiddleLifecycle({userId: "test-player", profile: {classicIndex: 2}, initialGameMode: "challenge", locale: "en",
    services: {loadRiddle: load}, withActivity: operation => operation(), postToGame: post,
    postOperation: operation, configurationWarning: null, setNotice: notice, onRecoveryAttempt: jest.fn()});
  expect(await lifecycle.loadRiddle({gameMode: "challenge", locale: "en"}, requestId)).toBe(true);
  expect(load.mock.calls.map(([input]) => input.gameMode)).toEqual(["challenge", "classic"]);
  expect(post).toHaveBeenCalledWith(expect.objectContaining({type: "host:riddleLoaded", payload: expect.objectContaining({riddle: expect.objectContaining({gameMode: "classic", index: 2})})}));
  expect(notice.mock.calls.at(-1)?.[0]).toBeNull();
  expect(post).toHaveBeenCalledWith(expect.objectContaining({requestId}));
  expect(operation.mock.calls.every((call) => call[2] === true)).toBe(true);
  expect(operation).toHaveBeenLastCalledWith(requestId, "loadRiddle", true, {riddleId: "classic_2"});
});

it.each([
  {mode: "classic" as const, requestId: undefined},
  {mode: "challenge" as const, requestId: "daily-request-1"},
  {mode: "challenge" as const, requestId: "skip-preview-1"},
])("retains failure correlation for $mode/$requestId", async ({mode, requestId}) => {
  /** Injected authority loader records fallback attempts and correlated failures. */
  const load = jest.fn<HostServices["loadRiddle"]>(async () => {throw new Error("Unavailable");});
  /** Observed outbound game messages used to verify successful content delivery. */
  const post = jest.fn();
  /** Real host content lifecycle bound to the injected loader and callbacks. */
  const lifecycle = useHostRiddleLifecycle({userId: "player", profile: null, initialGameMode: mode, locale: "en",
    services: {loadRiddle: load}, withActivity: operation => operation(), postToGame: post,
    postOperation: jest.fn(), configurationWarning: null, setNotice: jest.fn(), onRecoveryAttempt: jest.fn()});
  expect(await lifecycle.loadRiddle({gameMode: mode, locale: "en"}, requestId)).toBe(false);
  expect(load).toHaveBeenCalledTimes(1);
  expect(post).not.toHaveBeenCalled();
});

it("keeps an unavailable Daily selected and retryable without loading Classic", async () => {
  /** Injected authority loader records fallback attempts and correlated failures. */
  const load = jest.fn<HostServices["loadRiddle"]>(async () => {throw new Error("Network unavailable");});
  /** Real host content lifecycle bound to the injected loader and callbacks. */
  const unavailable = jest.fn();
  /** Daily failure belongs to this real lifecycle and its injected authority loader. */
  const lifecycle = useHostRiddleLifecycle({userId: "player", profile: null, initialGameMode: "challenge", locale: "en", onStartupUnavailable: unavailable,
    services: {loadRiddle: load}, withActivity: operation => operation(), postToGame: jest.fn(),
    postOperation: jest.fn(), configurationWarning: null, setNotice: jest.fn(), onRecoveryAttempt: jest.fn()});
  expect(await lifecycle.loadRiddle({gameMode: "challenge", locale: "en"})).toBe(false);
  expect(load.mock.calls.map(([input]) => input.gameMode)).toEqual(["challenge"]);
  expect(unavailable).toHaveBeenCalledTimes(1);
});

it("keeps the Next request retryable if Classic fails after confirmed Daily completion", async () => {
  /** Authority confirms Daily completion, but the successor is temporarily unavailable. */
  const load = jest.fn<HostServices["loadRiddle"]>(async input => {
    if (input.gameMode === "challenge") throw Object.assign(new Error("Daily completed"), {code: "daily-completed"});
    throw new Error("Classic unavailable");
  });
  /** Original request receives the successor failure rather than an expected Daily completion error. */
  const operation = jest.fn();
  /** No solved Daily board may be delivered as the requested successor. */
  const post = jest.fn();
  /** Real host lifecycle handles this correlated Daily-to-Classic transition. */
  const lifecycle = useHostRiddleLifecycle({userId: "player", profile: {classicIndex: 17}, initialGameMode: "challenge", locale: "ar",
    services: {loadRiddle: load}, withActivity: callback => callback(), postToGame: post,
    postOperation: operation, configurationWarning: null, setNotice: jest.fn(), onRecoveryAttempt: jest.fn()});
  expect(await lifecycle.loadRiddle({gameMode: "challenge", locale: "ar"}, "load-next")).toBe(false);
  expect(load.mock.calls.map(([input]) => input)).toEqual([
    {gameMode: "challenge", locale: "ar"}, {gameMode: "classic", locale: "ar", classicIndex: 17},
  ]);
  expect(post).not.toHaveBeenCalled();
  expect(operation).toHaveBeenCalledTimes(1);
  expect(operation.mock.calls[0]).toEqual(["load-next", "loadRiddle", false, undefined, expect.stringContaining("Classic unavailable")]);
});
