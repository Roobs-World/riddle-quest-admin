/** Applies one persisted presence preference to the local session and account-wide server state. */
export async function reconcilePresenceOptIn({
  enabled,
  canStart,
  start,
  stop,
  setConsent,
}: {
  enabled: boolean;
  canStart: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
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
