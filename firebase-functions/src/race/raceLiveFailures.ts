import {HttpsError} from "firebase-functions/v2/https";

/** Serializes only trusted error categories, without answers, identities or exception details. */
export function liveRaceGatewayFailure(error: unknown) {
  /** Public HTTP categories have the same meaning as the authenticated callable rejection. */
  const statuses: Record<string, number> = {"invalid-argument": 400, "failed-precondition": 409,
    "not-found": 404, "permission-denied": 403, "unauthenticated": 401, "resource-exhausted": 429};
  /** Unrecognized failures retain uncertain delivery and remain retryable. */
  const code = error instanceof HttpsError && Object.hasOwn(statuses, error.code) ? error.code : "unavailable";
  return {status: statuses[code] ?? 503, body: {error: "live-race-request-failed", code}};
}
