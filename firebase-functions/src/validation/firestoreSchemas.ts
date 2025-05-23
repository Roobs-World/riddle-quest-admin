import {z} from "zod";
import * as admin from "firebase-admin";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export const signUpSchema = z
  .object({
    username: z.string().min(1, "Username is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;

// Define the structure for player progress
const PlayerProgressSchema = z.object({
  classicIndex: z.number().int().nonnegative().default(0),
  dailyChallengeIndex: z.number().int().nonnegative().default(0),
  tutorialIndex: z.number().int().nonnegative().default(0),
});

// Define the structure for player stats
const PlayerStatsSchema = z.object({
  dailyPuzzlesCompleted: z.number().int().nonnegative().default(0),
  bestStreak: z.number().int().nonnegative().default(0),
  totalWordsGuessed: z.number().int().nonnegative().default(0),
  winRate: z.number().nonnegative().default(0), // Assuming winRate is calculated and stored
  averageGuesses: z.number().nonnegative().default(0), // Assuming averageGuesses is calculated and stored
  totalScore: z.number().int().nonnegative().default(0),
  highestLevelClassic: z.number().int().nonnegative().default(0),
  gamesPlayed: z.number().int().nonnegative().default(0),
  wins: z.number().int().nonnegative().default(0), // Added wins to match common stats
  challengeWins: z.number().int().nonnegative().default(0), // Added challengeWins
  winStreak: z.number().int().nonnegative().default(0), // Add winStreak
  totalWins: z.number().int().nonnegative().default(0), // Added totalWins for win rate calculation
  totalGuessesInWins: z.number().int().nonnegative().default(0), // Added totalGuessesInWins for average guesses calculation
});

export const PlayerSchema = z.object({
  userId: z.string(),
  email: z.string().email().optional(),
  username: z.string(),
  displayName: z.string().optional(), // Added displayName as per AuthContext usage
  avatarUrl: z.string().url().optional(),
  xp: z.number().int().nonnegative().default(0),
  coins: z.number().int().nonnegative().default(0),
  createdAt: z.number().optional(), // Assuming timestamp is stored as a number
  registeredAt: z.number().optional(), // Assuming timestamp is stored as a number
  lastLogin: z.number().optional(), // Assuming timestamp is stored as a number
  lastDailyChallengeCompletedAt: z.number().optional(), // Assuming timestamp is stored as a number
  stats: PlayerStatsSchema.default({}), // Use nested stats schema
  progress: PlayerProgressSchema.default({}), // Use nested progress schema
  // currentRiddle is not part of the Player document in Firestore, should be managed client-side or in AuthContext state
});

export type Player = z.infer<typeof PlayerSchema>;

export type PlayerStatsUpdate = {
  [key in keyof PlayerStats]?: PlayerStats[key] | admin.firestore.FieldValue;
};

export type PlayerProgressUpdate = {
  [key in keyof PlayerProgress]?: PlayerProgress[key] | admin.firestore.FieldValue;
};

export const FirestoreRiddleSchema = z.object({
  riddleId: z.string(),
  dailyIndex: z.number().int().nonnegative().optional(),
  classicIndex: z.number().int().nonnegative().optional(),
  text: z.string(),
  answer: z.string().min(1),
  // Added optional fields that might be present in riddle documents
  difficulty: z.string().optional(),
  category: z.string().optional(),
});

export type FirestoreRiddle = z.infer<typeof FirestoreRiddleSchema>;

// Export PlayerProgress and PlayerStats types derived from schemas for consistency
export type PlayerProgress = z.infer<typeof PlayerProgressSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
