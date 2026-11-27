import {afterEach, beforeEach, describe, expect, it} from "@jest/globals";
import type {LifecycleCapability} from "../../../../../src/platform/contracts/capabilities";
import type {CompletionResult} from "../../../../../src/platform/contracts/hostServices";
import type {HostCompletionInput} from "../../../../../src/progression/browser/hostCompletionEffects";
import {
  applyPlayerPreferences,
  isPlayerHapticsEnabled,
  setPlayerReducedMotion,
  subscribeToPlayerPreferenceChanges,
  type PlayerPreferenceChange,
} from "../../../../../src/settings/browser/playerPreferences";
import {createFacebookHaptics, type FacebookHaptics} from "../engagement/FacebookHaptics";
import type {FacebookInstantSdk} from "../fbinstant";

const win: CompletionResult = {
  isCorrect: true, attempts: 2, coinsEarned: 50, newlyUnlockedAchievementIds: [],
};
const puzzle = (index: number): HostCompletionInput => ({
  gameMode: "classic", riddleId: `riddle-${index}`, sessionToken: `issued-session-${index}`,
});
const controllers: FacebookHaptics[] = [];
const disposers: Array<() => void> = [];
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

const deferred = () => {
  let resolve: (() => void) | undefined;
  let reject: ((reason: unknown) => void) | undefined;
  const promise = new Promise<void>((accept, decline) => {resolve = accept; reject = decline;});
  return {
    promise,
    resolve: () => {if (!resolve) throw new Error("Missing resolver"); resolve();},
    reject: (reason: unknown) => {if (!reject) throw new Error("Missing rejection handler"); reject(reason);},
  };
};

const fixture = (feedback: () => Promise<void> = async () => undefined) => {
  const nativeFeedback: string[] = [];
  const pauseHandlers = new Set<Parameters<LifecycleCapability["onPause"]>[0]>();
  const resumeHandlers = new Set<Parameters<LifecycleCapability["onPause"]>[0]>();
  const lifecycle: LifecycleCapability = {
    onPause: callback => {pauseHandlers.add(callback); return () => {pauseHandlers.delete(callback);};},
    onResume: callback => {resumeHandlers.add(callback); return () => {resumeHandlers.delete(callback);};},
  };
  let active = true;
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined,
    setLoadingProgress: () => undefined,
    startGameAsync: async () => undefined,
    getSupportedAPIs: () => ["performHapticFeedbackAsync"],
    onPause: () => undefined,
    player: {
      getID: () => "haptics-player",
      getSignedPlayerInfoAsync: async () => {throw new Error("Haptics must not request identity");},
      getDataAsync: async () => ({}),
      setDataAsync: async () => undefined,
      flushDataAsync: async () => undefined,
    },
    performHapticFeedbackAsync: async () => {nativeFeedback.push("vibration"); await feedback();},
  };
  const haptics = createFacebookHaptics({sdk, lifecycle, isActive: () => active});
  if (!haptics) throw new Error("Expected supported haptic feedback");
  controllers.push(haptics);
  return {
    haptics, nativeFeedback,
    setActive: (value: boolean) => {active = value;},
    pause: async () => {await Promise.all([...pauseHandlers].map(callback => callback()));},
    resume: async () => {await Promise.all([...resumeHandlers].map(callback => callback()));},
  };
};

beforeEach(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      visibilityState: "visible",
      documentElement: {dataset: {}, lang: "en", dir: "ltr"},
    }),
  });
  applyPlayerPreferences({locale: "en", hapticsEnabled: false, reducedMotion: false});
});

afterEach(() => {
  controllers.splice(0).forEach(controller => controller.retire());
  disposers.splice(0).forEach(dispose => dispose());
  applyPlayerPreferences({locale: "en", hapticsEnabled: false, reducedMotion: false});
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

describe("Facebook expanded haptic feedback", () => {
  it("requires opt-in, persists the choice, and never replays a win completed before opt-in", async () => {
    const {haptics, nativeFeedback} = fixture();
    const changes: PlayerPreferenceChange[] = [];
    disposers.push(subscribeToPlayerPreferenceChanges(change => changes.push(change)));
    await haptics.complete(puzzle(1), win);
    expect(haptics.getSnapshot()).toEqual({available: true, enabled: false});
    expect(nativeFeedback).toEqual([]);

    haptics.setEnabled(true);
    await haptics.complete(puzzle(1), win);
    await haptics.complete(puzzle(2), win);
    expect(haptics.getSnapshot()).toEqual({available: true, enabled: true});
    expect(nativeFeedback).toEqual(["vibration"]);

    haptics.setEnabled(false);
    await haptics.complete(puzzle(3), win);
    expect(nativeFeedback).toEqual(["vibration"]);
    expect(changes).toEqual([{hapticsEnabled: true}, {hapticsEnabled: false}]);
  });

  it("emits once per confirmed issued win and distinguishes session and game-mode identities", async () => {
    const {haptics, nativeFeedback} = fixture();
    haptics.setEnabled(true);
    await haptics.complete(puzzle(1), {...win, isCorrect: false});
    await haptics.complete(puzzle(2), win);
    await haptics.complete({...puzzle(2)}, {...win});
    await haptics.complete({...puzzle(2), sessionToken: "another-issued-session"}, win);
    await haptics.complete({...puzzle(2), gameMode: "challenge"}, win);
    expect(nativeFeedback).toEqual(["vibration", "vibration", "vibration"]);
  });

  it.each(["paused", "reduced motion", "hidden"])(
    "consumes feedback suppressed while %s and resumes only for a fresh win",
    async reason => {
      const {haptics, nativeFeedback, pause, resume} = fixture();
      haptics.setEnabled(true);
      if (reason === "paused") await pause();
      if (reason === "reduced motion") setPlayerReducedMotion(true);
      if (reason === "hidden") Object.defineProperty(document, "visibilityState", {value: "hidden"});
      await haptics.complete(puzzle(1), win);
      expect(nativeFeedback).toEqual([]);

      await resume();
      setPlayerReducedMotion(false);
      Object.defineProperty(document, "visibilityState", {value: "visible"});
      await haptics.complete(puzzle(1), win);
      await haptics.complete(puzzle(2), win);
      expect(nativeFeedback).toEqual(["vibration"]);
    },
  );

  it("does not overlap native feedback or replay receipts suppressed by a pending operation", async () => {
    const pending = deferred();
    const {haptics, nativeFeedback} = fixture(() => pending.promise);
    haptics.setEnabled(true);
    const first = haptics.complete(puzzle(1), win);
    await haptics.complete(puzzle(1), win);
    await haptics.complete(puzzle(2), win);
    expect(nativeFeedback).toEqual(["vibration"]);
    pending.resolve();
    await first;
    await haptics.complete(puzzle(2), win);
    await haptics.complete(puzzle(3), win);
    expect(nativeFeedback).toEqual(["vibration", "vibration"]);
  });

  it("ignores completion and Settings changes after the owning account becomes inactive", async () => {
    const {haptics, nativeFeedback, setActive} = fixture();
    haptics.setEnabled(true);
    await haptics.complete(puzzle(1), win);
    setActive(false);
    haptics.setEnabled(false);
    await haptics.complete(puzzle(2), win);
    expect(isPlayerHapticsEnabled()).toBe(true);
    expect(nativeFeedback).toEqual(["vibration"]);
  });

  it("retires pending feedback without letting late failure or stale Settings affect the next account", async () => {
    const pending = deferred();
    const oldAccount = fixture(() => pending.promise);
    oldAccount.haptics.setEnabled(true);
    const completing = oldAccount.haptics.complete(puzzle(1), win);
    oldAccount.haptics.retire();
    applyPlayerPreferences({locale: "en", reducedMotion: false});
    const nextAccount = fixture();
    oldAccount.haptics.setEnabled(true);
    expect(nextAccount.haptics.getSnapshot()).toEqual({available: true, enabled: false});

    nextAccount.haptics.setEnabled(true);
    pending.reject({code: "CLIENT_UNSUPPORTED_OPERATION"});
    await completing;
    await oldAccount.haptics.complete(puzzle(2), win);
    await nextAccount.haptics.complete(puzzle(1), win);
    expect(oldAccount.haptics.getSnapshot()).toEqual({available: false, enabled: false});
    expect(nextAccount.haptics.getSnapshot()).toEqual({available: true, enabled: true});
    expect(oldAccount.nativeFeedback).toEqual(["vibration"]);
    expect(nextAccount.nativeFeedback).toEqual(["vibration"]);
  });

  it("disables an unsupported native capability while preserving the player's stored preference", async () => {
    const {haptics, nativeFeedback} = fixture(async () => {throw {code: "CLIENT_UNSUPPORTED_OPERATION"};});
    haptics.setEnabled(true);
    await haptics.complete(puzzle(1), win);
    await haptics.complete(puzzle(2), win);
    expect(haptics.getSnapshot()).toEqual({available: false, enabled: true});
    expect(isPlayerHapticsEnabled()).toBe(true);
    expect(nativeFeedback).toEqual(["vibration"]);
  });
});
