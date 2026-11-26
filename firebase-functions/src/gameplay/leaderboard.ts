/**
 * @fileoverview Leaderboard Cloud Functions for Riddle Quest.
 *
 * Maintains a `leaderboard` collection with one document per user (keyed by
 * userId). Documents are written server-side only after a win in submitGuess.
 * Clients call `getLeaderboard` to retrieve the top players for a given stat.
 *
 * Multiplayer rankings combine canonical account totals with server-owned AI win totals.
 *
 * Leaderboard types:
 *  - "xp"          — highest cumulative XP across all modes
 *  - "totalWins"   â€” most games won
 *  - "multiplayerWins" — most server-confirmed multiplayer victories
 *  - "bestStreak"  â€” longest win streak ever achieved
 */

import {admin} from "../shared/firebaseAdmin";
import * as functions from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {captureException} from "../shared/sentry";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {
  GetLeaderboardRequest,
  GetLeaderboardRequestSchema,
  GetLeaderboardResponse,
  GetLeaderboardResponseSchema,
  LeaderboardEntry,
  LeaderboardType,
} from "../../../src/platform/contracts/requestSchemas.js";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {listRaceBotLeaderboardEntries} from "../race/settlement/raceBotLeaderboard";
import {compareLeaderboardPositions, decodeLeaderboardCursor, encodeLeaderboardCursor, LEADERBOARD_MAX_SCAN_ROWS,
  type LeaderboardCursor, type PositionedLeaderboardEntry} from "./leaderboardPagination";

/** Defines the level weight value. */
const LEVEL_WEIGHT = 1_000_000_000;
/** Defines the default username value. */
const DEFAULT_USERNAME = "Player";

/** Liveness hydration needs only current public identity rather than the full account. */
const LEADERBOARD_DISPLAY_FIELDS = ["username", "displayName", "avatarUrl"];
/** Canonical queries and transactional projection need only public identity and their score inputs. */
const LEADERBOARD_ACCOUNT_FIELDS = [...LEADERBOARD_DISPLAY_FIELDS, "stats.level", "stats.xp", "stats.totalWins", "stats.bestStreak", "stats.multiplayerWins"];

/**
 * Computes sortable progression score using level as primary rank key.
 *
 * @param level Player level.
 * @param xp Player xp.
 * @returns Composite numeric score for descending sort.
 */
function computeProgressScore(level: number, xp: number): number {
  return level * LEVEL_WEIGHT + xp;
}

/**
 * Normalizes a candidate string for stable key comparisons.
 *
 * @param value Raw value to normalize.
 * @returns Trimmed string or null when empty/invalid.
 */
function normalizeKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  /** Provides trimmed behavior. */
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Safely parses numeric leaderboard values.
 *
 * @param value Candidate numeric value.
 * @param fallback Value used when the candidate is invalid.
 * @returns Finite number.
 */
function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Converts raw leaderboard document data into a fully safe row.
 *
 * @param raw Raw Firestore payload.
 * @param fallbackUserId Firestore document id used when userId is missing.
 * @returns Sanitized leaderboard entry.
 */
function toSafeLeaderboardEntry(raw: Partial<LeaderboardEntry>, fallbackUserId: string): LeaderboardEntry {
  /** Provides r id. */
  const userId = normalizeKey(raw.userId) ?? fallbackUserId;
  /** Provides rname. */
  const username = normalizeKey(raw.username) ?? DEFAULT_USERNAME;
  /** Provides level behavior. */
  const level = Math.max(1, asFiniteNumber(raw.level, 1));
  /** Provides xp behavior. */
  const xp = Math.max(0, asFiniteNumber(raw.xp, 0));
  /** Provides total wins behavior. */
  const totalWins = Math.max(0, asFiniteNumber(raw.totalWins, 0));
  /** Provides best streak behavior. */
  const bestStreak = Math.max(0, asFiniteNumber(raw.bestStreak, 0));
  /** Updates d at. */
  const updatedAt = Math.max(0, asFiniteNumber(raw.updatedAt, 0));

  /** Provides entry behavior. */
  const entry: LeaderboardEntry = {
    userId,
    username,
    level,
    xp,
    progressScore: computeProgressScore(level, xp),
    totalWins,
    multiplayerWins: Math.max(0, Math.floor(asFiniteNumber(raw.multiplayerWins, 0))),
    bestStreak,
    updatedAt,
  };

  if (typeof raw.avatarUrl === "string" && raw.avatarUrl.trim().length > 0) {
    entry.avatarUrl = raw.avatarUrl;
  }

  return entry;
}

/** Defines the contract for user doc for leaderboard. */
const UserDocForLeaderboardSchema = z.object({
  username: z.string().optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  stats: z.object({
    level: z.number().int().positive().optional(),
    xp: z.number().int().nonnegative().optional(),
    totalWins: z.number().int().nonnegative().optional(),
    multiplayerWins: z.number().int().nonnegative().optional(),
    bestStreak: z.number().int().nonnegative().optional(),
  }).optional(),
});
type UserDocForLeaderboard = z.infer<typeof UserDocForLeaderboardSchema>;

/**
 * Converts a Firestore users/{uid} document into leaderboard row format.
 *
 * @param userId User document id (Firebase UID).
 * @param data Raw Firestore user document data.
 * @returns Leaderboard row with safe defaults.
 */
function toLeaderboardEntryFromUserDoc(userId: string, data: UserDocForLeaderboard): LeaderboardEntry {
  /** Provides level behavior. */
  const level = data.stats?.level ?? 1;
  /** Provides xp behavior. */
  const xp = data.stats?.xp ?? 0;
  /** Provides total wins behavior. */
  const totalWins = data.stats?.totalWins ?? 0;
  /** Provides best streak behavior. */
  const bestStreak = data.stats?.bestStreak ?? 0;

  /** Provides entry behavior. */
  const entry: LeaderboardEntry = {
    userId,
    username: data.username ?? data.displayName ?? "Player",
    level,
    xp,
    progressScore: computeProgressScore(level, xp),
    totalWins,
    multiplayerWins: data.stats?.multiplayerWins ?? 0,
    bestStreak,
    updatedAt: Date.now(),
  };

  if (data.avatarUrl) {
    entry.avatarUrl = data.avatarUrl;
  }

  return entry;
}

/** Raw leaderboard document paired with the canonical document identifier. */
interface LeaderboardDocument {
  /** Canonical Firebase UID used as the document ID. */
  id: string;
  /** Returns the stored server-owned leaderboard fields. */
  data(): Partial<LeaderboardEntry> & {
    /** Stores subject user id. */
    subjectUserId?: unknown;
  };
}

/**
 * Returns only canonical leaderboard rows backed by a currently live user.
 *
 * Legacy rows under another identifier, rows whose embedded subject differs,
 * and rows left after user deletion all fail closed. Name/avatar matching is
 * deliberately excluded because those fields cannot prove ownership.
 */
async function liveCanonicalLeaderboardEntries(documents: LeaderboardDocument[]): Promise<LeaderboardEntry[]> {
  /** Provides db behavior. */
  const db = admin.firestore();
  /** Provides candidates behavior. */
  const candidates = documents.flatMap((document) => {
    /** Provides data behavior. */
    const data = document.data();
    if (normalizeKey(data.userId) !== document.id) return [];
    if (data.subjectUserId !== undefined && normalizeKey(data.subjectUserId) !== document.id) return [];
    return [{entry: toSafeLeaderboardEntry(data, document.id), userRef: db.collection("users").doc(document.id)}];
  });
  if (candidates.length === 0) return [];
  /** Existing liveness reads need only public display fields, excluding economy and private profile payloads. */
  const users = await db.getAll(...candidates.map(({userRef}) => userRef), {fieldMask: LEADERBOARD_DISPLAY_FIELDS});
  return candidates.flatMap(({entry}, index) => {
    /** Identity is hydrated only after the canonical account existence and projection ownership checks. */
    const account = users[index];
    if (!account?.exists) return [];
    /** The account's current display fields supersede a stale best-effort copied profile. */
    const display = account.data();
    /** Score ordering and values retain their server-owned projection semantics. */
    const hydrated = {...entry, username: normalizeKey(display?.username) ?? normalizeKey(display?.displayName) ?? DEFAULT_USERNAME};
    delete hydrated.avatarUrl;
    /** An absent or invalid current avatar never falls back to a prior copied image. */
    const avatar = display?.avatarUrl;
    if (typeof avatar === "string" && avatar.trim().length > 0) hydrated.avatarUrl = avatar;
    return [hydrated];
  });
}

/** Fetches enough live projection rows for one page and a single lookahead. */
async function loadProjectionPage(type: LeaderboardType, limit: number, cursor?: LeaderboardCursor): Promise<PositionedLeaderboardEntry[]> {
  const field = type === "xp" ? "progressScore" : type;
  const base = admin.firestore().collection("leaderboard").orderBy(field, "desc")
    .orderBy(admin.firestore.FieldPath.documentId(), "desc");
  const rows: PositionedLeaderboardEntry[] = [];
  let lastDocument: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let scanned = 0;
  while (rows.length < limit) {
    const batchSize = Math.min(limit - rows.length, LEADERBOARD_MAX_SCAN_ROWS - scanned);
    if (batchSize === 0) throw new HttpsError("resource-exhausted", "Leaderboard cleanup limit reached. Please retry later.");
    const query = lastDocument ? base.startAfter(lastDocument) : cursor ? base.startAfter(cursor.score, cursor.userId) : base;
    const snapshot = await query.limit(batchSize).get();
    const live = new Map((await liveCanonicalLeaderboardEntries(snapshot.docs)).map(entry => [entry.userId, entry]));
    for (const document of snapshot.docs) {
      const entry = live.get(document.id);
      const score = document.data()[field];
      if (!entry || typeof score !== "number" || !Number.isFinite(score) || score < 0) continue;
      rows.push({entry, cursor: {type, source: "leaderboard", score, userId: document.id, level: entry.level, xp: entry.xp}});
    }
    scanned += snapshot.docs.length;
    if (snapshot.docs.length < batchSize) break;
    lastDocument = snapshot.docs.at(-1);
  }
  return rows;
}

/** The empty-projection fallback uses indexed account rankings rather than scanning accounts. */
async function loadUserPage(type: LeaderboardType, limit: number, cursor?: LeaderboardCursor): Promise<PositionedLeaderboardEntry[]> {
  const db = admin.firestore();
  const source = type === "multiplayerWins" ? "multiplayer" : "users";
  const field = `stats.${type}`;
  let query = type === "xp"
    ? db.collection("users").orderBy("stats.level", "desc").orderBy("stats.xp", "desc")
    : db.collection("users").orderBy(field, "desc");
  if (type === "multiplayerWins") query = query.where(field, ">", 0);
  query = query.orderBy(admin.firestore.FieldPath.documentId(), "desc");
  if (cursor) query = type === "xp" ? query.startAfter(cursor.level, cursor.xp, cursor.userId)
    : query.startAfter(cursor.score, cursor.userId);
  const rows: PositionedLeaderboardEntry[] = [];
  let lastDocument: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let scanned = 0;
  while (rows.length < limit) {
    const batchSize = Math.min(limit - rows.length, LEADERBOARD_MAX_SCAN_ROWS - scanned);
    if (batchSize === 0) throw new HttpsError("resource-exhausted", "Leaderboard cleanup limit reached. Please retry later.");
    const nextQuery = lastDocument ? query.startAfter(lastDocument) : query;
    const snapshot = await nextQuery.select(...LEADERBOARD_ACCOUNT_FIELDS).limit(batchSize).get();
    for (const document of snapshot.docs) {
      const parsed = UserDocForLeaderboardSchema.safeParse(document.data());
      if (!parsed.success) continue;
      const entry = toSafeLeaderboardEntry(toLeaderboardEntryFromUserDoc(document.id, parsed.data), document.id);
      const score = type === "xp" ? entry.progressScore : type === "totalWins" ? entry.totalWins
        : type === "bestStreak" ? entry.bestStreak : entry.multiplayerWins ?? 0;
      rows.push({entry, cursor: {type, source, score, userId: document.id, level: entry.level, xp: entry.xp}});
    }
    scanned += snapshot.docs.length;
    if (snapshot.docs.length < batchSize) break;
    lastDocument = snapshot.docs.at(-1);
  }
  return rows;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Refreshes a public leaderboard row from the current canonical account.
 *
 * The account read and row replacement share a transaction, so delayed
 * completion callbacks cannot restore an older score or copied identity.
 * A missing account never recreates a public row; omitted avatars are removed.
 *
 * @param userId Firebase Auth UID whose committed account is projected.
 */
export async function updateLeaderboardEntry(userId: string): Promise<void> {
  /** Canonical account and public projection share one conflict boundary. */
  const db = admin.firestore();
  /** Existing authority is required before writing any copied public data. */
  const userRef = db.collection("users").doc(userId);
  /** Replacement removes profile fields that no longer exist on the account. */
  const leaderboardRef = db.collection("leaderboard").doc(userId);
  try {
    /** Logging occurs only after the final transaction attempt commits. */
    const updated = await db.runTransaction(async transaction => {
      /** Each retry reads current public inputs under the account lock without loading unused private fields. */
      const [user] = await transaction.getAll(userRef, {fieldMask: LEADERBOARD_ACCOUNT_FIELDS});
      if (!user?.exists) return false;
      /** Public fields retain the same sanitization and ownership identifiers. */
      const entry = toSafeLeaderboardEntry(toLeaderboardEntryFromUserDoc(userId, user.data() as UserDocForLeaderboard), userId);
      transaction.set(leaderboardRef, {...entry, subjectUserId: userId});
      return true;
    });
    if (updated) functions.logger.info(`[Leaderboard] Updated entry for user ${userId}`);
  } catch (error) {
    functions.logger.error(`[Leaderboard] Failed to update entry for user ${userId}:`, error);
    captureException(error, {userId});
    throw error;
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Returns one requested page, retaining legacy request limits for existing callers. */
export const getLeaderboard = onCallWithSentry("getLeaderboard", browserCallableSecurityOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated to view the leaderboard.");
  const requestingUserId = request.auth.uid;
  const data: GetLeaderboardRequest = validateCallableRequest(GetLeaderboardRequestSchema, request.data, "getLeaderboard");
  const {type} = data;
  const limit = data.limit ?? 50;
  const queryLimit = limit + (data.paginated ? 1 : 0);
  const cursor = decodeLeaderboardCursor(data.cursor, type);
  try {
    let rows: PositionedLeaderboardEntry[];
    if (type === "multiplayerWins") {
      const [players, opponents] = await Promise.all([
        loadUserPage(type, queryLimit, cursor),
        listRaceBotLeaderboardEntries(admin.firestore(), queryLimit, cursor),
      ]);
      const positionedOpponents: PositionedLeaderboardEntry[] = opponents.map(entry => ({entry, cursor: {
        type, source: "multiplayer", score: entry.multiplayerWins ?? 0,
        userId: entry.userId, level: entry.level, xp: entry.xp,
      }}));
      rows = [...players, ...positionedOpponents].sort(compareLeaderboardPositions);
    } else if (cursor?.source === "users") {
      rows = await loadUserPage(type, queryLimit, cursor);
    } else {
      rows = await loadProjectionPage(type, queryLimit, cursor);
      if (!cursor && rows.length === 0) rows = await loadUserPage(type, queryLimit);
    }
    const visible = rows.slice(0, limit);
    const last = visible.at(-1);
    const response: GetLeaderboardResponse = {
      entries: visible.map(({entry}) => entry),
      requestingUserId,
      ...(data.paginated ? {nextCursor: rows.length > limit && last ? encodeLeaderboardCursor(last.cursor) : null} : {}),
    };
    functions.logger.info(`[Leaderboard] Fetched ${response.entries.length} entries for type=${type}`);
    return validateCallableResponse(GetLeaderboardResponseSchema, response, "getLeaderboard");
  } catch (error) {
    functions.logger.error("[Leaderboard] Failed to fetch leaderboard:", error);
    captureException(error, {type, limit, userId: requestingUserId});
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to fetch leaderboard.");
  }
});
