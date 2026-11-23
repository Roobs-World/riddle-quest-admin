/** Duration for which the final “Go” state remains visible. */
export const RACE_GO_DISPLAY_MS = 180;

/** Anchors server time to a monotonic receipt clock, independent of local wall-clock skew. */
export const estimatedRaceServerNow = (serverNowMs: number, receivedAtMs: number, monotonicNowMs: number): number =>
  serverNowMs + Math.max(0, monotonicNowMs - receivedAtMs);

/** Displays the remaining numbered countdown from the authoritative scheduled start. */
export const scheduledRaceCountdown = (startsAtMs: number, serverNowMs: number): number =>
  Math.max(0, Math.ceil((startsAtMs - serverNowMs) / 1_000));

/** Advances visible preparation without claiming completion before the deck is validated. */
export const advanceRaceLoadingProgress = (current: number, dataReady: boolean): number =>
  dataReady ? 100 : Math.min(90, Math.max(0, current) + 5);

/** Waiting invitations use bounded exponential backoff and jitter between authority reads. */
export const nextRaceEntryPollAt = (attempt: number, now: number, random: () => number): number => {
  /** At most thirty seconds between refreshes before the bounded jitter is applied. */
  const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
  return now + Math.min(30000, delay * (0.8 + Math.max(0, Math.min(1, random())) * 0.4));
};
