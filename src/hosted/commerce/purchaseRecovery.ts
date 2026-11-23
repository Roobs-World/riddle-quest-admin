/** Coalesces store updates and foreground recovery for one account lifetime. */
export function createPurchaseRecovery(options: {
  /** Reconciles owned purchases with the authoritative backend. */
  restore: () => Promise<unknown>;
  /** Refreshes only the account that started this recovery. */
  onRecovered: () => Promise<unknown>;
}): {
/** Stores request. */
request: () => Promise<void>;
/** Stores dispose. */
dispose: () => void} {
  /** Retains disposed for this operation. */
  let disposed = false;
  /** Retains requested for this operation. */
  let requested = false;
  /** Retains running for this operation. */
  let running: Promise<void> | null = null;
  /** Retains drain for this operation. */
  const drain = async (): Promise<void> => {
    while (requested && !disposed) {
      requested = false;
      try {
        await options.restore();
        if (!disposed) await options.onRecovered();
      } catch {
        // Owned purchases remain recoverable on the next store or foreground signal.
      }
    }
  };
  return {
    /** Retains request for this operation. */
    request() {
      if (disposed) return Promise.resolve();
      requested = true;
      running ??= Promise.resolve().then(drain).finally(() => { running = null; });
      return running;
    },
    /** Retains dispose for this operation. */
    dispose() { disposed = true; requested = false; },
  };
}
