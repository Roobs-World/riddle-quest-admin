import {z} from "zod";
import {RaceLocaleSchema, type RaceLocale} from "../../../../../src/races/contracts/index";
import {parseFacebookTournamentPayload} from "../social/facebookTournamentPayload";

const pointsEnvelope = z.object({kind: z.literal("rq-race10-points-v1"), locale: RaceLocaleSchema}).strict();
const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._:-]{1,256}$/u.test(value);

export type FacebookPrivatePointsTournament = Readonly<{id: string; contextId: string}>;

/** Only this versioned envelope uses higher-is-better race points, never official race time. */
export const facebookPrivatePointsPayload = (locale: RaceLocale) => ({kind: "rq-race10-points-v1", locale});

/** Metadata proves compatibility only while the configured, locale-matched tournament is live. */
export function readFacebookPrivatePointsTournament(value: unknown, locale: RaceLocale, now: number): FacebookPrivatePointsTournament | null {
  try {
    if (!value || typeof value !== "object" ||
      !("getTournamentType" in value) || typeof value.getTournamentType !== "function" || value.getTournamentType() !== "PRIVATE" ||
      !("getPayload" in value) || typeof value.getPayload !== "function" ||
      !("getID" in value) || typeof value.getID !== "function" ||
      !("getContextID" in value) || typeof value.getContextID !== "function" ||
      !("getEndTime" in value) || typeof value.getEndTime !== "function") return null;
    const payload = pointsEnvelope.safeParse(parseFacebookTournamentPayload(value.getPayload()));
    if (!payload.success || payload.data.locale !== locale) return null;
    const id: unknown = value.getID(), contextId: unknown = value.getContextID(), seconds: unknown = value.getEndTime();
    if (!validId(id) || !validId(contextId) || !Number.isSafeInteger(now) || now < 0 || typeof seconds !== "number" ||
      !Number.isSafeInteger(seconds * 1000) || seconds * 1000 <= now) return null;
    return {id, contextId};
  } catch {return null;}
}

/** Inspect rejection codes without trusting the shape of a native SDK error. */
export function facebookSdkErrorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
}

/** These two documented access failures disable creation for the rest of this account session. */
export function privateTournamentAccessDenied(error: unknown): boolean {
  return facebookSdkErrorCode(error) === "INVALID_OPERATION" && typeof error === "object" && error !== null &&
    "message" in error && (error.message === "This game is not enabled for private tournament creation." ||
      error.message === "Private tournament creation is not available for this player.");
}
