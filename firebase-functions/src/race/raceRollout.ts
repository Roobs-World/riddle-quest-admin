import {admin} from "../shared/firebaseAdmin";
import {createHash} from "node:crypto";
import {
  RACE_ANALYTICS_FIELDS,
  RaceAccessResponseSchema,
  RaceAnalyticsEventResponseSchema,
  type RaceAccessResponse,
  type RaceAnalyticsEventRequest,
  type RaceLocale,
} from "@riddle-quest/core/race";
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
  return evaluateRaceRollout(await readRolloutConfig(db), userId, locale);
}

/**
 * Seconds-scale reuse of the rollout document on a warm instance.
 *
 * Every live-race poll and command is gated by this read, so caching it removes
 * a serial Firestore round trip and one billed read per call. A disabled or
 * narrowed rollout therefore reaches warm instances within this bound; run
 * mutations still evaluate the document inside their own transactions.
 */
export const RACE_ROLLOUT_CACHE_TTL_MS = 15_000;
/** Cache lifetime; emulator and unit-test processes read through so fixtures stay deterministic. */
let rolloutCacheTtlMs = process.env.FUNCTIONS_EMULATOR === "true" || process.env.JEST_WORKER_ID !== undefined
  ? 0 : RACE_ROLLOUT_CACHE_TTL_MS;
/** Clock seam for cache expiry tests. */
let rolloutCacheNow: () => number = Date.now;
/** Pending or settled rollout reads shared by concurrent callers of the same database. */
let rolloutCache = new WeakMap<Firestore, {
  /** Monotonic expiry of this entry. */ expiresAtMs: number;
  /** Shared read; rejected reads are evicted. */ config: Promise<unknown>}>();

/** Overrides the rollout cache policy; intended for tests and operational tooling. */
export function configureRaceRolloutCache(options: {
  /** Entry lifetime; zero disables caching. */ ttlMs: number;
  /** Optional clock. */ now?: () => number}): void {
  rolloutCacheTtlMs = Math.max(0, options.ttlMs);
  rolloutCacheNow = options.now ?? Date.now;
  rolloutCache = new WeakMap();
}

/** Reads raw rollout configuration, coalescing and briefly retaining it per database. */
function readRolloutConfig(db: Firestore): Promise<unknown> {
  /** Uncached read used when caching is disabled or expired. */
  const read = () => db.doc("raceConfig/rollout").get().then(snapshot => snapshot.exists ? snapshot.data() : DEFAULT_CONFIG);
  if (rolloutCacheTtlMs <= 0) return read();
  /** Current time for this lookup. */
  const now = rolloutCacheNow();
  /** Existing entry for this database. */
  const cached = rolloutCache.get(db);
  if (cached && cached.expiresAtMs > now) return cached.config;
  /** Shared read for this window. */
  const config = read();
  /** Entry published before the read settles so concurrent callers coalesce. */
  const entry = {expiresAtMs: now + rolloutCacheTtlMs, config};
  rolloutCache.set(db, entry);
  config.catch(() => {
    if (rolloutCache.get(db) === entry) rolloutCache.delete(db);
  });
  return config;
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
