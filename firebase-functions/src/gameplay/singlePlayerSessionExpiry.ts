import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import type {SinglePlayerSessionState} from "./singlePlayerSessionTypes";

/** Logical lifetime of private answer-bearing single-player state. */
export const SINGLE_PLAYER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

/** Builds the fixed Firestore TTL value used when private session state is issued. */
export const sessionExpiry = () => admin.firestore.Timestamp.fromMillis(Date.now() + SINGLE_PLAYER_SESSION_TTL_MS);

/** Returns whether a stored session is missing a trusted future expiry. */
export function isSinglePlayerSessionExpired(
  state: Pick<SinglePlayerSessionState, "expiresAt">,
  now = new Date(),
): boolean {
  /** Provides expires at behavior. */
  const expiresAt = state.expiresAt;
  if (!expiresAt || typeof expiresAt.toDate !== "function") return true;
  /** Provides expiry behavior. */
  const expiry = expiresAt.toDate();
  return !(expiry instanceof Date) || Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

/** Fails closed before an expired private session can be read, replayed, or extended. */
export function assertSinglePlayerSessionActive(
  state: Pick<SinglePlayerSessionState, "expiresAt">,
  now = new Date(),
): void {
  if (isSinglePlayerSessionExpired(state, now)) {
    throw new HttpsError("failed-precondition", "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE");
  }
}
