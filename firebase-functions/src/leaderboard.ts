/**
 * @fileoverview Leaderboard Cloud Functions for Qwordly.
 *
 * Maintains a `leaderboard` collection with one document per user (keyed by
 * userId). Documents are written server-side only after a win in submitGuess.
 * Clients call `getLeaderboard` to retrieve the top players for a given stat.
 *
 * Leaderboard types:
 *  - "totalScore"  — highest cumulative score across all modes
 *  - "totalWins"   — most games won
 *  - "bestStreak"  — longest win streak ever achieved
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {captureException} from "./sentry";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LeaderboardType = "totalScore" | "totalWins" | "bestStreak";

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl?: string;
  totalScore: number;
  totalWins: number;
  bestStreak: number;
  updatedAt: number;
}

interface GetLeaderboardRequest {
  type: LeaderboardType;
  limit?: number;
}

export interface GetLeaderboardResponse {
  entries: LeaderboardEntry[];
  /** The UID of the requesting user so the client can highlight their row. */
  requestingUserId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-side helper (not a callable — called from submitGuessLogic)
// ─────────────────────────────────────────────────────────────────────────────

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
  stats: {totalScore: number; totalWins: number; bestStreak: number},
  avatarUrl?: string | null,
): Promise<void> {
  const entry: LeaderboardEntry = {
    userId,
    username,
    totalScore: stats.totalScore,
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

// ─────────────────────────────────────────────────────────────────────────────
// Callable
// ─────────────────────────────────────────────────────────────────────────────

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
  const type: LeaderboardType = data?.type ?? "totalScore";
  const limit = Math.min(data?.limit ?? 50, 100);

  const validTypes: LeaderboardType[] = ["totalScore", "totalWins", "bestStreak"];
  if (!validTypes.includes(type)) {
    throw new HttpsError("invalid-argument", "type must be one of: totalScore, totalWins, bestStreak.");
  }

  try {
    const snapshot = await admin
      .firestore()
      .collection("leaderboard")
      .orderBy(type, "desc")
      .limit(limit)
      .get();

    const entries: LeaderboardEntry[] = snapshot.docs.map((doc) => doc.data() as LeaderboardEntry);

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
