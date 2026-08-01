import {z} from "zod";
import {validateUsernameForProfanity} from "./profanity";
import {SUPPORTED_LOCALES} from "./locales";
import {RaceCategoryIdSchema, RaceContentQualityVersionSchema, RaceDifficultyBandSchema} from "../race/raceSchemas";

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
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.getTime();
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

export const PlayerProgressSchema = z.object({
  classicIndex: z.number().int().nonnegative().default(1),
  dailyChallengeIndex: z.number().int().nonnegative().default(0),
  dailyChallengeCurrentQuestion: z.number().int().nonnegative().default(0),
});

export const PlayerStatsSchema = z.object({
  xp: z.number().int().nonnegative().default(0),
  level: z.number().int().positive().default(1),
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
  totalHintsUsed: z.number().int().nonnegative().default(0),
  multiplayerGamesPlayed: z.number().int().nonnegative().default(0),
  multiplayerWins: z.number().int().nonnegative().default(0),
  multiplayerChallengesCreated: z.number().int().nonnegative().default(0),
});

export const UnlockedAchievementSchema = z.object({
  achievementId: z.string(),
  unlockedAt: z.number(),
});
export type UnlockedAchievement = z.infer<typeof UnlockedAchievementSchema>;

export const PlayerSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  username: z.string().refine((username) => validateUsernameForProfanity(username) === "", {
    message: "Username contains inappropriate language. Please choose a different username.",
  }),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  preferredLanguage: z.enum(SUPPORTED_LOCALES).optional(),
  coins: z.number().int().nonnegative().default(0),
  createdAt: TimestampAsMillisSchema.optional(),
  registeredAt: TimestampAsMillisSchema.optional(),
  lastLogin: TimestampAsMillisSchema.optional(),
  lastDailyChallengeCompletedAt: TimestampAsMillisSchema.optional(),
  lastCompletedDailyChallengeKey: z.string().optional(),
  stats: PlayerStatsSchema.default(() => ({
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
  })),
  progress: PlayerProgressSchema.default(() => ({
    classicIndex: 1,
    dailyChallengeIndex: 0,
    dailyChallengeCurrentQuestion: 0,
  })),
  unlockedAchievements: z.array(UnlockedAchievementSchema).optional().default([]),
  hasPurchasedApp: z.boolean().optional().default(false),
  fcmToken: z.string().optional(),
  fcmTokenUpdatedAt: TimestampAsMillisSchema.optional(),
  lastStreakReminderSentAt: TimestampAsMillisSchema.optional(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const FirestoreRiddleSchema = z.object({
  riddleId: z.string(),
  canonicalRiddleId: z.string().min(1).max(160).optional(),
  canonicalKey: z.string().optional(),
  challengeKey: z.string().optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  dailyIndex: z.number().int().nonnegative().optional(),
  classicIndex: z.number().int().nonnegative().optional(),
  text: z.string(),
  answer: z.string().min(1),
  category: z.string().optional(),
  categoryId: RaceCategoryIdSchema.optional(),
  difficultyBand: RaceDifficultyBandSchema.optional(),
  raceEligible: z.boolean().optional(),
  qualityVersion: RaceContentQualityVersionSchema.optional(),
  timestamp: z.unknown().optional(),
});
export type FirestoreRiddle = z.infer<typeof FirestoreRiddleSchema>;

export const ClassicRiddleSchema = z.object({
  riddleId: z.string(),
  canonicalRiddleId: z.string().min(1).max(160).optional(),
  canonicalKey: z.string().optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  text: z.string(),
  answer: z.string().min(1),
  classicIndex: z.number().int().nonnegative(),
  category: z.string().default("classic"),
  categoryId: RaceCategoryIdSchema.optional(),
  difficultyBand: RaceDifficultyBandSchema.optional(),
  raceEligible: z.boolean().optional(),
  qualityVersion: RaceContentQualityVersionSchema.optional(),
});
export type ClassicRiddle = z.infer<typeof ClassicRiddleSchema>;

export const DailyRiddleSchema = z.object({
  riddleId: z.string(),
  canonicalRiddleId: z.string().min(1).max(160).optional(),
  canonicalKey: z.string().optional(),
  challengeKey: z.string().optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  text: z.string(),
  answer: z.string().min(1),
  dailyIndex: z.number().int().nonnegative(),
  category: z.string().default("daily"),
  categoryId: RaceCategoryIdSchema.optional(),
  difficultyBand: RaceDifficultyBandSchema.optional(),
  raceEligible: z.boolean().optional(),
  qualityVersion: RaceContentQualityVersionSchema.optional(),
  timestamp: z.unknown(),
});
export type DailyRiddle = z.infer<typeof DailyRiddleSchema>;

export const RiddleCollections = {
  RIDDLES: "riddles",
  DAILY_RIDDLES: "dailyRiddles",
} as const;

export const RegionalPriceSchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: z.string().min(1),
    displayPrice: z.string().min(1),
    symbol: z.string().min(1),
  })
  .passthrough();

export const SpecialOfferSchema = z
  .object({
    badgeText: z.string().min(1),
    description: z.string().min(1),
    discountPercentage: z.number().nonnegative(),
    isActive: z.boolean(),
    validFrom: z.number(),
    validTo: z.number(),
  })
  .passthrough();

export const ProductPricingSchema = z
  .object({
    productId: z.string().min(1),
    productKey: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    coins: z.number().int().nonnegative(),
    isActive: z.boolean(),
    sortOrder: z.number(),
    regionalPrices: z.array(RegionalPriceSchema).default([]),
    specialOffer: SpecialOfferSchema.optional(),
    featuredOrder: z.number().optional(),
    featuredBadge: z.string().optional(),
  })
  .passthrough();

export type RegionalPrice = z.infer<typeof RegionalPriceSchema>;
export type SpecialOffer = z.infer<typeof SpecialOfferSchema>;
export type ProductPricing = z.infer<typeof ProductPricingSchema>;
export type PlayerProgress = z.infer<typeof PlayerProgressSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
