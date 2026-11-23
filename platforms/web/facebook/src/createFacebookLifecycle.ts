import type {LifecycleCapability} from "../../../../src/web/platform/types";
import type {FacebookInstantSdk} from "./fbinstant";

/** One native registration fans out pause/resume to independently owned app consumers. */
export function createFacebookLifecycle(sdk: FacebookInstantSdk): LifecycleCapability {
  /** Removing one view listener must not retire presence or checkpoint draining. */
  const pauseListeners = new Set<() => void | Promise<void>>();
  /** Native resume may serve presence and storage recovery simultaneously. */
  const resumeListeners = new Set<() => void | Promise<void>>();
  /** Native APIs expose registration without an unsubscribe operation. */
  let pauseRegistered = false, resumeRegistered = false;
  /** Browser fallback can be removed when its last subscriber retires. */
  let stopFallback: (() => void) | undefined;
  /** A failing consumer cannot block or reject another consumer's lifecycle delivery. */
  const deliver = (listeners: Set<() => void | Promise<void>>) => {
    for (const listener of [...listeners]) {
      try {void Promise.resolve(listener()).catch(() => undefined);} catch { /* Other owners still receive the signal. */ }
    }
  };
  return {
    /** Each pause subscriber receives its own retirement function. */
    onPause(callback) {
      pauseListeners.add(callback);
      if (!pauseRegistered) {pauseRegistered = true; sdk.onPause(() => deliver(pauseListeners));}
      return () => {pauseListeners.delete(callback);};
    },
    /** Presence and save recovery share one native or browser resume source. */
    onResume(callback) {
      resumeListeners.add(callback);
      if (sdk.onResume) {
        if (!resumeRegistered) {resumeRegistered = true; sdk.onResume(() => deliver(resumeListeners));}
      } else if (!stopFallback) {
        /** Provider fallback resumes only a visible game. */
        const visible = () => {if (document.visibilityState === "visible") deliver(resumeListeners);};
        document.addEventListener("visibilitychange", visible);
        stopFallback = () => document.removeEventListener("visibilitychange", visible);
      }
      return () => {
        resumeListeners.delete(callback);
        if (resumeListeners.size === 0) {stopFallback?.(); stopFallback = undefined;}
      };
    },
  };
}
