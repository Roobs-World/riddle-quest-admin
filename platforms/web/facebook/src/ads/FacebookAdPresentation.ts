import type {LifecycleCapability} from "../../../../../src/platform/contracts/capabilities";

/** Pending ads belong to one uninterrupted foreground visit, independently of account ownership. */
export function createFacebookAdPresentation(lifecycle: LifecycleCapability | undefined) {
  let paused = false;
  let retired = false;
  let revision = 0;
  const stopPause = lifecycle?.onPause(() => {paused = true; revision++;});
  const stopResume = lifecycle?.onResume?.(() => {paused = false;});
  const visibilityChanged = () => {if (document.visibilityState !== "visible") revision++;};
  document.addEventListener("visibilitychange", visibilityChanged);
  return {
    capture() {
      const ownerRevision = revision;
      return () => !retired && !paused && document.visibilityState === "visible" && revision === ownerRevision;
    },
    retire() {
      retired = true;
      stopPause?.();
      stopResume?.();
      document.removeEventListener("visibilitychange", visibilityChanged);
    },
  };
}
