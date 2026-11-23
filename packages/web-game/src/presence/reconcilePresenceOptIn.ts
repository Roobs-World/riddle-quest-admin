/** Applies one persisted presence preference to the local session and account-wide server state. */
export async function reconcilePresenceOptIn({
  enabled,
  canStart,
  start,
  stop,
  setConsent,
}: {
  /** Stores enabled. */
  enabled: boolean;
  /** Stores can start. */
  canStart: boolean;
  /** Stores start. */
  start: () => Promise<void>;
  /** Stores stop. */
  stop: () => Promise<void>;
  /** Stores set consent. */
  setConsent: (enabled: boolean) => Promise<void>;
}): Promise<void> {
  if (enabled) {
    await setConsent(true);
    if (canStart) await start();
    return;
  }
  await stop();
  await setConsent(false);
}
