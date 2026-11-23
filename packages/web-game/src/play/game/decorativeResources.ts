/** Minimum ownership contract for one graphics allocation. */
type DecorativeResource = {
  /** Releases this resource's graphics allocation. */
  dispose: () => void;
};

/** Releases partially constructed decorations and continues through individual cleanup failures. */
export function createDecorativeResources(onError: (error: unknown) => void) {
  /** Deduplicates shared resources without retaining them after cleanup. */
  const owned = new WeakSet<object>();
  /** Cleanup runs in reverse acquisition order, before the renderer and context are released. */
  const callbacks: Array<() => void> = [];
  /** Retirement prevents late acquisitions from extending the decoration's lifetime. */
  let disposed = false;
  /** Reports at most one cleanup failure for this resource owner. */
  let reported = false;

  /** One broken driver or diagnostic callback cannot interrupt the remaining cleanup. */
  const release = (callback: () => void) => {
    try { callback(); } catch (error) {
      if (reported) return;
      reported = true;
      try { onError(error); } catch { /* Cleanup must complete even when reporting fails. */ }
    }
  };
  /** Registers a subscription or DOM cleanup, including acquisitions after retirement. */
  const defer = (callback: () => void) => {
    if (disposed) release(callback);
    else callbacks.push(callback);
  };
  /** Owns a graphics allocation before later constructors or setup operations can fail. */
  const own = <T extends DecorativeResource>(resource: T): T => {
    if (!owned.has(resource)) {
      owned.add(resource);
      defer(() => resource.dispose());
    }
    return resource;
  };
  /** Idempotently releases all allocations, subscriptions and attached DOM. */
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    while (callbacks.length) release(callbacks.pop()!);
  };
  return {own, defer, dispose};
}
