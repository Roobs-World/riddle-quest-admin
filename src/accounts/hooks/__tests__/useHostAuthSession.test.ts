import {beforeEach, expect, it, jest} from "@jest/globals";
import type {AuthSnapshot, HostServices} from "../../../platform/contracts/hostServices";

/** Retains effect lifetimes across simulated parent renders. */
const effects: Array<{
  /** Values governing the retained effect lifetime. */
  dependencies: readonly unknown[];
  /** Disposes the previous subscription before replacing it. */
  cleanup?: () => void;
}> = [];
/** Identifies each effect in hook order for the current render. */
let effectIndex = 0;
/** Ref cells remain stable across simulated parent renders. */
const refs: Array<{
  /** Value retained by the hook lifetime. */
  current: unknown;
}> = [];
/** Current ref position follows the hook call order. */
let refIndex = 0;
/** Captures each reducer-facing snapshot, including temporary restored-profile projections. */
const mockSetSnapshot = jest.fn();

jest.mock("react", () => ({
  useRef: (initial: unknown) => {
    /** Reuses the exact ref cell retained during the first mounted render. */
    const index = refIndex++;
    return refs[index] ?? (refs[index] = {current: initial});
  },
  useCallback: <T>(callback: T) => callback,
  useMemo: <T>(factory: () => T) => factory(),
  useState: <T>(initial: T) => [initial, mockSetSnapshot],
  useEffect: (effect: () => void | (() => void), dependencies: readonly unknown[]) => {
    /** Selects the retained effect for this hook call. */
    const index = effectIndex++;
    /** Previously mounted effect, if any. */
    const previous = effects[index];
    if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
    previous?.cleanup?.();
    effects[index] = {dependencies, cleanup: effect() || undefined};
  },
}));

import {useHostAuthSession} from "../useHostAuthSession";

beforeEach(() => {
  effects.splice(0).forEach((effect) => effect.cleanup?.());
  effectIndex = 0; refIndex = 0; refs.splice(0);
  mockSetSnapshot.mockClear();
});

it("uses the saved profile only for its initial account while the server profile loads", () => {
  /** Account transitions may arrive before the replacement's remote profile. */
  let listener: (snapshot: AuthSnapshot) => void = () => {};
  /** Initial target storage belongs to the first account selected by this adapter. */
  const auth = {subscribe: (next: typeof listener) => {
    listener = next;next({user: {uid: "Alice", isAnonymous: false}, profile: null});return () => {};
  }};
  useHostAuthSession({services: {auth}, initialProfile: {coins: 300}, postToGame: jest.fn()});
  expect(mockSetSnapshot).toHaveBeenLastCalledWith({user: {uid: "Alice", isAnonymous: false}, profile: {coins: 300}});
  listener({user: {uid: "Bob", isAnonymous: false}, profile: null});
  expect(mockSetSnapshot).toHaveBeenLastCalledWith({user: {uid: "Bob", isAnonymous: false}, profile: null});
});

it("retires captured callbacks when the same UID is recreated with a new generation", () => {
  /** Account creation generation distinguishes the original and replacement UID visits. */
  let listener: (snapshot: AuthSnapshot) => void = () => {};
  /** First identity notification binds the saved profile and ownership to generation one. */
  const auth = {subscribe: (next: typeof listener) => {
    listener = next;next({user: {uid: "Alice", isAnonymous: false, accountGeneration: 1}, profile: null});return () => {};
  }};
  /** Target storage is stable across unrelated parent renders. */
  const initialProfile = {coins: 300};
  useHostAuthSession({services: {auth}, initialProfile, postToGame: jest.fn()});
  effectIndex = 0;refIndex = 0;
  /** Rendered host can capture the current account visit before replacement. */
  const host = useHostAuthSession({services: {auth}, initialProfile, postToGame: jest.fn()});
  /** Captured callback must become invalid even though the UID is unchanged. */
  const originalVisit = host.captureAccount("Alice");
  expect(originalVisit()).toBe(true);
  listener({user: {uid: "Alice", isAnonymous: false, accountGeneration: 2}, profile: null});
  expect(originalVisit()).toBe(false);
  expect(mockSetSnapshot).toHaveBeenLastCalledWith({user: {uid: "Alice", isAnonymous: false, accountGeneration: 2}, profile: null});
});

it("keeps one auth subscription when parent renders replace the commerce/service wrapper", () => {
  /** Mimics Firebase delivering a fresh profile on every subscription. */
  const subscribe = jest.fn((listener: (snapshot: AuthSnapshot) => void) => {
    listener({user: null, profile: {level: 1, wins: 0, winStreak: 0}});
    return unsubscribe;
  });
  /** Tracks disposal of the original identity subscription. */
  const unsubscribe = jest.fn();
  /** Stable provider retained across unrelated parent renders. */
  const auth = {subscribe};
  /** Captures game-bridge messages without a DOM. */
  const postToGame = jest.fn();
  /** Unused profile loader in the reconstructed authority wrapper. */
  const loadProfile: HostServices["loadProfile"] = async () => null;
  for (let render = 0; render < 5; render += 1) {
    effectIndex = 0; refIndex = 0;
    useHostAuthSession({services: {auth, loadProfile}, platformRegistered: false, postToGame});
  }
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribe).not.toHaveBeenCalled();

  /** A genuinely different identity provider must still replace the listener. */
  const replacement = jest.fn(() => jest.fn());
  effectIndex = 0; refIndex = 0;
  useHostAuthSession({services: {auth: {subscribe: replacement}, loadProfile}, platformRegistered: false, postToGame});
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(replacement).toHaveBeenCalledTimes(1);
});


it("changes ownership before rendering and ignores a disposed subscription callback", () => {
  /** Delayed notifications use the subscription's originally installed listener. */
  let listener: (snapshot: AuthSnapshot) => void = () => {};
  /** Stable auth adapter publishes the first account synchronously. */
  const auth = {subscribe: (next: typeof listener) => {
    listener = next; next({user: {uid: "owner-1", isAnonymous: false}, profile: null}); return () => {};
  }};
  /** Public ownership check reads subscription state without a subsequent React render. */
  const host = useHostAuthSession({services: {auth}, postToGame: jest.fn()});
  expect(host.ownsAccount("owner-1")).toBe(true);
  effectIndex = 0; refIndex = 0;
  /** The rendered account visit follows the synchronous initial subscription. */
  const renderedHost = useHostAuthSession({services: {auth}, postToGame: jest.fn()});
  /** Exact account visit stays valid through same-owner profile notifications only. */
  const original = renderedHost.captureAccount("owner-1");
  listener({user: {uid: "owner-1", isAnonymous: false}, profile: {level: 2, wins: 1, winStreak: 1}});
  expect(original()).toBe(true);
  listener({user: {uid: "owner-2", isAnonymous: false}, profile: null});
  expect(host.ownsAccount("owner-1")).toBe(false);
  expect(host.ownsAccount("owner-2")).toBe(true);
  expect(original()).toBe(false);
  listener({user: {uid: "owner-1", isAnonymous: false}, profile: null});
  expect(original()).toBe(false);
  expect(renderedHost.captureAccount("owner-1")()).toBe(false);
  effectIndex = 0; refIndex = 0;
  /** A new render can capture the replacement visit of the same UID. */
  const returnedHost = useHostAuthSession({services: {auth}, postToGame: jest.fn()});
  expect(returnedHost.captureAccount("owner-1")()).toBe(true);
  effects.splice(0).forEach(effect => effect.cleanup?.());
  listener({user: {uid: "owner-1", isAnonymous: false}, profile: null});
  expect(host.ownsAccount("owner-1")).toBe(false);
  expect(host.ownsAccount("owner-2")).toBe(false);
});
