import {getFrameDeltaSeconds} from "../solarMotion";

/** Display-refresh jitter allowed before a capped frame is deferred to the next vsync. */
const FRAME_INTERVAL_TOLERANCE_MS = 4;

/** Owns one frame chain; inactive decorations consume no animation callbacks. */
export function createDecorativeAnimation({canRender, render, onError, frameIntervalMs = 0}: {
  /** Layout, host pause and graphics context must all permit drawing. */
  canRender: () => boolean;
  /** Minimum time between drawn frames; zero draws on every display refresh. */
  frameIntervalMs?: number;
  /** Advances only by active time, using the game's existing delta clamp. */
  render: (deltaSeconds: number) => void;
  /** Retires an optional scene after an asynchronous drawing failure. */
  onError: (error: unknown) => void;
}) {
  /** Retirement flag guarding retained browser callbacks. */
  let disposed = false;
  /** The single pending request handle; zero remains a valid handle. */
  let frame: number | null = null;
  /** Previous active timestamp, cleared while suspended. */
  let previousFrameAt: number | null = null;
  /** Timestamp of the last drawn frame, used by the frame-rate cap; cleared while suspended. */
  let lastRenderAt: number | null = null;
  /** Ownership version invalidating callbacks cancelled before resume. */
  let generation = 0;

  /** Invalidates callbacks retained by a cancelled request, including across resume. */
  const stop = () => {
    generation++;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    previousFrameAt = null;
    lastRenderAt = null;
  };

  /** Removes the visibility subscription as well as its pending work. */
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stop();
    document.removeEventListener("visibilitychange", refresh);
  };

  /** Rechecks eligibility without introducing a second animation chain. */
  function refresh() {
    if (disposed) return;
    if (document.hidden || !canRender()) {
      stop();
      return;
    }
    if (frame !== null) return;
    previousFrameAt ??= performance.now();
    /** Version captured by this request so a retained callback cannot resume an old chain. */
    const ownedGeneration = generation;
    frame = window.requestAnimationFrame(() => {
      if (disposed || ownedGeneration !== generation) return;
      frame = null;
      if (document.hidden || !canRender()) {
        stop();
        return;
      }
      /** Current monotonic timestamp for this active frame. */
      const frameAt = performance.now();
      if (lastRenderAt !== null && frameAt - lastRenderAt < frameIntervalMs - FRAME_INTERVAL_TOLERANCE_MS) {
        // Skip GPU work on this refresh; active time keeps accruing until the next drawn frame.
        refresh();
        return;
      }
      /** Clamped active time passed to the existing scene motion functions. */
      const deltaSeconds = getFrameDeltaSeconds(frameAt, previousFrameAt ?? frameAt);
      previousFrameAt = frameAt;
      lastRenderAt = frameAt;
      try {
        render(deltaSeconds);
      } catch (error) {
        dispose();
        // Diagnostics or scene cleanup must not escape an animation callback.
        try { onError(error); } catch { /* The failed scene is already retired. */ }
        return;
      }
      if (ownedGeneration === generation) refresh();
    });
  }

  document.addEventListener("visibilitychange", refresh);
  refresh();
  return {refresh, dispose};
}
