/** Rounded dimensions shared by a staged measurement and the successfully applied buffer. */
type DecorativeDimensions = {
  /** Positive integer width in CSS pixels. */
  width: number;
  /** Positive integer height in CSS pixels. */
  height: number;
};

/** Owns the latest usable size without resetting an inactive or unchanged drawing buffer. */
export function createDecorativeSizing({canResize, apply, onError}: {
  /** Reads current host, layout and context eligibility. */
  canResize: () => boolean;
  /** Applies integer CSS dimensions before the next eligible frame. */
  apply: (width: number, height: number) => void;
  /** Retires failed optional sizing without interrupting gameplay. */
  onError: (error: unknown) => void;
}) {
  /** Latest effective dimensions; a collapse blocks an older pending size. */
  let latest: DecorativeDimensions | null = null;
  /** Successfully applied dimensions remain valid across a temporary collapse. */
  let applied: DecorativeDimensions | null = null;
  /** Retained observer, visibility and host callbacks cannot resize retired graphics. */
  let disposed = false;

  /** Stores the newest measurement without performing graphics work. */
  const update = (width: number, height: number) => {
    if (disposed) return;
    latest = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ?
      {width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height))} : null;
  };
  /** Releases measurements and the visibility subscription on retirement. */
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    latest = applied = null;
    document.removeEventListener("visibilitychange", refresh);
  };
  /** Applies one latest changed size when the scene can use its buffer. */
  function refresh() {
    if (disposed || !latest || document.hidden) return;
    try {
      if (!canResize() || (applied?.width === latest.width && applied.height === latest.height)) return;
      /** Snapshot this measurement in case applying it synchronously stages a newer one. */
      const current = latest;
      apply(current.width, current.height);
      if (!disposed) applied = current;
    } catch (error) {
      dispose();
      try { onError(error); } catch { /* Optional diagnostics cannot interrupt gameplay. */ }
    }
  }
  document.addEventListener("visibilitychange", refresh);
  return {update, refresh, dispose};
}
