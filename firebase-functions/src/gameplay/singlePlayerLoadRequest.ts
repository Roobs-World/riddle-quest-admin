import {HttpsError} from "firebase-functions/v2/https";

/** Maximum accepted Classic entitlement index in a direct load request. */
export const MAX_CLASSIC_LOAD_INDEX = 1_000_000;

/** Parses the optional opaque session/riddle pair used for reload recovery. */
export function parseSinglePlayerResumeFields(
  data: {sessionToken?: unknown; riddleId?: unknown} | undefined,
): {sessionToken: string; riddleId: string} | undefined {
  const sessionToken = data?.sessionToken;
  const riddleId = data?.riddleId;
  if (sessionToken === undefined && riddleId === undefined) return undefined;
  if (
    typeof sessionToken !== "string" || sessionToken.length < 20 || sessionToken.length > 128 ||
    typeof riddleId !== "string" || riddleId.length < 1 || riddleId.length > 160
  ) {
    throw new HttpsError("invalid-argument", "A valid resume token and riddle id must be supplied together.");
  }
  return {sessionToken, riddleId};
}

/** Parses a bounded non-negative Classic load index. */
export function parseClassicLoadIndex(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_CLASSIC_LOAD_INDEX) {
    throw new HttpsError("invalid-argument", "A bounded non-negative classicIndex is required.");
  }
  return value as number;
}
