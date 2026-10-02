import {expect, it, jest} from "@jest/globals";
import type {HostServices} from "../types";
jest.mock("react", () => ({useCallback: <T>(callback: T) => callback, useEffect: () => undefined,
  useRef: <T>(current: T) => ({current}), useState: <T>(initial: T) => [initial, jest.fn()]}));
jest.mock("../../analytics/events", () => ({trackEvent: jest.fn()}));
jest.mock("../../observability/browserErrorReporter", () => ({captureBrowserException: jest.fn()}));
jest.mock("../preloadGameModals", () => ({preloadGameModals: async () => undefined}));
import {useHostRiddleLifecycle} from "../useHostRiddleLifecycle";
it("loads Classic only after authoritative confirmation that today’s Daily is complete", async () => {
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
  /** Real host content lifecycle bound to the injected loader and callbacks. */
  const lifecycle = useHostRiddleLifecycle({userId: "test-player", profile: {classicIndex: 2}, initialGameMode: "challenge", locale: "en",
    services: {loadRiddle: load}, withActivity: operation => operation(), postToGame: post,
    postOperation: jest.fn(), configurationWarning: null, setNotice: notice, onRecoveryAttempt: jest.fn()});
  expect(await lifecycle.loadRiddle({gameMode: "challenge", locale: "en"})).toBe(true);
  expect(load.mock.calls.map(([input]) => input.gameMode)).toEqual(["challenge", "classic"]);
  expect(post).toHaveBeenCalledWith(expect.objectContaining({type: "host:riddleLoaded", payload: expect.objectContaining({riddle: expect.objectContaining({gameMode: "classic", index: 2})})}));
  expect(notice.mock.calls.at(-1)?.[0]).toBeNull();
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
