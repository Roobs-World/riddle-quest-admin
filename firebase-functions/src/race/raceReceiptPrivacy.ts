import {admin} from "../shared/firebaseAdmin";
import type {RaceRunRecord} from "./raceEngine";

/** Neutral opponent projection persisted in idempotency receipts. */
const PRIVATE_RECEIPT_OPPONENT_NAME = "Riddle Quest player";

/** Returns an object value without trusting its prototype or fields. */
const objectValue = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;

/** Copies a response while transforming its optional run/opponent projection. */
function mapResponseOpponent<T>(
  response: T,
  transform: (opponent: Record<string, unknown>) => Record<string, unknown>,
): T {
  const responseObject = objectValue(response);
  const run = objectValue(responseObject?.run);
  const opponent = objectValue(run?.opponent);
  if (!responseObject || !run || !opponent) return response;
  return {...responseObject, run: {...run, opponent: transform(opponent)}} as T;
}

/** Removes copied opponent identity before an idempotency response is stored. */
export function minimizeRaceReceiptResponse<T>(response: T): T {
  return mapResponseOpponent(response, (opponent) => {
    const minimized: Record<string, unknown> = {...opponent, displayName: PRIVATE_RECEIPT_OPPONENT_NAME};
    delete minimized.avatarUrl;
    return minimized;
  });
}

/** Restores only the parent's current privacy-safe opponent projection on replay. */
export function hydrateRaceReceiptResponse<T>(response: T, run: RaceRunRecord): T {
  const currentOpponent = run.opponent;
  if (!currentOpponent?.subjectUserId) return minimizeRaceReceiptResponse(response);
  return mapResponseOpponent(response, (opponent) => {
    const hydrated: Record<string, unknown> = {...opponent, displayName: currentOpponent.displayName};
    delete hydrated.avatarUrl;
    if (currentOpponent.avatarUrl) hydrated.avatarUrl = currentOpponent.avatarUrl;
    return hydrated;
  });
}

/** Extracts a finite timestamp-like value without trusting arbitrary data. */
const timestampMilliseconds = (value: unknown): number | undefined => {
  if (typeof value !== "object" || value === null || !("toMillis" in value)) return undefined;
  const toMillis = (value as {toMillis?: unknown}).toMillis;
  if (typeof toMillis !== "function") return undefined;
  const milliseconds = toMillis.call(value) as unknown;
  return typeof milliseconds === "number" && Number.isFinite(milliseconds) ? milliseconds : undefined;
};

/** Caps a nested receipt's TTL to its parent run's persisted expiry. */
export function raceReceiptExpiresAt(parentExpiresAt: unknown, fallbackExpiresAtMs: number) {
  const parentExpiresAtMs = timestampMilliseconds(parentExpiresAt);
  return admin.firestore.Timestamp.fromMillis(
    parentExpiresAtMs === undefined ? fallbackExpiresAtMs : Math.min(parentExpiresAtMs, fallbackExpiresAtMs),
  );
}
