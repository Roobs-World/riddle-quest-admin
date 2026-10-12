"use strict";
/**
 * @fileoverview Leaderboard Cloud Functions for Riddle Quest.
 *
 * Maintains a `leaderboard` collection with one document per user (keyed by
 * userId). Documents are written server-side only after a win in submitGuess.
 * Clients call `getLeaderboard` to retrieve the top players for a given stat.
 *
 * Multiplayer rankings query canonical account totals through their dedicated index.
 *
 * Leaderboard types:
 *  - "xp"          — highest cumulative XP across all modes
 *  - "totalWins"   â€” most games won
 *  - "multiplayerWins" — most server-confirmed multiplayer victories
 *  - "bestStreak"  â€” longest win streak ever achieved
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeaderboard = void 0;
exports.updateLeaderboardEntry = updateLeaderboardEntry;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const functions = __importStar(require("firebase-functions"));
const https_1 = require("firebase-functions/v2/https");
const sentry_1 = require("../shared/sentry");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const callableValidation_1 = require("../validation/callableValidation");
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
function computeProgressScore(level, xp) {
    return level * LEVEL_WEIGHT + xp;
}
/**
 * Normalizes a candidate string for stable key comparisons.
 *
 * @param value Raw value to normalize.
 * @returns Trimmed string or null when empty/invalid.
 */
function normalizeKey(value) {
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
function asFiniteNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
/**
 * Converts raw leaderboard document data into a fully safe row.
 *
 * @param raw Raw Firestore payload.
 * @param fallbackUserId Firestore document id used when userId is missing.
 * @returns Sanitized leaderboard entry.
 */
function toSafeLeaderboardEntry(raw, fallbackUserId) {
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
    const entry = {
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
/**
 * Converts a Firestore users/{uid} document into leaderboard row format.
 *
 * @param userId User document id (Firebase UID).
 * @param data Raw Firestore user document data.
 * @returns Leaderboard row with safe defaults.
 */
function toLeaderboardEntryFromUserDoc(userId, data) {
    /** Provides level behavior. */
    const level = data.stats?.level ?? 1;
    /** Provides xp behavior. */
    const xp = data.stats?.xp ?? 0;
    /** Provides total wins behavior. */
    const totalWins = data.stats?.totalWins ?? 0;
    /** Provides best streak behavior. */
    const bestStreak = data.stats?.bestStreak ?? 0;
    /** Provides entry behavior. */
    const entry = {
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
/**
 * Sorts leaderboard entries according to leaderboard type.
 *
 * @param entries Entries to sort.
 * @param type Ranking type.
 * @returns New sorted entries array.
 */
function sortEntries(entries, type) {
    /** Provides sorted behavior. */
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
 * Returns only canonical leaderboard rows backed by a currently live user.
 *
 * Legacy rows under another identifier, rows whose embedded subject differs,
 * and rows left after user deletion all fail closed. Name/avatar matching is
 * deliberately excluded because those fields cannot prove ownership.
 */
async function liveCanonicalLeaderboardEntries(documents) {
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    /** Provides candidates behavior. */
    const candidates = documents.flatMap((document) => {
        /** Provides data behavior. */
        const data = document.data();
        if (normalizeKey(data.userId) !== document.id)
            return [];
        if (data.subjectUserId !== undefined && normalizeKey(data.subjectUserId) !== document.id)
            return [];
        return [{ entry: toSafeLeaderboardEntry(data, document.id), userRef: db.collection("users").doc(document.id) }];
    });
    if (candidates.length === 0)
        return [];
    /** Existing liveness reads need only public display fields, excluding economy and private profile payloads. */
    const users = await db.getAll(...candidates.map(({ userRef }) => userRef), { fieldMask: LEADERBOARD_DISPLAY_FIELDS });
    return candidates.flatMap(({ entry }, index) => {
        /** Identity is hydrated only after the canonical account existence and projection ownership checks. */
        const account = users[index];
        if (!account?.exists)
            return [];
        /** The account's current display fields supersede a stale best-effort copied profile. */
        const display = account.data();
        /** Score ordering and values retain their server-owned projection semantics. */
        const hydrated = { ...entry, username: normalizeKey(display?.username) ?? normalizeKey(display?.displayName) ?? DEFAULT_USERNAME };
        delete hydrated.avatarUrl;
        /** An absent or invalid current avatar never falls back to a prior copied image. */
        const avatar = display?.avatarUrl;
        if (typeof avatar === "string" && avatar.trim().length > 0)
            hydrated.avatarUrl = avatar;
        return [hydrated];
    });
}
/**
 * Fallback loader: derives leaderboard from users collection when dedicated
 * leaderboard docs are empty or missing.
 *
 * @param type Ranking type.
 * @param limit Max rows to return.
 * @returns Derived leaderboard entries.
 */
async function buildLeaderboardFromUsers(type, limit) {
    /** Provides rs snapshot. */
    const usersSnapshot = await firebaseAdmin_1.admin.firestore().collection("users").select(...LEADERBOARD_ACCOUNT_FIELDS).limit(1000).get();
    /** Provides derived behavior. */
    const derived = usersSnapshot.docs.map((doc) => {
        /** Provides data behavior. */
        const data = doc.data();
        return toLeaderboardEntryFromUserDoc(doc.id, data);
    });
    return sortEntries(derived, type).slice(0, limit);
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
async function updateLeaderboardEntry(userId) {
    /** Canonical account and public projection share one conflict boundary. */
    const db = firebaseAdmin_1.admin.firestore();
    /** Existing authority is required before writing any copied public data. */
    const userRef = db.collection("users").doc(userId);
    /** Replacement removes profile fields that no longer exist on the account. */
    const leaderboardRef = db.collection("leaderboard").doc(userId);
    try {
        /** Logging occurs only after the final transaction attempt commits. */
        const updated = await db.runTransaction(async (transaction) => {
            /** Each retry reads current public inputs under the account lock without loading unused private fields. */
            const [user] = await transaction.getAll(userRef, { fieldMask: LEADERBOARD_ACCOUNT_FIELDS });
            if (!user?.exists)
                return false;
            /** Public fields retain the same sanitization and ownership identifiers. */
            const entry = toSafeLeaderboardEntry(toLeaderboardEntryFromUserDoc(userId, user.data()), userId);
            transaction.set(leaderboardRef, { ...entry, subjectUserId: userId });
            return true;
        });
        if (updated)
            functions.logger.info(`[Leaderboard] Updated entry for user ${userId}`);
    }
    catch (error) {
        functions.logger.error(`[Leaderboard] Failed to update entry for user ${userId}:`, error);
        (0, sentry_1.captureException)(error, { userId });
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
exports.getLeaderboard = (0, sentryHandlers_1.onCallWithSentry)("getLeaderboard", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be authenticated to view the leaderboard.");
    }
    /** Requests ing user id. */
    const requestingUserId = request.auth.uid;
    /** Provides data behavior. */
    const data = (0, callableValidation_1.validateCallableRequest)(requestSchemas_1.GetLeaderboardRequestSchema, request.data, "getLeaderboard");
    /** Provides type behavior. */
    const type = data.type;
    /** Provides limit behavior. */
    const limit = Math.min(data.limit ?? 50, 100);
    /** Provides valid types behavior. */
    const validTypes = ["xp", "totalWins", "bestStreak", "multiplayerWins"];
    if (!validTypes.includes(type)) {
        throw new https_1.HttpsError("invalid-argument", "type must be one of: xp, totalWins, bestStreak, multiplayerWins.");
    }
    try {
        // Query canonical accounts directly so historical wins need no projection backfill.
        // This bounded single-field index is explicitly enabled beneath the unindexed stats map.
        if (type === "multiplayerWins") {
            /** Accounts ranked directly by their committed multiplayer victories. */
            const snapshot = await firebaseAdmin_1.admin.firestore().collection("users")
                .where("stats.multiplayerWins", ">", 0).orderBy("stats.multiplayerWins", "desc").select(...LEADERBOARD_ACCOUNT_FIELDS).limit(limit).get();
            /** Public rows derived from canonical account documents. */
            const entries = snapshot.docs.map(doc => toLeaderboardEntryFromUserDoc(doc.id, doc.data()));
            return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetLeaderboardResponseSchema, { entries, requestingUserId }, "getLeaderboard");
        }
        /** Provides base ref behavior. */
        const baseRef = firebaseAdmin_1.admin.firestore().collection("leaderboard");
        /** Provides candidate limit behavior. */
        const candidateLimit = Math.min(Math.max(limit * 2, limit), 200);
        /** Provides snapshot behavior. */
        const snapshot = await (type === "xp"
            ? baseRef.orderBy("progressScore", "desc").limit(candidateLimit).get()
            : baseRef.orderBy(type, "desc").limit(candidateLimit).get());
        /** Provides entries behavior. */
        let entries = await liveCanonicalLeaderboardEntries(snapshot.docs);
        if (entries.length === 0) {
            functions.logger.info(`[Leaderboard] No leaderboard docs for type=${type}; deriving from users collection.`);
            entries = await buildLeaderboardFromUsers(type, limit);
        }
        entries = entries.slice(0, limit);
        functions.logger.info(`[Leaderboard] Fetched ${entries.length} entries for type=${type}`);
        /** Provides response behavior. */
        const response = {
            entries,
            requestingUserId,
        };
        return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetLeaderboardResponseSchema, response, "getLeaderboard");
    }
    catch (error) {
        functions.logger.error("[Leaderboard] Failed to fetch leaderboard:", error);
        (0, sentry_1.captureException)(error, { type, limit, userId: requestingUserId });
        throw new https_1.HttpsError("internal", "Failed to fetch leaderboard.");
    }
});
//# sourceMappingURL=leaderboard.js.map