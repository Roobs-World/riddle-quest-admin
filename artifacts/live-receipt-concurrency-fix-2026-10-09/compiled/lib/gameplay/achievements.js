"use strict";
/**
 * @fileoverview Server-side achievement evaluation for Riddle Quest.
 *
 * Evaluates unlock criteria after game actions (e.g. submitGuess) and appends
 * newly unlocked achievements to the user document. All authority is server-side
 * so clients cannot fake achievements.
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
exports.findNewAchievements = findNewAchievements;
exports.evaluateAchievements = evaluateAchievements;
const game_1 = require("@qwordly/core/game");
const functions = __importStar(require("firebase-functions"));
const firestoreService_1 = require("./firestoreService");
const sentry_1 = require("../shared/sentry");
const constants_1 = require("../shared/constants");
/** Achievement ID and its unlock rule. Server does not store name/description; client has definitions. */
const ACHIEVEMENT_RULES = [
    ...game_1.ACHIEVEMENT_MILESTONES.map(({ id, stat, threshold }) => ({
        id,
        rule: (user) => (user.stats?.[stat] ?? 0) >= threshold,
    })),
    {
        id: "first_win",
        rule: (user) => (user.stats?.totalWins ?? 0) >= 1,
    },
    {
        id: "wins_5",
        rule: (user) => (user.stats?.totalWins ?? 0) >= 5,
    },
    {
        id: "wins_25",
        rule: (user) => (user.stats?.totalWins ?? 0) >= 25,
    },
    {
        id: "wins_50",
        rule: (user) => (user.stats?.totalWins ?? 0) >= 50,
    },
    {
        id: "wins_100",
        rule: (user) => (user.stats?.totalWins ?? 0) >= 100,
    },
    {
        id: "win_rate_80",
        rule: (user) => (user.stats?.gamesPlayed ?? 0) >= 10 && (user.stats?.winRate ?? 0) >= 80,
    },
    {
        id: "efficient_10",
        rule: (user) => (user.stats?.totalWins ?? 0) >= 10 && (user.stats?.averageGuesses ?? Number.POSITIVE_INFINITY) <= 3,
    },
    {
        id: "games_25",
        rule: (user) => (user.stats?.gamesPlayed ?? 0) >= 25,
    },
    {
        id: "games_100",
        rule: (user) => (user.stats?.gamesPlayed ?? 0) >= 100,
    },
    {
        id: "streak_3",
        rule: (user) => (user.stats?.bestStreak ?? 0) >= 3,
    },
    {
        id: "streak_7",
        rule: (user) => (user.stats?.bestStreak ?? 0) >= 7,
    },
    {
        id: "streak_14",
        rule: (user) => (user.stats?.bestStreak ?? 0) >= 14,
    },
    {
        id: "streak_30",
        rule: (user) => (user.stats?.bestStreak ?? 0) >= 30,
    },
    {
        id: "classic_10",
        rule: (user) => (user.stats?.highestLevelClassic ?? 0) >= 10,
    },
    {
        id: "classic_25",
        rule: (user) => (user.stats?.highestLevelClassic ?? 0) >= 25,
    },
    {
        id: "classic_50",
        rule: (user) => (user.stats?.highestLevelClassic ?? 0) >= 50,
    },
    {
        id: "classic_100",
        rule: (user) => (user.stats?.highestLevelClassic ?? 0) >= 100,
    },
    {
        id: "daily_completed",
        rule: (user) => (user.stats?.dailyPuzzlesCompleted ?? 0) >= 1,
    },
    {
        id: "daily_7",
        rule: (user) => (user.stats?.dailyPuzzlesCompleted ?? 0) >= 7,
    },
    {
        id: "daily_30",
        rule: (user) => (user.stats?.dailyPuzzlesCompleted ?? 0) >= 30,
    },
    {
        id: "daily_100",
        rule: (user) => (user.stats?.dailyPuzzlesCompleted ?? 0) >= 100,
    },
    {
        id: "challenge_5",
        rule: (user) => (user.stats?.challengeWins ?? 0) >= 5,
    },
    {
        id: "challenge_25",
        rule: (user) => (user.stats?.challengeWins ?? 0) >= 25,
    },
    {
        id: "challenge_50",
        rule: (user) => (user.stats?.challengeWins ?? 0) >= 50,
    },
    {
        id: "perfect_guess",
        rule: (user, ctx) => ctx.isCorrect && ctx.attempts === 1,
    },
    {
        id: "classic_perfect",
        rule: (user, ctx) => ctx.gameMode === "classic" && ctx.isCorrect && ctx.attempts === 1,
    },
    {
        id: "challenge_perfect",
        rule: (user, ctx) => ctx.gameMode === "challenge" && ctx.isCorrect && ctx.attempts === 1,
    },
    {
        id: "last_chance",
        rule: (user, ctx) => {
            /** Provides max attempts behavior. */
            const maxAttempts = ctx.gameMode === "challenge" ? constants_1.MAX_ATTEMPTS_CHALLENGE : constants_1.MAX_ATTEMPTS_CLASSIC;
            return ctx.isCorrect && ctx.attempts === maxAttempts;
        },
    },
    {
        id: "classic_last_chance",
        rule: (user, ctx) => ctx.gameMode === "classic" && ctx.isCorrect && ctx.attempts === constants_1.MAX_ATTEMPTS_CLASSIC,
    },
    {
        id: "challenge_last_chance",
        rule: (user, ctx) => ctx.gameMode === "challenge" && ctx.isCorrect && ctx.attempts === constants_1.MAX_ATTEMPTS_CHALLENGE,
    },
    {
        id: "lesson_learned",
        rule: (user, ctx) => ctx.gameOver && !ctx.isCorrect,
    },
    {
        id: "hint_user",
        rule: (user) => (user.stats?.totalHintsUsed ?? 0) >= 1,
    },
    {
        id: "hints_10",
        rule: (user) => (user.stats?.totalHintsUsed ?? 0) >= 10,
    },
    {
        id: "hints_25",
        rule: (user) => (user.stats?.totalHintsUsed ?? 0) >= 25,
    },
    {
        id: "level_5",
        rule: (user) => (user.stats?.level ?? 1) >= 5,
    },
    {
        id: "level_10",
        rule: (user) => (user.stats?.level ?? 1) >= 10,
    },
    {
        id: "level_20",
        rule: (user) => (user.stats?.level ?? 1) >= 20,
    },
    {
        id: "xp_1000",
        rule: (user) => (user.stats?.xp ?? 0) >= 1000,
    },
    {
        id: "xp_5000",
        rule: (user) => (user.stats?.xp ?? 0) >= 5000,
    },
    {
        id: "coin_hoarder",
        rule: (user) => (user.coins ?? 0) >= 1000,
    },
    {
        id: "treasure_vault",
        rule: (user) => (user.coins ?? 0) >= 2500,
    },
    {
        id: "first_purchase",
        rule: (user) => user.hasPurchasedApp === true,
    },
];
/** Computes new achievement records without performing any writes. */
function findNewAchievements(user, context, unlockedAt = Date.now()) {
    /** Provides existing ids behavior. */
    const existingIds = new Set((user.unlockedAchievements ?? []).map((entry) => entry.achievementId));
    /** Provides new entries behavior. */
    const newEntries = [];
    for (const { id, rule } of ACHIEVEMENT_RULES) {
        if (existingIds.has(id) || !rule(user, context))
            continue;
        newEntries.push({ achievementId: id, unlockedAt });
        existingIds.add(id);
    }
    return newEntries;
}
/**
 * Evaluates all achievement rules against the current user document and appends
 * any newly unlocked achievements. Call after stats/progress have been updated.
 *
 * @param userId - The user's ID.
 * @param context - Game context (gameMode, isCorrect, attempts, gameOver).
 * @returns List of achievement IDs that were newly unlocked (may be empty).
 */
async function evaluateAchievements(userId, context) {
    try {
        /** Provides r. */
        const user = await (0, firestoreService_1.getUser)(userId);
        if (!user) {
            functions.logger.warn(`evaluateAchievements: user ${userId} not found`);
            return [];
        }
        /** Provides new entries behavior. */
        const newEntries = findNewAchievements(user, context);
        if (newEntries.length === 0)
            return [];
        await (0, firestoreService_1.appendUnlockedAchievements)(userId, newEntries);
        return newEntries.map((e) => e.achievementId);
    }
    catch (error) {
        functions.logger.error(`evaluateAchievements: error for user ${userId}:`, error);
        (0, sentry_1.captureException)(error, { userId, context });
        return [];
    }
}
//# sourceMappingURL=achievements.js.map