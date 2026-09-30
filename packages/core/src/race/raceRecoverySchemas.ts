import {z} from "zod";
import {RaceLocaleSchema, RaceMatchRequestSchema, StartRaceRunRequestSchema} from "./raceSchemas";
import {RaceMatchFailureSchema} from "./raceMatchFailure";

/** One minimal recovery hint is retained; it contains no answers, scores or player input. */
export const RACE_RECOVERY_KEY = "riddleQuest:raceRecovery";
/** Hints have bounded local retention; authoritative expiry is always checked by the server. */
export const RACE_RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;
/** Identifiers remain opaque rather than authorization credentials. */
const Id = z.string().min(1).max(160);
/** Each journey restores through its existing authoritative operation. */
export const RaceRecoveryIntentSchema = z.discriminatedUnion("kind", [
  z.object({kind: z.literal("search"), request: RaceMatchRequestSchema.refine(request => request.requestId !== undefined), failure: RaceMatchFailureSchema.optional(), retryAtMs: z.number().int().nonnegative().optional()}).strict(),
  z.object({kind: z.literal("challenge"), challengeId: Id, offerId: z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict(),
  z.object({kind: z.literal("start"), request: StartRaceRunRequestSchema}).strict(),
]);
/** Versioned owner/language binding and compare-and-clear identity protect replacement hints. */
export const RaceRecoverySchema = z.object({version: z.literal(1), id: Id, ownerId: Id, locale: RaceLocaleSchema,
  savedAtMs: z.number().int().nonnegative(), expiresAtMs: z.number().int().nonnegative(), intent: RaceRecoveryIntentSchema}).strict();
/** No authority state is restored from this hint. */
export type RaceRecovery = z.infer<typeof RaceRecoverySchema>;
/** Minimal journey selection and original mutation receipt. */
export type RaceRecoveryIntent = RaceRecovery["intent"];
