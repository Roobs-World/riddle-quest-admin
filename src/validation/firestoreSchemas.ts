import { z } from "zod";

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
  winRate: z.number().nonnegative().default(0),
  averageGuesses: z.number().nonnegative().default(0),
  totalScore: z.number().int().nonnegative().default(0),
  highestLevelClassic: z.number().int().nonnegative().default(0),
  gamesPlayed: z.number().int().nonnegative().default(0),
  wins: z.number().int().nonnegative().default(0),
  challengeWins: z.number().int().nonnegative().default(0),
  winStreak: z.number().int().nonnegative().default(0),
  totalWins: z.number().int().nonnegative().default(0),
  totalGuessesInWins: z.number().int().nonnegative().default(0),
});

export const PlayerSchema = z.object({
  userId: z.string(),
  email: z.string().email().optional(),
  username: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  xp: z.number().int().nonnegative().default(0),
  coins: z.number().int().nonnegative().default(0),
  createdAt: z.number().optional(),
  registeredAt: z.number().optional(),
  lastLogin: z.number().optional(),
  lastDailyChallengeCompletedAt: z.number().optional(),
  stats: PlayerStatsSchema.default({}),
  progress: PlayerProgressSchema.default({}),
  hasPurchasedApp: z.boolean().optional().default(false),
});

export type Player = z.infer<typeof PlayerSchema>;

export const FirestoreRiddleSchema = z.object({
  riddleId: z.string(),
  dailyIndex: z.number().int().nonnegative().optional(),
  classicIndex: z.number().int().nonnegative().optional(),
  text: z.string(),
  answer: z.string().min(1),
  difficulty: z.string().optional(),
  category: z.string().optional(),
});

export type FirestoreRiddle = z.infer<typeof FirestoreRiddleSchema>;

export type PlayerProgress = z.infer<typeof PlayerProgressSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
