/**
 * Starts an opted-in presence session without allowing optional RTDB failures to
 * abort core game startup or prevent a later visibility/reconnect retry.
 */
export async function startOptionalPresence({
  enabled,
  canStart,
  start,
  reportFailure,
}: {
  /** Stores enabled. */
  enabled: boolean;
  /** Stores can start. */
  canStart: boolean;
  /** Stores start. */
  start: () => Promise<void>;
  /** Stores report failure. */
  reportFailure: (error: unknown) => void;
}): Promise<boolean> {
  if (!enabled || !canStart) return false;
  try {
    await start();
    return true;
  } catch (error) {
    reportFailure(error);
    return false;
  }
}
