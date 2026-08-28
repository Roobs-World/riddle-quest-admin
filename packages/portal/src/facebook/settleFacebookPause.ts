/** Describes facebook pause failure. */
export type FacebookPauseFailure = Readonly<{
  /** Stores operation. */
  operation: "flush_storage" | "stop_presence";
  /** Stores error. */
  error: unknown;
}>;

/**
 * Runs both suspension-critical operations even if either one fails.
 * Pause hooks must not leak a rejected promise back into the host SDK.
 */
export async function settleFacebookPause({
  flushStorage,
  stopPresence,
  reportFailure,
}: {
  /** Stores flush storage. */
  flushStorage: () => Promise<void>;
  /** Stores stop presence. */
  stopPresence?: () => Promise<void>;
  /** Stores report failure. */
  reportFailure: (failure: FacebookPauseFailure) => void;
}): Promise<void> {
  /** Provides operations behavior. */
  const operations = [
    {operation: "flush_storage" as const, run: flushStorage},
    ...(stopPresence ? [{operation: "stop_presence" as const, run: stopPresence}] : []),
  ];
  /** Provides results behavior. */
  const results = await Promise.allSettled(operations.map(({run}) => run()));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      reportFailure({operation: operations[index]!.operation, error: result.reason});
    }
  });
}

/** Keeps a reconnect failure recoverable instead of rejecting the host visibility callback. */
export async function settleFacebookPresenceResume({
  enabled,
  startPresence,
  reportFailure,
}: {
  /** Stores enabled. */
  enabled: boolean;
  /** Stores start presence. */
  startPresence: () => Promise<void>;
  /** Stores report failure. */
  reportFailure: (error: unknown) => void;
}): Promise<void> {
  if (!enabled) return;
  try {
    await startPresence();
  } catch (error) {
    reportFailure(error);
  }
}
