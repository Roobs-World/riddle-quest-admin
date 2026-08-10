import {admin} from "../shared/firebaseAdmin";
import {createHash} from "node:crypto";
import {
  RACE_ANALYTICS_FIELDS,
  RaceAccessResponseSchema,
  RaceAnalyticsEventResponseSchema,
  type RaceAccessResponse,
  type RaceAnalyticsEventRequest,
  type RaceLocale,
} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";

/** Describes firestore. */
type Firestore = FirebaseFirestore.Firestore;

/** Validates the race rollout config data shape. */
const RaceRolloutConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    percentage: z.number().min(0).max(100).default(0),
    allowlistHashes: z
      .array(z.string().regex(/^[a-f0-9]{64}$/))
      .max(500)
      .default([]),
  })
  .strict();

/** Validated configuration controlling multiplayer cohort access. */
export type RaceRolloutConfig = z.infer<typeof RaceRolloutConfigSchema>;
/** Defines the default config value. */
const DEFAULT_CONFIG: RaceRolloutConfig = {enabled: false, percentage: 0, allowlistHashes: []};
/** Defines the analytics retention ms value. */
const ANALYTICS_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

/** Hashes a player identifier into the stable, non-reversible rollout key. */
export const hashRaceCohortUser = (userId: string): string =>
  createHash("sha256").update(`riddle-quest-race-cohort-v1:${userId}`).digest("hex");

/** Evaluates rollout configuration for a stable player cohort. */
export function evaluateRaceRollout(configInput: unknown, userId: string): RaceAccessResponse {
  const config = RaceRolloutConfigSchema.catch(DEFAULT_CONFIG).parse(configInput);
  if (!config.enabled) return {enabled: false, locale: "en", reason: "rollout_disabled"};
  const hash = hashRaceCohortUser(userId);
  const bucket = Number.parseInt(hash.slice(0, 8), 16) / 0x1_0000_0000;
  const enabled = config.allowlistHashes.includes(hash) || bucket * 100 < config.percentage;
  return RaceAccessResponseSchema.parse({
    enabled,
    locale: "en",
    reason: enabled ? "enabled" : "not_in_cohort",
  });
}

/** Loads and evaluates authoritative multiplayer access for a player. */
export async function getRaceAccessForUser(
  userId: string,
  locale: RaceLocale,
  dbInput?: Firestore,
): Promise<RaceAccessResponse> {
  if (locale !== "en") return {enabled: false, locale: "en", reason: "rollout_disabled"};
  const db = dbInput ?? admin.firestore();
  const snapshot = await db.doc("raceConfig/rollout").get();
  return evaluateRaceRollout(snapshot.exists ? snapshot.data() : DEFAULT_CONFIG, userId);
}

/** Throws unless the player currently belongs to the enabled race cohort. */
export async function assertRaceAccess(userId: string, locale: RaceLocale = "en", dbInput?: Firestore): Promise<void> {
  const access = await getRaceAccessForUser(userId, locale, dbInput);
  if (!access.enabled) throw new HttpsError("permission-denied", "Race to 10 is not enabled for this player.");
}

/** Records one allowlisted, idempotent multiplayer analytics event. */
export async function recordRaceAnalyticsForUser(
  userId: string,
  input: RaceAnalyticsEventRequest,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<{accepted: true}> {
  const db = options.db ?? admin.firestore();
  await assertRaceAccess(userId, "en", db);
  const nowMs = options.nowMs ?? Date.now();
  const allowed = new Set<string>(RACE_ANALYTICS_FIELDS[input.eventName]);
  const params = Object.fromEntries(Object.entries(input.params).filter(([key]) => allowed.has(key)));
  const documentId = createHash("sha256").update(`${userId}\u0000${input.eventId}`).digest("hex");
  const reference = db.collection("raceAnalytics").doc(documentId);
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(reference)).exists) return;
    transaction.create(reference, {
      eventName: input.eventName,
      params,
      cohortUserHash: hashRaceCohortUser(userId),
      createdAtMs: nowMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + ANALYTICS_RETENTION_MS),
    });
  });
  return RaceAnalyticsEventResponseSchema.parse({accepted: true});
}
