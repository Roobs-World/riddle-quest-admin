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
import {isFacebookFirebaseUid} from "../facebook/facebookSecurity";
import {isRedditFirebaseUid} from "../reddit/redditSecurity";

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
export function evaluateRaceRollout(
  configInput: unknown,
  userId: string,
  locale: RaceLocale = "en",
): RaceAccessResponse {
  /** Provides config behavior. */
  const config = RaceRolloutConfigSchema.catch(DEFAULT_CONFIG).parse(configInput);
  if (!config.enabled) return {enabled: false, locale, reason: "rollout_disabled"};
  /** Provides hash behavior. */
  const hash = hashRaceCohortUser(userId);
  /** Provides bucket behavior. */
  const bucket = Number.parseInt(hash.slice(0, 8), 16) / 0x1_0000_0000;
  /** Provides enabled behavior. */
  const enabled = config.allowlistHashes.includes(hash) || bucket * 100 < config.percentage;
  return RaceAccessResponseSchema.parse({
    enabled,
    locale,
    reason: enabled ? "enabled" : "not_in_cohort",
  });
}

/** Loads and evaluates authoritative multiplayer access for a player. */
export async function getRaceAccessForUser(
  userId: string,
  locale: RaceLocale,
  dbInput?: Firestore,
): Promise<RaceAccessResponse> {
  if (locale !== "en" && !isFacebookFirebaseUid(userId) && !isRedditFirebaseUid(userId)) {
    return {enabled: false, locale, reason: "rollout_disabled"};
  }
  /** Provides db behavior. */
  const db = dbInput ?? admin.firestore();
  /** Provides snapshot behavior. */
  const snapshot = await db.doc("raceConfig/rollout").get();
  return evaluateRaceRollout(snapshot.exists ? snapshot.data() : DEFAULT_CONFIG, userId, locale);
}

/** Throws unless the player currently belongs to the enabled race cohort. */
export async function assertRaceAccess(userId: string, locale: RaceLocale = "en", dbInput?: Firestore): Promise<void> {
  /** Provides access behavior. */
  const access = await getRaceAccessForUser(userId, locale, dbInput);
  if (!access.enabled) throw new HttpsError("permission-denied", "Race to 10 is not enabled for this player.");
}

/** Records one allowlisted, idempotent multiplayer analytics event. */
export async function recordRaceAnalyticsForUser(
  userId: string,
  input: RaceAnalyticsEventRequest,
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<{
  /** Stores accepted. */
  accepted: true;
}> {
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  await assertRaceAccess(userId, "en", db);
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Provides allowed behavior. */
  const allowed = new Set<string>(RACE_ANALYTICS_FIELDS[input.eventName]);
  /** Provides params behavior. */
  const params = Object.fromEntries(Object.entries(input.params).filter(([key]) => allowed.has(key)));
  /** Provides document id behavior. */
  const documentId = createHash("sha256").update(`${userId}\u0000${input.eventId}`).digest("hex");
  /** Provides reference behavior. */
  const reference = db.collection("raceAnalytics").doc(documentId);
  try {
    await reference.create({
      eventName: input.eventName,
      params,
      cohortUserHash: hashRaceCohortUser(userId),
      createdAtMs: nowMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + ANALYTICS_RETENTION_MS),
    });
  } catch (error) {
    // Firestore's atomic create keeps concurrent/replayed receipts idempotent.
    // All other failures must remain visible to the caller for retry.
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 6)) throw error;
  }
  return RaceAnalyticsEventResponseSchema.parse({accepted: true});
}
