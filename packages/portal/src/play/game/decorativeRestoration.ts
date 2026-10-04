/** Defers this scene's driver restoration until it can use the restored context. */
export function createDecorativeRestoration({canvas, canRestore, onError}: {
  /** Owned canvas whose capture gate runs before its driver callbacks. */
  canvas: HTMLCanvasElement;
  /** Reads current layout, host pause and document eligibility. */
  canRestore: () => boolean;
  /** Contains failures in the eligibility check or replay dispatch. */
  onError: (error: unknown) => void;
}) {
  /** A repeated blocked restore represents the same pending driver rebuild. */
  let pending = false;
  /** Retired callbacks cannot dispatch into an old renderer. */
  let disposed = false;

  /** Drops deferred work and all native subscriptions before graphics cleanup. */
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    pending = false;
    canvas.removeEventListener("webglcontextrestored", restored, true);
    canvas.removeEventListener("webglcontextlost", lost, true);
    document.removeEventListener("visibilitychange", refresh);
  };
  /** Delays the driver and scene callbacks together, preserving their dispatch order. */
  function restored(event: Event) {
    if (disposed) return;
    if (document.hidden || !canRestore()) {
      pending = true;
      event.stopImmediatePropagation();
    }
  }
  /** A later loss invalidates an earlier deferred restoration. */
  function lost() { pending = false; }
  /** Replays one restoration only after the actual browser has restored the context. */
  function refresh() {
    if (disposed || !pending || document.hidden) return;
    try {
      if (!canRestore()) return;
      pending = false;
      // Three ignores the event payload; the canvas target and callback order stay native.
      canvas.dispatchEvent(new Event("webglcontextrestored"));
    } catch (error) {
      dispose();
      try { onError(error); } catch { /* Optional diagnostics cannot interrupt gameplay. */ }
    }
  }
  canvas.addEventListener("webglcontextrestored", restored, true);
  canvas.addEventListener("webglcontextlost", lost, true);
  document.addEventListener("visibilitychange", refresh);
  return {refresh, dispose};
}
