"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreRiddleSchema = exports.PlayerSchema = exports.signUpSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters long"),
});
exports.signUpSchema = zod_1.z
    .object({
    username: zod_1.z.string().min(1, "Username is required"),
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters long"),
    confirmPassword: zod_1.z.string(),
})
    .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});
// Define the structure for player progress
const PlayerProgressSchema = zod_1.z.object({
    classicIndex: zod_1.z.number().int().nonnegative().default(0),
    dailyChallengeIndex: zod_1.z.number().int().nonnegative().default(0),
    tutorialIndex: zod_1.z.number().int().nonnegative().default(0),
});
// Define the structure for player stats
const PlayerStatsSchema = zod_1.z.object({
    dailyPuzzlesCompleted: zod_1.z.number().int().nonnegative().default(0),
    bestStreak: zod_1.z.number().int().nonnegative().default(0),
    totalWordsGuessed: zod_1.z.number().int().nonnegative().default(0),
    winRate: zod_1.z.number().nonnegative().default(0), // Assuming winRate is calculated and stored
    averageGuesses: zod_1.z.number().nonnegative().default(0), // Assuming averageGuesses is calculated and stored
    totalScore: zod_1.z.number().int().nonnegative().default(0),
    highestLevelClassic: zod_1.z.number().int().nonnegative().default(0),
    gamesPlayed: zod_1.z.number().int().nonnegative().default(0),
    wins: zod_1.z.number().int().nonnegative().default(0), // Added wins to match common stats
    challengeWins: zod_1.z.number().int().nonnegative().default(0), // Added challengeWins
    winStreak: zod_1.z.number().int().nonnegative().default(0), // Add winStreak
    totalWins: zod_1.z.number().int().nonnegative().default(0), // Added totalWins for win rate calculation
    totalGuessesInWins: zod_1.z.number().int().nonnegative().default(0), // Added totalGuessesInWins for average guesses calculation
});
exports.PlayerSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    email: zod_1.z.string().email().optional(),
    username: zod_1.z.string(),
    displayName: zod_1.z.string().optional(), // Added displayName as per AuthContext usage
    avatarUrl: zod_1.z.string().url().optional(),
    xp: zod_1.z.number().int().nonnegative().default(0),
    coins: zod_1.z.number().int().nonnegative().default(0),
    createdAt: zod_1.z.number().optional(), // Assuming timestamp is stored as a number
    registeredAt: zod_1.z.number().optional(), // Assuming timestamp is stored as a number
    lastLogin: zod_1.z.number().optional(), // Assuming timestamp is stored as a number
    lastDailyChallengeCompletedAt: zod_1.z.number().optional(), // Assuming timestamp is stored as a number
    stats: PlayerStatsSchema.default({}), // Use nested stats schema
    progress: PlayerProgressSchema.default({}), // Use nested progress schema
    // currentRiddle is not part of the Player document in Firestore, should be managed client-side or in AuthContext state
});
exports.FirestoreRiddleSchema = zod_1.z.object({
    riddleId: zod_1.z.string(),
    dailyIndex: zod_1.z.number().int().nonnegative().optional(),
    classicIndex: zod_1.z.number().int().nonnegative().optional(),
    text: zod_1.z.string(),
    answer: zod_1.z.string().min(1),
    // Added optional fields that might be present in riddle documents
    difficulty: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
});
//# sourceMappingURL=firestoreSchemas.js.map