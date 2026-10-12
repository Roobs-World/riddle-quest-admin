"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedditUser = createRedditUser;
exports.createReservedRedditUser = createReservedRedditUser;
const node_crypto_1 = require("node:crypto");
const usernameReservations_1 = require("../profile/usernameReservations");
/** Creates reddit user. */
function createRedditUser(uid) {
    /** Provides now behavior. */
    const now = Date.now();
    /** Provides rname. */
    const username = `Player ${(0, node_crypto_1.createHash)("sha256").update(uid).digest("hex").slice(0, 17)}`;
    return {
        userId: uid,
        email: `${uid}@players.reddit.invalid`,
        username,
        coins: 300,
        hasPurchasedApp: false,
        hasActiveSubscription: false,
        createdAt: now,
        registeredAt: now,
        lastLogin: now,
        preferredLanguage: "en",
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
        },
        progress: { classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0 },
        unlockedAchievements: [],
    };
}
/** Creates reserved reddit user. */
function createReservedRedditUser(transaction, db, uid) {
    /** Provides r. */
    const user = createRedditUser(uid);
    return { ...user, ...(0, usernameReservations_1.reserveUsernameForNewUser)(transaction, db, uid, String(user.username)) };
}
//# sourceMappingURL=redditUser.js.map