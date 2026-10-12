"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJestUser = createJestUser;
exports.createReservedJestUser = createReservedJestUser;
const node_crypto_1 = require("node:crypto");
const usernameReservations_1 = require("../profile/usernameReservations");
/** Creates the initial server-authoritative profile for one Jest platform identity. */
function createJestUser(uid, playerId) {
    /** Provides now behavior. */
    const now = Date.now();
    /** Provides rname. */
    const username = `Jest ${(0, node_crypto_1.createHash)("sha256").update(playerId).digest("hex").slice(0, 19)}`;
    return {
        userId: uid,
        email: `${uid}@players.jest.invalid`,
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
/** Creates a Jest profile payload and atomically claims its generated username. */
function createReservedJestUser(transaction, db, uid, playerId) {
    /** Provides r. */
    const user = createJestUser(uid, playerId);
    /** Provides rname. */
    const username = String(user.username);
    return { ...user, ...(0, usernameReservations_1.reserveUsernameForNewUser)(transaction, db, uid, username) };
}
//# sourceMappingURL=jestUser.js.map