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

import {admin} from "./firebaseAdmin";
import * as functions from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {captureException} from "./sentry";
const jestWebCallableOptions = {enforceAppCheck: process.env.JEST_ALLOW_WEB_CALLABLES !== "true"};
import {
  GetLeaderboardRequest,
  GetLeaderboardRequestSchema,
  GetLeaderboardResponse,
  GetLeaderboardResponseSchema,
  LeaderboardEntry,
  LeaderboardType,
} from "./validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "./validation/callableValidation";

//
// Types
//

const LEVEL_WEIGHT = 1_000_000_000;
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
 * Normalizes usernames for case-insensitive comparisons.
 *
 * @param value Raw username value.
 * @returns Lowercase normalized username, or null when invalid.
 */
function normalizeUsernameKey(value: unknown): string | null {
  const normalized = normalizeKey(value);
  return normalized ? normalized.toLowerCase() : null;
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
 * Reads the sortable value for a leaderboard row by ranking type.
 *
 * @param entry Entry to evaluate.
 * @param type Ranking type.
 * @returns Numeric sort value.
 */
function getSortValue(entry: LeaderboardEntry, type: LeaderboardType): number {
  if (type === "xp") {
    return entry.progressScore;
  }
  if (type === "totalWins") {
    return entry.totalWins;
  }
  return entry.bestStreak;
}

/**
 * Chooses which entry should represent a deduped row.
 *
 * Preference order:
 * 1) entry with requesting user id
 * 2) higher score for current leaderboard type
 * 3) newer updatedAt
 *
 * @param current Current retained entry.
 * @param candidate Candidate entry to compare.
 * @param type Active leaderboard type.
 * @param requestingUserId Requesting user uid.
 * @returns Preferred entry.
 */
function preferEntry(
  current: LeaderboardEntry,
  candidate: LeaderboardEntry,
  type: LeaderboardType,
  requestingUserId: string,
): LeaderboardEntry {
  const normalizedRequestingUserId = normalizeKey(requestingUserId);
  const currentIsRequestingUser = normalizedRequestingUserId != null && current.userId === normalizedRequestingUserId;
  const candidateIsRequestingUser =
    normalizedRequestingUserId != null && candidate.userId === normalizedRequestingUserId;

  if (currentIsRequestingUser !== candidateIsRequestingUser) {
    return candidateIsRequestingUser ? candidate : current;
  }

  const currentSortValue = getSortValue(current, type);
  const candidateSortValue = getSortValue(candidate, type);
  if (currentSortValue !== candidateSortValue) {
    return candidateSortValue > currentSortValue ? candidate : current;
  }

  if (current.updatedAt !== candidate.updatedAt) {
    return candidate.updatedAt > current.updatedAt ? candidate : current;
  }

  return current;
}

/**
 * Removes duplicated leaderboard rows that represent the same user.
 *
 * Handles:
 *  - duplicate userIds
 *  - legacy duplicate ids that share requesting user's username/avatar
 *
 * @param entries Raw leaderboard entries.
 * @param type Active leaderboard type.
 * @param requestingUserId Auth uid from callable request.
 * @param requestingUsername Optional username lookup from users/{uid}.
 * @param requestingAvatarUrl Optional avatar lookup from users/{uid}.
 * @returns Deduped and sorted entries.
 */
function dedupeEntries(
  entries: LeaderboardEntry[],
  type: LeaderboardType,
  requestingUserId: string,
  requestingUsername: string | null,
  requestingAvatarUrl: string | null,
): LeaderboardEntry[] {
  const byUserId = new Map<string, LeaderboardEntry>();
  for (const entry of entries) {
    const normalizedUserId = normalizeKey(entry.userId);
    if (!normalizedUserId) {
      continue;
    }

    const normalizedEntry = {...entry, userId: normalizedUserId};
    const existing = byUserId.get(normalizedUserId);
    if (!existing) {
      byUserId.set(normalizedUserId, normalizedEntry);
      continue;
    }

    byUserId.set(normalizedUserId, preferEntry(existing, normalizedEntry, type, requestingUserId));
  }

  const normalizedRequestingUserId = normalizeKey(requestingUserId);
  if (!normalizedRequestingUserId) {
    return sortEntries([...byUserId.values()], type);
  }

  let canonicalRequestingEntry = byUserId.get(normalizedRequestingUserId) ?? null;
  const requestingUsernameKey = normalizeUsernameKey(canonicalRequestingEntry?.username ?? requestingUsername);
  const requestingAvatarKey = normalizeKey(canonicalRequestingEntry?.avatarUrl ?? requestingAvatarUrl);

  for (const [userId, entry] of [...byUserId.entries()]) {
    if (userId === normalizedRequestingUserId) {
      continue;
    }

    const usernameMatches =
      requestingUsernameKey != null && normalizeUsernameKey(entry.username) === requestingUsernameKey;
    const avatarMatches = requestingAvatarKey != null && normalizeKey(entry.avatarUrl) === requestingAvatarKey;

    if (!usernameMatches && !avatarMatches) {
      continue;
    }

    canonicalRequestingEntry = canonicalRequestingEntry
      ? preferEntry(canonicalRequestingEntry, entry, type, normalizedRequestingUserId)
      : {...entry, userId: normalizedRequestingUserId};
    canonicalRequestingEntry = {...canonicalRequestingEntry, userId: normalizedRequestingUserId};
    byUserId.delete(userId);
  }

  if (canonicalRequestingEntry) {
    byUserId.set(normalizedRequestingUserId, canonicalRequestingEntry);
  }

  return sortEntries([...byUserId.values()], type);
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
export const getLeaderboard = onCall(jestWebCallableOptions, async (request) => {
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
    const snapshot = await (type === "xp"
      ? baseRef.orderBy("progressScore", "desc").limit(limit).get()
      : baseRef.orderBy(type, "desc").limit(limit).get());

    let entries: LeaderboardEntry[] = snapshot.docs.map((doc) => {
      const data = doc.data() as Partial<LeaderboardEntry>;
      return toSafeLeaderboardEntry(data, doc.id);
    });

    if (entries.length === 0) {
      functions.logger.info(`[Leaderboard] No leaderboard docs for type=${type}; deriving from users collection.`);
      entries = await buildLeaderboardFromUsers(type, limit);
      try {
        await backfillLeaderboard(entries);
        functions.logger.info(`[Leaderboard] Backfilled ${entries.length} leaderboard docs from users.`);
      } catch (backfillError) {
        functions.logger.warn("[Leaderboard] Failed to backfill derived leaderboard docs:", backfillError);
        captureException(backfillError, {type, limit, userId: requestingUserId, stage: "backfillLeaderboard"});
      }
    }

    let requestingUsername: string | null = null;
    let requestingAvatarUrl: string | null = null;
    const hasRequestingUserEntry = entries.some((entry) => entry.userId === requestingUserId);
    if (hasRequestingUserEntry) {
      const requestingUserEntry = entries.find((entry) => entry.userId === requestingUserId) ?? null;
      requestingUsername = requestingUserEntry?.username ?? null;
      requestingAvatarUrl = requestingUserEntry?.avatarUrl ?? null;
    } else {
      try {
        const requestingUserDoc = await admin.firestore().collection("users").doc(requestingUserId).get();
        if (requestingUserDoc.exists) {
          const requestingUserData = requestingUserDoc.data() as UserDocForLeaderboard;
          requestingUsername = requestingUserData.username ?? requestingUserData.displayName ?? null;
          requestingAvatarUrl = requestingUserData.avatarUrl ?? null;
        }
      } catch (lookupError) {
        functions.logger.warn(
          `[Leaderboard] Failed to read users/${requestingUserId} for dedupe fallback:`,
          lookupError,
        );
        captureException(lookupError, {
          type,
          limit,
          userId: requestingUserId,
          stage: "requestingUserLookupForDedupe",
        });
      }
    }

    const dedupedEntries = dedupeEntries(entries, type, requestingUserId, requestingUsername, requestingAvatarUrl);
    if (dedupedEntries.length !== entries.length) {
      functions.logger.info(
        `[Leaderboard] Deduped ${entries.length - dedupedEntries.length} duplicate entries for user ${requestingUserId}.`,
      );
    }
    entries = dedupedEntries.slice(0, limit);

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
