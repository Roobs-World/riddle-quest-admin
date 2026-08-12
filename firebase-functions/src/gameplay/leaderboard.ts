/**
 * @fileoverview Leaderboard Cloud Functions for Riddle Quest.
 *
 * Maintains a `leaderboard` collection with one document per user (keyed by
 * userId). Documents are written server-side only after a win in submitGuess.
 * Clients call `getLeaderboard` to retrieve the top players for a given stat.
 *
 * Leaderboard types:
 *  - "xp"          — highest cumulative XP across all modes
 *  - "totalWins"   â€” most games won
 *  - "bestStreak"  â€” longest win streak ever achieved
 */

import {admin} from "../shared/firebaseAdmin";
import * as functions from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
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
} from "../validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";

/** Defines the level weight value. */
const LEVEL_WEIGHT = 1_000_000_000;
/** Defines the default username value. */
const DEFAULT_USERNAME = "Player";

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
  const userId = normalizeKey(raw.userId) ?? fallbackUserId;
  const username = normalizeKey(raw.username) ?? DEFAULT_USERNAME;
  const level = Math.max(1, asFiniteNumber(raw.level, 1));
  const xp = Math.max(0, asFiniteNumber(raw.xp, 0));
  const totalWins = Math.max(0, asFiniteNumber(raw.totalWins, 0));
  const bestStreak = Math.max(0, asFiniteNumber(raw.bestStreak, 0));
  const updatedAt = Math.max(0, asFiniteNumber(raw.updatedAt, 0));

  const entry: LeaderboardEntry = {
    userId,
    username,
    level,
    xp,
    progressScore: computeProgressScore(level, xp),
    totalWins,
    bestStreak,
    updatedAt,
  };

  if (typeof raw.avatarUrl === "string" && raw.avatarUrl.trim().length > 0) {
    entry.avatarUrl = raw.avatarUrl;
  }

  return entry;
}

/** Defines the contract for user doc for leaderboard. */
interface UserDocForLeaderboard {
  /** Stores username. */
  username?: string;
  /** Stores display name. */
  displayName?: string;
  /** Stores avatar url. */
  avatarUrl?: string;
  /** Stores stats. */
  stats?: {
    level?: number;
    xp?: number;
    totalWins?: number;
    bestStreak?: number;
  };
}

/**
 * Converts a Firestore users/{uid} document into leaderboard row format.
 *
 * @param userId User document id (Firebase UID).
 * @param data Raw Firestore user document data.
 * @returns Leaderboard row with safe defaults.
 */
function toLeaderboardEntryFromUserDoc(userId: string, data: UserDocForLeaderboard): LeaderboardEntry {
  const level = data.stats?.level ?? 1;
  const xp = data.stats?.xp ?? 0;
  const totalWins = data.stats?.totalWins ?? 0;
  const bestStreak = data.stats?.bestStreak ?? 0;

  const entry: LeaderboardEntry = {
    userId,
    username: data.username ?? data.displayName ?? "Player",
    level,
    xp,
    progressScore: computeProgressScore(level, xp),
    totalWins,
    bestStreak,
    updatedAt: Date.now(),
  };

  if (data.avatarUrl) {
    entry.avatarUrl = data.avatarUrl;
  }

  return entry;
}

/**
 * Sorts leaderboard entries according to leaderboard type.
 *
 * @param entries Entries to sort.
 * @param type Ranking type.
 * @returns New sorted entries array.
 */
function sortEntries(entries: LeaderboardEntry[], type: LeaderboardType): LeaderboardEntry[] {
  const sorted = [...entries];
  if (type === "xp") {
    sorted.sort((a, b) => b.progressScore - a.progressScore);
    return sorted;
  }
  if (type === "totalWins") {
    sorted.sort((a, b) => b.totalWins - a.totalWins);
    return sorted;
  }
  sorted.sort((a, b) => b.bestStreak - a.bestStreak);
  return sorted;
}

/** Raw leaderboard document paired with the canonical document identifier. */
interface LeaderboardDocument {
  /** Canonical Firebase UID used as the document ID. */
  id: string;
  /** Returns the stored server-owned leaderboard fields. */
  data(): Partial<LeaderboardEntry> & {subjectUserId?: unknown};
}

/**
 * Returns only canonical leaderboard rows backed by a currently live user.
 *
 * Legacy rows under another identifier, rows whose embedded subject differs,
 * and rows left after user deletion all fail closed. Name/avatar matching is
 * deliberately excluded because those fields cannot prove ownership.
 */
async function liveCanonicalLeaderboardEntries(documents: LeaderboardDocument[]): Promise<LeaderboardEntry[]> {
  const db = admin.firestore();
  const candidates = documents.flatMap((document) => {
    const data = document.data();
    if (normalizeKey(data.userId) !== document.id) return [];
    if (data.subjectUserId !== undefined && normalizeKey(data.subjectUserId) !== document.id) return [];
    return [{entry: toSafeLeaderboardEntry(data, document.id), userRef: db.collection("users").doc(document.id)}];
  });
  if (candidates.length === 0) return [];
  const users = await db.getAll(...candidates.map(({userRef}) => userRef));
  return candidates.flatMap(({entry}, index) => users[index]?.exists ? [entry] : []);
}

/**
 * Fallback loader: derives leaderboard from users collection when dedicated
 * leaderboard docs are empty or missing.
 *
 * @param type Ranking type.
 * @param limit Max rows to return.
 * @returns Derived leaderboard entries.
 */
async function buildLeaderboardFromUsers(type: LeaderboardType, limit: number): Promise<LeaderboardEntry[]> {
  const usersSnapshot = await admin.firestore().collection("users").limit(1000).get();
  const derived = usersSnapshot.docs.map((doc) => {
    const data = doc.data() as UserDocForLeaderboard;
    return toLeaderboardEntryFromUserDoc(doc.id, data);
  });

  return sortEntries(derived, type).slice(0, limit);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Write (or merge) a user's leaderboard entry. Called by completeGameLogic
 * after a win so the leaderboard always reflects the latest stats.
 *
 * @param userId    Firebase Auth UID.
 * @param username  Display username for the leaderboard row.
 * @param stats     The updated stat values to store.
 * @param avatarUrl Optional avatar URL for display.
 */
export async function updateLeaderboardEntry(
  userId: string,
  username: string,
  stats: {level: number; xp: number; totalWins: number; bestStreak: number},
  avatarUrl?: string | null,
): Promise<void> {
  const entry: LeaderboardEntry & {subjectUserId: string} = {
    userId,
    subjectUserId: userId,
    username,
    level: stats.level,
    xp: stats.xp,
    progressScore: computeProgressScore(stats.level, stats.xp),
    totalWins: stats.totalWins,
    bestStreak: stats.bestStreak,
    updatedAt: Date.now(),
  };
  if (avatarUrl) {
    entry.avatarUrl = avatarUrl;
  }

  try {
    await admin.firestore().collection("leaderboard").doc(userId).set(entry, {merge: true});
    functions.logger.info(`[Leaderboard] Updated entry for user ${userId}`);
  } catch (error) {
    functions.logger.error(`[Leaderboard] Failed to update entry for user ${userId}:`, error);
    captureException(error, {userId});
    throw error;
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Callable: return the top N players sorted by the requested stat.
 *
 * Request: `{ type: LeaderboardType, limit?: number }` (limit capped at 100)
 * Response: `{ entries: LeaderboardEntry[], requestingUserId: string }`
 */
export const getLeaderboard = onCallWithSentry("getLeaderboard", browserCallableSecurityOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated to view the leaderboard.");
  }
  const requestingUserId = request.auth.uid;

  const data: GetLeaderboardRequest = validateCallableRequest(
    GetLeaderboardRequestSchema,
    request.data,
    "getLeaderboard",
  );
  const type: LeaderboardType = data.type;
  const limit = Math.min(data.limit ?? 50, 100);

  const validTypes: LeaderboardType[] = ["xp", "totalWins", "bestStreak"];
  if (!validTypes.includes(type)) {
    throw new HttpsError("invalid-argument", "type must be one of: xp, totalWins, bestStreak.");
  }

  try {
    const baseRef = admin.firestore().collection("leaderboard");
    const candidateLimit = Math.min(Math.max(limit * 2, limit), 200);
    const snapshot = await (type === "xp"
      ? baseRef.orderBy("progressScore", "desc").limit(candidateLimit).get()
      : baseRef.orderBy(type, "desc").limit(candidateLimit).get());

    let entries = await liveCanonicalLeaderboardEntries(snapshot.docs);

    if (entries.length === 0) {
      functions.logger.info(`[Leaderboard] No leaderboard docs for type=${type}; deriving from users collection.`);
      entries = await buildLeaderboardFromUsers(type, limit);
    }

    entries = entries.slice(0, limit);

    functions.logger.info(`[Leaderboard] Fetched ${entries.length} entries for type=${type}`);

    const response: GetLeaderboardResponse = {
      entries,
      requestingUserId,
    };
    return validateCallableResponse(GetLeaderboardResponseSchema, response, "getLeaderboard");
  } catch (error) {
    functions.logger.error("[Leaderboard] Failed to fetch leaderboard:", error);
    captureException(error, {type, limit, userId: requestingUserId});
    throw new HttpsError("internal", "Failed to fetch leaderboard.");
  }
});
