import {beforeEach, expect, it, jest} from "@jest/globals";
import type {AuthSnapshot, HostServices} from "../types";

/** Retains effect lifetimes across simulated parent renders. */
const effects: Array<{
  /** Values governing the retained effect lifetime. */
  dependencies: readonly unknown[];
  /** Disposes the previous subscription before replacing it. */
  cleanup?: () => void;
}> = [];
/** Identifies each effect in hook order for the current render. */
let effectIndex = 0;

jest.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useMemo: <T>(factory: () => T) => factory(),
  useState: <T>(initial: T) => [initial, jest.fn()],
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
  effectIndex = 0;
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
    effectIndex = 0;
    useHostAuthSession({services: {auth, loadProfile}, platformRegistered: false, postToGame});
  }
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribe).not.toHaveBeenCalled();

  /** A genuinely different identity provider must still replace the listener. */
  const replacement = jest.fn(() => jest.fn());
  effectIndex = 0;
  useHostAuthSession({services: {auth: {subscribe: replacement}, loadProfile}, platformRegistered: false, postToGame});
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(replacement).toHaveBeenCalledTimes(1);
});
