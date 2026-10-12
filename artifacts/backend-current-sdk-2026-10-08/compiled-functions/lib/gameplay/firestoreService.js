"use strict";
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
exports.getRiddleByGameMode = exports.getRiddle = exports.getDailyRiddle = exports.getClassicRiddleByIndex = void 0;
exports.getUser = getUser;
exports.updateUserLastCompletedDailyChallengeDate = updateUserLastCompletedDailyChallengeDate;
exports.updateUserCoins = updateUserCoins;
exports.updateUserStats = updateUserStats;
exports.updateUserProfile = updateUserProfile;
exports.initializeNewUser = initializeNewUser;
exports.prepareUserDocumentCompletion = prepareUserDocumentCompletion;
exports.ensureUserDocumentComplete = ensureUserDocumentComplete;
exports.appendUnlockedAchievements = appendUnlockedAchievements;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentry_1 = require("../shared/sentry");
const firestoreSchemas_1 = require("../validation/firestoreSchemas");
const functions = __importStar(require("firebase-functions"));
const usernameReservations_1 = require("../profile/usernameReservations");
/** Defines the initial coins value. */
const INITIAL_COINS = 300;
// const db = admin.firestore(); // Replaced with lazy initialization
/** Provides db instance behavior. */
let dbInstance;
/** Gets db. */
function getDb() {
    if (!dbInstance) {
        dbInstance = firebaseAdmin_1.admin.firestore();
    }
    return dbInstance;
}
/**
 * Fetches a user document by ID.
 *
 * @param userId - The ID of the user.
 * @return A promise that resolves with the user document data, or undefined if not found.
 */
async function getUser(userId) {
    /** Provides r ref. */
    const userRef = getDb().collection("users").doc(userId);
    /** Provides r doc. */
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        functions.logger.info(`User document not found for ID ${userId}`);
        return undefined;
    }
    return userDoc.data();
}
/**
 * Updates the last completed daily challenge date for a user.
 *
 * @param userId - The ID of the user.
 * @param date - The date string to set.
 * @return A promise that resolves when the update is complete.
 */
async function updateUserLastCompletedDailyChallengeDate(userId, date) {
    try {
        await getDb().collection("users").doc(userId).update({ lastDailyChallengeCompletedAt: date });
    }
    catch (error) {
        functions.logger.error(`Error updating last completed daily challenge date for user ${userId}:`, error);
        (0, sentry_1.captureException)(error);
        throw error;
    }
}
/**
 * Updates the coin balance for a user.
 *
 * @param userId - The ID of the user.
 * @param coinsToAdd - The number of coins to add (can be negative to subtract).
 * @param transaction - Optional. The Firestore transaction to use.
 * @return A promise that resolves when the update is complete.
 */
async function updateUserCoins(userId, coinsToAdd, transaction) {
    /** Provides r ref. */
    const userRef = getDb().collection("users").doc(userId);
    /** Updates operation. */
    const updateOperation = async (txn) => {
        /** Provides r doc. */
        const userDoc = await txn.get(userRef);
        if (!userDoc.exists) {
            /** Provides error message behavior. */
            const errorMessage = `User with ID ${userId} not found during transaction for updateUserCoins.`;
            functions.logger.error(errorMessage, new Error(errorMessage));
            throw new Error(`User with ID ${userId} not found.`);
        }
        /** Provides current coins behavior. */
        const currentCoins = userDoc.data()?.coins || 0;
        /** Provides new coins behavior. */
        const newCoins = currentCoins + coinsToAdd;
        if (newCoins < 0) {
            /** Provides error message behavior. */
            const errorMessage = `Insufficient coins for user ${userId}. Current: ${currentCoins}, Attempted to spend: ${-coinsToAdd}.`;
            functions.logger.error(errorMessage, new Error(errorMessage));
            throw new Error(errorMessage);
        }
        txn.update(userRef, { coins: newCoins });
    };
    if (transaction) {
        await updateOperation(transaction);
    }
    else {
        // Use a transaction if one is not provided
        await getDb().runTransaction(updateOperation);
    }
    functions.logger.info(`User ${userId} coins updated by ${coinsToAdd}.`);
}
/**
 * Updates the stats for a user.
 *
 * @param userId - The ID of the user.
 * @param statsUpdate - An object containing the stats to update.
 * @param transaction - Optional. The Firestore transaction to use.
 * @return A promise that resolves when the update is complete.
 */
async function updateUserStats(userId, statsUpdate, transaction) {
    /** Provides r ref. */
    const userRef = getDb().collection("users").doc(userId);
    /** Provides stats field updates behavior. */
    const statsFieldUpdates = Object.fromEntries(Object.entries(statsUpdate).flatMap(([key, value]) => (value === undefined ? [] : [[`stats.${key}`, value]])));
    /** Updates operation. */
    const updateOperation = async (txn) => {
        /** Provides r doc. */
        const userDoc = await txn.get(userRef);
        if (!userDoc.exists) {
            /** Provides error message behavior. */
            const errorMessage = `User with ID ${userId} not found during transaction for updateUserStats.`;
            functions.logger.error(errorMessage, new Error(errorMessage));
            throw new Error(`User with ID ${userId} not found.`);
        }
        if (Object.keys(statsFieldUpdates).length === 0) {
            return;
        }
        txn.update(userRef, statsFieldUpdates);
    };
    if (transaction) {
        await updateOperation(transaction);
    }
    else {
        // Use a transaction if one is not provided
        await getDb().runTransaction(updateOperation);
    }
    functions.logger.info(`Stats for user ${userId} updated.`);
}
/**
 * Updates the profile for a user.
 *
 * @param userId - The ID of the user.
 * @param profileUpdate - An object containing the profile fields to update.
 * @return A promise that resolves when the update is complete.
 */
async function updateUserProfile(userId, profileUpdate) {
    try {
        await getDb().collection("users").doc(userId).update(profileUpdate);
    }
    catch (error) {
        functions.logger.error(`Error updating profile for user ${userId}:`, error);
        (0, sentry_1.captureException)(error);
        throw error;
    }
}
/**
 * Initializes a new user document with default stats and progress.
 * Called when a new user account is created.
 *
 * @param userId - The ID of the user.
 * @param userData - Basic user data (email, username, etc.).
 * @return A promise that resolves when the user document is created.
 */
async function initializeNewUser(userId, userData) {
    try {
        /** Provides seed behavior. */
        const seed = userData.seed ?? {};
        /** Provides seed coins behavior. */
        const seedCoins = typeof seed.coins === "number" && Number.isInteger(seed.coins) && seed.coins >= 0 ? seed.coins : INITIAL_COINS;
        /** Provides seed stats behavior. */
        const seedStats = seed.stats && typeof seed.stats === "object" ? seed.stats : {};
        /** Provides seed progress behavior. */
        const seedProgress = seed.progress && typeof seed.progress === "object" ? seed.progress : {};
        /** Provides seed achievements behavior. */
        const seedAchievements = Array.isArray(seed.unlockedAchievements) ? seed.unlockedAchievements : [];
        /** Provides now behavior. */
        const now = Date.now();
        /** Provides default user data behavior. */
        const defaultUserData = {
            userId,
            email: userData.email,
            username: userData.username,
            displayName: userData.displayName,
            avatarUrl: userData.avatarUrl,
            preferredLanguage: typeof seed.preferredLanguage === "string" ? seed.preferredLanguage : "en",
            coins: seedCoins,
            hasPurchasedApp: typeof seed.hasPurchasedApp === "boolean" ? seed.hasPurchasedApp : false,
            createdAt: now,
            registeredAt: now,
            lastLogin: now,
            stats: {
                xp: 0,
                level: 1,
                dailyPuzzlesCompleted: 0,
                bestStreak: 0,
                totalWordsGuessed: 0,
                winRate: 0,
                averageGuesses: 0,
                totalScore: 0,
                highestLevelClassic: 0,
                gamesPlayed: 0,
                wins: 0,
                challengeWins: 0,
                winStreak: 0,
                totalWins: 0,
                totalGuessesInWins: 0,
                totalHintsUsed: 0,
                multiplayerGamesPlayed: 0,
                multiplayerWins: 0,
                multiplayerChallengesCreated: 0,
                ...seedStats,
            },
            unlockedAchievements: seedAchievements,
            progress: {
                classicIndex: 1,
                dailyChallengeIndex: 0,
                dailyChallengeCurrentQuestion: 0,
                ...seedProgress,
            },
        };
        if (typeof seed.lastDailyChallengeCompletedAt === "number") {
            defaultUserData.lastDailyChallengeCompletedAt = seed.lastDailyChallengeCompletedAt;
        }
        if (typeof seed.lastCompletedDailyChallengeKey === "string") {
            defaultUserData.lastCompletedDailyChallengeKey = seed.lastCompletedDailyChallengeKey;
        }
        /** Validates d user data. */
        const validatedUserData = firestoreSchemas_1.PlayerSchema.parse(defaultUserData);
        /** Provides db behavior. */
        const db = getDb();
        /** Provides r ref. */
        const userRef = db.collection("users").doc(userId);
        await db.runTransaction(async (transaction) => {
            /** Provides reservation fields behavior. */
            const reservationFields = (0, usernameReservations_1.reserveUsernameForNewUser)(transaction, db, userId, validatedUserData.username);
            transaction.create(userRef, { ...validatedUserData, ...reservationFields });
        });
        functions.logger.info(`Initialized new user document for ${userId} with default stats and progress`);
    }
    catch (error) {
        functions.logger.error(`Error initializing new user ${userId}:`, error);
        (0, sentry_1.captureException)(error);
        throw error;
    }
}
/** Prepares missing profile fields from the current authoritative account snapshot. */
function prepareUserDocumentCompletion(userData) {
    /** Updates s. */
    const updates = {};
    // Ensure stats object exists with all required fields
    if (!userData.stats) {
        updates.stats = {
            xp: 0,
            level: 1,
            dailyPuzzlesCompleted: 0,
            bestStreak: 0,
            totalWordsGuessed: 0,
            winRate: 0,
            averageGuesses: 0,
            totalScore: 0,
            highestLevelClassic: 0,
            gamesPlayed: 0,
            wins: 0,
            challengeWins: 0,
            winStreak: 0,
            totalWins: 0,
            totalGuessesInWins: 0,
            totalHintsUsed: 0,
            multiplayerGamesPlayed: 0,
            multiplayerWins: 0,
            multiplayerChallengesCreated: 0,
        };
    }
    else {
        // Check for missing stat fields and add defaults
        /** Provides current stats behavior. */
        const currentStats = userData.stats;
        /** Provides default stats behavior. */
        const defaultStats = {
            xp: 0,
            level: 1,
            dailyPuzzlesCompleted: 0,
            bestStreak: 0,
            totalWordsGuessed: 0,
            winRate: 0,
            averageGuesses: 0,
            totalScore: 0,
            highestLevelClassic: 0,
            gamesPlayed: 0,
            wins: 0,
            challengeWins: 0,
            winStreak: 0,
            totalWins: 0,
            totalGuessesInWins: 0,
            totalHintsUsed: 0,
            multiplayerGamesPlayed: 0,
            multiplayerWins: 0,
            multiplayerChallengesCreated: 0,
        };
        /** Provides needs stats update behavior. */
        let needsStatsUpdate = false;
        /** Provides merged stats behavior. */
        const mergedStats = { ...currentStats };
        for (const [key, defaultValue] of Object.entries(defaultStats)) {
            if (!(key in currentStats) || currentStats[key] === undefined) {
                mergedStats[key] = defaultValue;
                needsStatsUpdate = true;
            }
        }
        if (needsStatsUpdate) {
            updates.stats = mergedStats;
        }
    }
    // Ensure progress object exists with all required fields
    if (!userData.progress) {
        updates.progress = {
            classicIndex: 1,
            dailyChallengeIndex: 0,
            dailyChallengeCurrentQuestion: 0,
        };
    }
    else {
        /** Provides current progress behavior. */
        const currentProgress = userData.progress;
        /** Provides default progress behavior. */
        const defaultProgress = {
            classicIndex: 1,
            dailyChallengeIndex: 0,
            dailyChallengeCurrentQuestion: 0,
        };
        /** Provides needs progress update behavior. */
        let needsProgressUpdate = false;
        /** Provides merged progress behavior. */
        const mergedProgress = { ...currentProgress };
        for (const [key, defaultValue] of Object.entries(defaultProgress)) {
            if (!(key in currentProgress) || currentProgress[key] === undefined) {
                mergedProgress[key] = defaultValue;
                needsProgressUpdate = true;
            }
        }
        if (needsProgressUpdate) {
            updates.progress = mergedProgress;
        }
    }
    // Ensure other required fields exist
    if (userData.coins === undefined) {
        updates.coins = INITIAL_COINS; // Default starting coins
    }
    if (userData.hasPurchasedApp === undefined) {
        updates.hasPurchasedApp = false;
    }
    if (!Array.isArray(userData.unlockedAchievements)) {
        updates.unlockedAchievements = [];
    }
    return updates;
}
/** Repairs a legacy account without overwriting a concurrent gameplay or commerce commit. */
async function ensureUserDocumentComplete(userId) {
    try {
        /** One transaction protects both the default computation and the conditional update. */
        const db = getDb();
        /** Canonical account is never created by profile repair. */
        const userRef = db.collection("users").doc(userId);
        /** Only committed repair fields are logged; retries use fresh snapshots. */
        const fields = await db.runTransaction(async (transaction) => {
            /** Missing accounts retain the existing no-recreation behavior. */
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                functions.logger.warn(`User document not found for ${userId}, cannot ensure completeness without basic user data`);
                return [];
            }
            /** Missing defaults are derived only from this transaction attempt. */
            const updates = prepareUserDocumentCompletion(userDoc.data());
            if (Object.keys(updates).length)
                transaction.update(userRef, updates);
            return Object.keys(updates);
        });
        if (fields.length)
            functions.logger.info(`Updated user document for ${userId} with missing fields:`, fields);
    }
    catch (error) {
        functions.logger.error(`Error ensuring user document completeness for ${userId}:`, error);
        (0, sentry_1.captureException)(error);
        throw error;
    }
}
/**
 * Appends newly unlocked achievements to the user document.
 * Deduplicates by achievementId so the same achievement is not added twice.
 *
 * @param userId - The user's ID.
 * @param newEntries - Array of { achievementId, unlockedAt } to append.
 * @return A promise that resolves when the update is complete.
 */
async function appendUnlockedAchievements(userId, newEntries) {
    if (newEntries.length === 0)
        return;
    /** Provides r ref. */
    const userRef = getDb().collection("users").doc(userId);
    /** Provides r doc. */
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        functions.logger.warn(`Cannot append achievements: user ${userId} not found`);
        return;
    }
    /** Provides existing behavior. */
    const existing = userDoc.data()?.unlockedAchievements || [];
    /** Provides existing ids behavior. */
    const existingIds = new Set(existing.map((e) => e.achievementId));
    /** Provides to add behavior. */
    const toAdd = newEntries.filter((e) => !existingIds.has(e.achievementId));
    if (toAdd.length === 0)
        return;
    await userRef.update({
        unlockedAchievements: firebaseAdmin_1.admin.firestore.FieldValue.arrayUnion(...toAdd),
    });
    functions.logger.info(`Appended ${toAdd.length} achievements for user ${userId}`);
}
var riddleRepository_1 = require("./riddleRepository");
Object.defineProperty(exports, "getClassicRiddleByIndex", { enumerable: true, get: function () { return riddleRepository_1.getClassicRiddleByIndex; } });
Object.defineProperty(exports, "getDailyRiddle", { enumerable: true, get: function () { return riddleRepository_1.getDailyRiddle; } });
Object.defineProperty(exports, "getRiddle", { enumerable: true, get: function () { return riddleRepository_1.getRiddle; } });
Object.defineProperty(exports, "getRiddleByGameMode", { enumerable: true, get: function () { return riddleRepository_1.getRiddleByGameMode; } });
//# sourceMappingURL=firestoreService.js.map