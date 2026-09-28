import {z} from "zod";
import {SUPPORTED_LOCALES} from "../validation/locales";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../game/limits";

/** Version identifier for the current authoritative multiplayer rules. */
export const RACE_RULES_VERSION = "race10_v1" as const;
/** Correct answers required to complete a Race to 10 run. */
export const RACE_TARGET_CORRECT = 10;
/** Riddles captured in each authoritative race deck. */
export const RACE_DECK_SIZE = 15;
/** Incorrect guesses allowed before a riddle is automatically skipped. */
export const RACE_MAX_GUESSES_PER_RIDDLE = 5;
/** Hints allowed for each race riddle. */
export const RACE_MAX_HINTS_PER_RIDDLE = MAX_RIDDLE_ANSWER_CHARACTERS;
/** Adjusted-time penalty added for using a hint. */
export const RACE_HINT_PENALTY_MS = 15_000;
/** Adjusted-time penalty added for skipping a riddle. */
export const RACE_SKIP_PENALTY_MS = 45_000;
/** Maximum adjusted duration of a competitive challenger run. */
export const RACE_MAX_ADJUSTED_TIME_MS = 300_000;
/** Duration for which a published race challenge remains active. */
export const RACE_CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
/** Stable identifiers for achievements granted by authoritative race events. */
export const RACE_ACHIEVEMENT_IDS = [
  "race_debut",
  "race_first_win",
  "race_wins_5",
  "race_wins_25",
  "race_host",
  "race_hosts_5",
  "race_clean_run",
] as const;
/** Schema for a supported multiplayer achievement identifier. */
export const RaceAchievementIdSchema = z.enum(RACE_ACHIEVEMENT_IDS);
/** Supported multiplayer achievement identifier. */
export type RaceAchievementId = z.infer<typeof RaceAchievementIdSchema>;
/** Stable identifiers for selectable multiplayer content categories. */
export const RACE_CATEGORY_IDS = ["history", "geography", "music", "film", "science", "mixed"] as const;
/** Locales currently supported by authoritative multiplayer content. */
export const RACE_SUPPORTED_LOCALES = SUPPORTED_LOCALES;

/** Schema for a supported multiplayer category identifier. */
export const RaceCategoryIdSchema = z.enum(RACE_CATEGORY_IDS);
/** Supported multiplayer category identifier. */
export type RaceCategoryId = z.infer<typeof RaceCategoryIdSchema>;
/** Schema for a locale supported by authoritative multiplayer. */
export const RaceLocaleSchema = z.enum(RACE_SUPPORTED_LOCALES);
/** Locale supported by authoritative multiplayer. */
export type RaceLocale = z.infer<typeof RaceLocaleSchema>;

/** Schema for a player's evaluated multiplayer rollout access. */
export const RaceAccessResponseSchema = z
  .object({
    enabled: z.boolean(),
    locale: RaceLocaleSchema,
    reason: z.enum(["enabled", "rollout_disabled", "not_in_cohort"]),
  })
  .strict();
/** Evaluated multiplayer rollout access returned to a player. */
export type RaceAccessResponse = z.infer<typeof RaceAccessResponseSchema>;

/** Schema for a locale-specific multiplayer access request. */
export const RaceAccessRequestSchema = z.object({locale: RaceLocaleSchema}).strict();
/** Validated multiplayer access request. */
export type RaceAccessRequest = z.infer<typeof RaceAccessRequestSchema>;

/** Schema for the content difficulty bands used to balance race decks. */
export const RaceDifficultyBandSchema = z.enum(["easy", "medium", "hard"]);
/** Content difficulty band used to balance race decks. */
export type RaceDifficultyBand = z.infer<typeof RaceDifficultyBandSchema>;

/** Schema for the review/version marker attached to race content. */
export const RaceContentQualityVersionSchema = z.string().trim().min(1).max(80);

/** Schema for the immutable rules included in race responses. */
export const RaceRulesSchema = z
  .object({
    version: z.literal(RACE_RULES_VERSION),
    targetCorrect: z.literal(RACE_TARGET_CORRECT),
    deckSize: z.literal(RACE_DECK_SIZE),
    maxGuessesPerRiddle: z.literal(RACE_MAX_GUESSES_PER_RIDDLE),
    /** Accept one-hint responses while an older server revision is still serving races. */
    maxHintsPerRiddle: z.union([z.literal(1), z.literal(RACE_MAX_HINTS_PER_RIDDLE)]),
    hintPenaltyMs: z.literal(RACE_HINT_PENALTY_MS),
    skipPenaltyMs: z.literal(RACE_SKIP_PENALTY_MS),
    maxAdjustedTimeMs: z.literal(RACE_MAX_ADJUSTED_TIME_MS),
  })
  .strict();
/** Immutable rules governing an authoritative race run. */
export type RaceRules = z.infer<typeof RaceRulesSchema>;

/** Frozen canonical rules used by the client and server. */
export const RACE_RULES: RaceRules = Object.freeze({
  version: RACE_RULES_VERSION,
  targetCorrect: RACE_TARGET_CORRECT,
  deckSize: RACE_DECK_SIZE,
  maxGuessesPerRiddle: RACE_MAX_GUESSES_PER_RIDDLE,
  maxHintsPerRiddle: RACE_MAX_HINTS_PER_RIDDLE,
  hintPenaltyMs: RACE_HINT_PENALTY_MS,
  skipPenaltyMs: RACE_SKIP_PENALTY_MS,
  maxAdjustedTimeMs: RACE_MAX_ADJUSTED_TIME_MS,
});

/** Schema for an answer-free multiplayer category summary. */
export const RaceCategorySchema = z
  .object({
    categoryId: RaceCategoryIdSchema,
    nameKey: z.string().min(1).max(120),
    descriptionKey: z.string().min(1).max(120),
    icon: z.enum(["history", "geography", "music", "film", "science", "shuffle"]),
    colorToken: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    availableRiddleCount: z.number().int().nonnegative(),
  })
  .strict();
/** Answer-free multiplayer category summary displayed by the client. */
export type RaceCategory = z.infer<typeof RaceCategorySchema>;
