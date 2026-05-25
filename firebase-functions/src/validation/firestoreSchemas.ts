import {z} from "zod";
import * as admin from "firebase-admin";
import {validateUsernameForProfanity} from "../utils/profanityFilter";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export const signUpSchema = z
  .object({
    username: z
      .string()
      .min(1, "Username is required")
      .refine(
        (username) => {
          const profanityError = validateUsernameForProfanity(username);
          return profanityError === "";
        },
        {
          message: "Username contains inappropriate language. Please choose a different username.",
        },
      ),
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

type TimestampLike = {
  toMillis?: () => number;
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
};

const coerceTimestampToMillis = (value: unknown): unknown => {
  if (value == null || typeof value === "number") {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "object") {
    const timestampLike = value as TimestampLike;
    if (typeof timestampLike.toMillis === "function") {
      return timestampLike.toMillis();
    }
    if (typeof timestampLike.toDate === "function") {
      return timestampLike.toDate().getTime();
    }
    if (typeof timestampLike.seconds === "number") {
      const nanos = typeof timestampLike.nanoseconds === "number" ? timestampLike.nanoseconds : 0;
      return timestampLike.seconds * 1000 + Math.floor(nanos / 1_000_000);
    }
  }
  return value;
};

const TimestampAsMillisSchema = z.preprocess(coerceTimestampToMillis, z.number());

// Define the structure for player progress
export const PlayerProgressSchema = z.object({
  classicIndex: z.number().int().nonnegative().default(1),
  dailyChallengeIndex: z.number().int().nonnegative().default(0),
  dailyChallengeCurrentQuestion: z.number().int().nonnegative().default(0),
});

// Define the structure for player stats
export const PlayerStatsSchema = z.object({
  xp: z.number().int().nonnegative().default(0),
  level: z.number().int().positive().default(1),
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
  totalHintsUsed: z.number().int().nonnegative().default(0),
});

/** Single unlocked achievement record stored on the user document. */
export const UnlockedAchievementSchema = z.object({
  achievementId: z.string(),
  unlockedAt: z.number(),
});
export type UnlockedAchievement = z.infer<typeof UnlockedAchievementSchema>;

export const PlayerSchema = z.object({
  userId: z.string(),
  email: z.string().email().optional(),
  username: z.string().refine(
    (username) => {
      const profanityError = validateUsernameForProfanity(username);
      return profanityError === "";
    },
    {
      message: "Username contains inappropriate language. Please choose a different username.",
    },
  ),
  displayName: z.string().optional(), // Added displayName as per AuthContext usage
  avatarUrl: z.string().url().optional(),
  coins: z.number().int().nonnegative().default(0),
  hasPurchasedApp: z.boolean().optional().default(false), // Added hasPurchasedApp for IAP functionality
  createdAt: TimestampAsMillisSchema.optional(),
  registeredAt: TimestampAsMillisSchema.optional(),
  lastLogin: TimestampAsMillisSchema.optional(),
  lastDailyChallengeCompletedAt: TimestampAsMillisSchema.optional(),
  stats: PlayerStatsSchema.default(() => PlayerStatsSchema.parse({})), // Use nested stats schema
  progress: PlayerProgressSchema.default(() => PlayerProgressSchema.parse({})), // Use nested progress schema
  unlockedAchievements: z.array(UnlockedAchievementSchema).optional().default([]),
  fcmToken: z.string().optional(),
  fcmTokenUpdatedAt: TimestampAsMillisSchema.optional(),
  lastStreakReminderSentAt: TimestampAsMillisSchema.optional(),
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
  text: z.string(),
  answer: z.string().min(1),
  // Added optional fields that might be present in riddle documents
  category: z.string().optional(),
  timestamp: z.unknown().optional(),
});

// Schema for riddles in the main 'riddles' collection (classic mode)
export const ClassicRiddleSchema = z.object({
  riddleId: z.string(),
  text: z.string(),
  answer: z.string().min(1),
  classicIndex: z.number().int().nonnegative(),
  category: z.string().default("classic"),
});

// Schema for riddles in the 'dailyRiddles' collection
export const DailyRiddleSchema = z.object({
  riddleId: z.string(),
  text: z.string(),
  answer: z.string().min(1),
  dailyIndex: z.number().int().nonnegative(),
  category: z.string().default("daily"),
  timestamp: z.unknown(),
});

export type FirestoreRiddle = z.infer<typeof FirestoreRiddleSchema>;
export type ClassicRiddle = z.infer<typeof ClassicRiddleSchema>;
export type DailyRiddle = z.infer<typeof DailyRiddleSchema>;

// Collection names enum for consistency
export enum RiddleCollections {
  RIDDLES = "riddles",
  DAILY_RIDDLES = "dailyRiddles",
}

// Export PlayerProgress and PlayerStats types derived from schemas for consistency
export type PlayerProgress = z.infer<typeof PlayerProgressSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
