/** Defers optional resource construction until the host and document permit it. */
export function createDecorativeInitialization({canInitialize, initialize, onError}: {
  /** Reads the current host pause rather than capturing the initial render. */
  canInitialize: () => boolean;
  /** Constructs the scene exactly once; later pauses retain the existing resources. */
  initialize: () => void;
  /** Contains construction failures without escaping a visibility callback. */
  onError: (error: unknown) => void;
}) {
  /** Retired callbacks cannot construct a scene after unmount or setup failure. */
  let disposed = false;
  /** Set before construction to guard reentrant refresh and repeated resumes. */
  let started = false;

  /** Removes the pending visibility subscription and invalidates retained callbacks. */
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener("visibilitychange", refresh);
  };

  /** Host resume and visibility changes share the same one-time initialization gate. */
  function refresh() {
    if (disposed || started || document.hidden) return;
    try {
      if (!canInitialize()) return;
      started = true;
      document.removeEventListener("visibilitychange", refresh);
      initialize();
    } catch (error) {
      dispose();
      try { onError(error); } catch { /* Optional diagnostics cannot interrupt gameplay. */ }
    }
  }

  document.addEventListener("visibilitychange", refresh);
  refresh();
  return {refresh, dispose};
}
