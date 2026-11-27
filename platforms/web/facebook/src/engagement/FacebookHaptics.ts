import type {LifecycleCapability} from "../../../../../src/platform/contracts/capabilities";
import type {CompletionResult} from "../../../../../src/platform/contracts/hostServices";
import type {HostCompletionInput} from "../../../../../src/progression/browser/hostCompletionEffects";
import {completionPresentationKey} from "../../../../../src/gameplay/session/completion/completionPresentation";
import type {HapticFeedbackCapability, HapticFeedbackSnapshot} from "../../../../../src/settings/contracts/hapticFeedback";
import {
  isPlayerHapticsEnabled,
  isPlayerReducedMotionEnabled,
  setPlayerHapticsEnabled,
  subscribeToPlayerHaptics,
} from "../../../../../src/settings/browser/playerPreferences";
import type {FacebookInstantSdk} from "../fbinstant";

export interface FacebookHaptics extends HapticFeedbackCapability {
  complete(input: HostCompletionInput, result: CompletionResult): Promise<void>;
  retire(): void;
}

/** Native success feedback is an account-owned opt-in, never a gameplay dependency. */
export function createFacebookHaptics({sdk, isActive, lifecycle}: {
  sdk: FacebookInstantSdk;
  isActive: () => boolean;
  lifecycle?: LifecycleCapability;
}): FacebookHaptics | undefined {
  try {
    if (!sdk.getSupportedAPIs().includes("performHapticFeedbackAsync") ||
      typeof sdk.performHapticFeedbackAsync !== "function") return undefined;
  } catch {return undefined;}
  const performHapticFeedback = sdk.performHapticFeedbackAsync.bind(sdk);
  const listeners = new Set<() => void>();
  const consumed = new Set<string>();
  let retired = false;
  let paused = false;
  let pending = false;
  let available = true;
  let snapshot: HapticFeedbackSnapshot = {available: true, enabled: isPlayerHapticsEnabled()};
  const current = () => !retired && isActive();
  const publish = () => {
    const enabled = !retired && isPlayerHapticsEnabled();
    const nextAvailable = !retired && available;
    if (snapshot.enabled === enabled && snapshot.available === nextAvailable) return;
    snapshot = {enabled, available: nextAvailable};
    listeners.forEach(listener => listener());
  };
  const unsubscribePreference = subscribeToPlayerHaptics(publish);
  const unsubscribePause = lifecycle?.onPause(() => {paused = true;});
  const unsubscribeResume = lifecycle?.onResume?.(() => {paused = false;});

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {listeners.add(listener); return () => {listeners.delete(listener);};},
    setEnabled: enabled => {
      if (current() && available) setPlayerHapticsEnabled(enabled);
    },
    complete: async (input, result) => {
      if (!current()) return;
      const identity = JSON.stringify([input.gameMode, completionPresentationKey(input)]);
      if (consumed.has(identity)) return;
      consumed.add(identity);
      if (!result.isCorrect || !available || pending || paused || !isPlayerHapticsEnabled() ||
        isPlayerReducedMotionEnabled() || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
      pending = true;
      try {
        await performHapticFeedback();
      } catch (error) {
        if (current() && typeof error === "object" && error !== null && "code" in error &&
          error.code === "CLIENT_UNSUPPORTED_OPERATION") {
          available = false;
          publish();
        }
      } finally {
        pending = false;
      }
    },
    retire: () => {
      if (retired) return;
      retired = true;
      unsubscribePreference();
      unsubscribePause?.();
      unsubscribeResume?.();
      consumed.clear();
      publish();
      listeners.clear();
    },
  };
}
