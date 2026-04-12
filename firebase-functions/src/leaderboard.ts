/**
 * @fileoverview Leaderboard Cloud Functions for Qwordly.
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

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {captureException} from "./sentry";

//
// Types
//

export type LeaderboardType = "xp" | "totalWins" | "bestStreak";

export interface LeaderboardEntry {
  /** User document id / Firebase UID. */
  userId: string;
  /** Public display name for leaderboard row. */
  username: string;
  /** Optional avatar image URL. */
  avatarUrl?: string;
  /** Current player level. */
  level: number;
  /** Current player XP. */
  xp: number;
  /** Combined progression rank key derived from level + xp. */
  progressScore: number;
  /** Lifetime wins across modes. */
  totalWins: number;
  /** Best historical win streak. */
  bestStreak: number;
  /** Epoch milliseconds when row was last updated. */
  updatedAt: number;
}

const LEVEL_WEIGHT = 1_000_000_000;

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

interface GetLeaderboardRequest {
  /** Requested leaderboard ranking type. */
  type: LeaderboardType;
  /** Optional maximum number of rows to return. */
  limit?: number;
}

export interface GetLeaderboardResponse {
  /** Ranked leaderboard rows for the requested type. */
  entries: LeaderboardEntry[];
  /** The UID of the requesting user so the client can highlight their row. */
  requestingUserId: string;
}

interface UserDocForLeaderboard {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
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

/**
 * Best-effort self-heal for older projects: backfill leaderboard documents from
 * derived entries so future reads can use indexed leaderboard queries.
 *
 * @param entries Entries to upsert into leaderboard collection.
 */
async function backfillLeaderboard(entries: LeaderboardEntry[]): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const db = admin.firestore();
  const batch = db.batch();
  for (const entry of entries) {
    const ref = db.collection("leaderboard").doc(entry.userId);
    batch.set(ref, entry, {merge: true});
  }
  await batch.commit();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Server-side helper (not a callable â€” called from submitGuessLogic)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Write (or merge) a user's leaderboard entry. Called by submitGuessLogic
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
  const entry: LeaderboardEntry = {
    userId,
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
// Callable
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Callable: return the top N players sorted by the requested stat.
 *
 * Request: `{ type: LeaderboardType, limit?: number }` (limit capped at 100)
 * Response: `{ entries: LeaderboardEntry[], requestingUserId: string }`
 */
export const getLeaderboard = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated to view the leaderboard.");
  }

  const data = request.data as GetLeaderboardRequest;
  const type: LeaderboardType = data?.type ?? "xp";
  const limit = Math.min(data?.limit ?? 50, 100);

  const validTypes: LeaderboardType[] = ["xp", "totalWins", "bestStreak"];
  if (!validTypes.includes(type)) {
    throw new HttpsError("invalid-argument", "type must be one of: xp, totalWins, bestStreak.");
  }

  try {
    const baseRef = admin.firestore().collection("leaderboard");
    const snapshot = await (type === "xp"
      ? baseRef.orderBy("progressScore", "desc").limit(limit).get()
      : baseRef.orderBy(type, "desc").limit(limit).get());

    let entries: LeaderboardEntry[] = snapshot.docs.map((doc) => doc.data() as LeaderboardEntry);

    if (entries.length === 0) {
      functions.logger.info(`[Leaderboard] No leaderboard docs for type=${type}; deriving from users collection.`);
      entries = await buildLeaderboardFromUsers(type, limit);
      try {
        await backfillLeaderboard(entries);
        functions.logger.info(`[Leaderboard] Backfilled ${entries.length} leaderboard docs from users.`);
      } catch (backfillError) {
        functions.logger.warn("[Leaderboard] Failed to backfill derived leaderboard docs:", backfillError);
        captureException(backfillError, {type, limit, userId: request.auth.uid, stage: "backfillLeaderboard"});
      }
    }

    functions.logger.info(`[Leaderboard] Fetched ${entries.length} entries for type=${type}`);

    const response: GetLeaderboardResponse = {
      entries,
      requestingUserId: request.auth.uid,
    };
    return response;
  } catch (error) {
    functions.logger.error("[Leaderboard] Failed to fetch leaderboard:", error);
    captureException(error, {type, limit, userId: request.auth.uid});
    throw new HttpsError("internal", "Failed to fetch leaderboard.");
  }
});
