import {splitGraphemes} from "@riddle-quest/core/game";
import {YOUTUBE_ANSWER_MAX_GRAPHEMES} from "./limits";
import type {
  YouTubeActiveGame,
  YouTubeOperationReceipt,
  YouTubeProgress,
  YouTubeSaveV1,
  YouTubeSavedGuess,
} from "./types";
/** Defines the youtube save schema version value. */
export const YOUTUBE_SAVE_SCHEMA_VERSION = 1 as const;
/** Defines the youtube save budget bytes value. */
export const YOUTUBE_SAVE_BUDGET_BYTES = 60 * 1024;
/** Defines the youtube receipt limit value. */
export const YOUTUBE_RECEIPT_LIMIT = 64;
/** Defines the day pattern value. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
/** Defines the id pattern value. */
const ID_PATTERN = /^[\p{L}\p{M}\p{N}_.:@/-]+$/u;
/** Defines the answer grapheme pattern value. */
const ANSWER_GRAPHEME_PATTERN = /^[\p{L}\p{M}]+$/u;
/** Renders the feedback interface. */
const FEEDBACK = new Set(["green", "yellow", "red"]);
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** Indicates whether has only keys. */
const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  /** Provides allowed behavior. */
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
};
/** Indicates whether is safe non negative integer. */
const isSafeNonNegativeInteger = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
/** Indicates whether is boolean. */
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
/** Indicates whether is bounded id. */
const isBoundedId = (value: unknown, maximum = 200): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maximum && ID_PATTERN.test(value);
/** Indicates whether is day. */
const isDay = (value: unknown): value is string => {
  if (typeof value !== "string" || !DAY_PATTERN.test(value)) return false;
  /** Parses d. */
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
/** Parses string array. */
const parseStringArray = (
  value: unknown,
  maximumLength: number,
  item: (entry: unknown) => entry is string,
): string[] | null => {
  // Do not pass the predicate directly to Array.every: its index argument
  // would otherwise override bounded validators' optional maximum parameter.
  if (!Array.isArray(value) || value.length > maximumLength || !value.every((entry) => item(entry))) return null;
  return [...value];
};
/** Parses progression. */
const parseProgression = (value: unknown): YouTubeProgress | null => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "coins",
      "xp",
      "level",
      "classicIndex",
      "gamesPlayed",
      "totalWins",
      "challengeWins",
      "dailyPuzzlesCompleted",
      "currentDailyStreak",
      "bestDailyStreak",
      "lastDailyCompletedDate",
      "totalGuesses",
      "totalGuessesInWins",
      "totalHintsUsed",
      "highestClassicLevel",
      "unlockedAchievementIds",
    ])
  )
    return null;
  /** Provides integer keys behavior. */
  const integerKeys = [
    "coins",
    "xp",
    "classicIndex",
    "gamesPlayed",
    "totalWins",
    "challengeWins",
    "dailyPuzzlesCompleted",
    "currentDailyStreak",
    "bestDailyStreak",
    "totalGuesses",
    "totalGuessesInWins",
    "totalHintsUsed",
    "highestClassicLevel",
  ] as const;
  if (!integerKeys.every((key) => isSafeNonNegativeInteger(value[key], 1_000_000_000))) return null;
  if (!isSafeNonNegativeInteger(value.level, 1_000_000) || value.level < 1) return null;
  if (value.lastDailyCompletedDate !== undefined && !isDay(value.lastDailyCompletedDate)) return null;
  /** Provides unlocked achievement ids behavior. */
  const unlockedAchievementIds = parseStringArray(value.unlockedAchievementIds, 64, isBoundedId);
  if (!unlockedAchievementIds || new Set(unlockedAchievementIds).size !== unlockedAchievementIds.length) return null;
  /** Provides numbers behavior. */
  const numbers = value as Record<(typeof integerKeys)[number] | "level", number>;
  if (
    numbers.totalWins > numbers.gamesPlayed ||
    numbers.challengeWins > numbers.totalWins ||
    numbers.totalGuessesInWins > numbers.totalGuesses ||
    numbers.bestDailyStreak < numbers.currentDailyStreak
  )
    return null;

  return {
    coins: numbers.coins,
    xp: numbers.xp,
    level: numbers.level,
    classicIndex: numbers.classicIndex,
    gamesPlayed: numbers.gamesPlayed,
    totalWins: numbers.totalWins,
    challengeWins: numbers.challengeWins,
    dailyPuzzlesCompleted: numbers.dailyPuzzlesCompleted,
    currentDailyStreak: numbers.currentDailyStreak,
    bestDailyStreak: numbers.bestDailyStreak,
    ...(value.lastDailyCompletedDate ? {lastDailyCompletedDate: value.lastDailyCompletedDate} : {}),
    totalGuesses: numbers.totalGuesses,
    totalGuessesInWins: numbers.totalGuessesInWins,
    totalHintsUsed: numbers.totalHintsUsed,
    highestClassicLevel: numbers.highestClassicLevel,
    unlockedAchievementIds,
  };
};
/** Parses letters. */
const parseLetters = (value: unknown): string[] | null => {
  /** Provides letters behavior. */
  const letters = parseStringArray(
    value,
    7,
    (entry): entry is string =>
      typeof entry === "string" &&
      (entry === "" ||
        (entry === entry.normalize("NFC") &&
          splitGraphemes(entry).length === 1 &&
          ANSWER_GRAPHEME_PATTERN.test(entry))),
  );
  return letters;
};
/** Parses guess. */
const parseGuess = (value: unknown): YouTubeSavedGuess | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["letters", "feedback"])) return null;
  /** Provides letters behavior. */
  const letters = parseLetters(value.letters);
  if (!letters || letters.some((letter) => !letter)) return null;
  if (
    !Array.isArray(value.feedback) ||
    value.feedback.length !== letters.length ||
    !value.feedback.every((entry) => typeof entry === "string" && FEEDBACK.has(entry))
  )
    return null;
  return {letters, feedback: value.feedback as YouTubeSavedGuess["feedback"]};
};
/** Parses active game. */
const parseActiveGame = (value: unknown, envelopeRevision: number): YouTubeActiveGame | null => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "sessionRevision",
      "mode",
      "riddleId",
      "contentFingerprint",
      "dailyDate",
      "hintRevealedIndices",
      "guesses",
      "attemptsUsed",
      "hasUsedContinue",
      "awaitingContinue",
    ])
  )
    return null;
  if (value.mode !== "classic" && value.mode !== "daily") return null;
  if (!isSafeNonNegativeInteger(value.sessionRevision, envelopeRevision) || value.sessionRevision < 1) return null;
  if (!isBoundedId(value.riddleId, 160) || !isBoundedId(value.contentFingerprint, 160)) return null;
  if (value.dailyDate !== undefined && !isDay(value.dailyDate)) return null;
  if ((value.mode === "daily") !== (typeof value.dailyDate === "string")) return null;
  if (
    !Array.isArray(value.hintRevealedIndices) ||
    value.hintRevealedIndices.length > YOUTUBE_ANSWER_MAX_GRAPHEMES ||
    !value.hintRevealedIndices.every((index) => isSafeNonNegativeInteger(index, YOUTUBE_ANSWER_MAX_GRAPHEMES - 1)) ||
    new Set(value.hintRevealedIndices).size !== value.hintRevealedIndices.length
  )
    return null;
  if (!Array.isArray(value.guesses) || value.guesses.length > 6) return null;
  /** Provides guesses behavior. */
  const guesses = value.guesses.map(parseGuess);
  // Each row is self-validating. Historical rows may have a different length
  // after the SDK locale changes the localized answer for the same canonical
  // active puzzle; rejecting that history would incorrectly unlock the mode.
  if (guesses.some((guess) => guess === null)) return null;
  if (!isSafeNonNegativeInteger(value.attemptsUsed, 6) || value.attemptsUsed !== guesses.length) return null;
  if (!isBoolean(value.hasUsedContinue) || !isBoolean(value.awaitingContinue)) return null;
  /** Provides valid attempt state behavior. */
  const validAttemptState = value.awaitingContinue
    ? value.attemptsUsed === 5 && value.hasUsedContinue === false
    : value.hasUsedContinue
      ? value.attemptsUsed === 5
      : value.attemptsUsed <= 4;
  if (!validAttemptState) return null;

  return {
    sessionRevision: value.sessionRevision,
    mode: value.mode,
    riddleId: value.riddleId,
    contentFingerprint: value.contentFingerprint,
    ...(value.dailyDate ? {dailyDate: value.dailyDate} : {}),
    hintRevealedIndices: [...value.hintRevealedIndices] as number[],
    guesses: guesses as YouTubeSavedGuess[],
    attemptsUsed: value.attemptsUsed,
    hasUsedContinue: value.hasUsedContinue,
    awaitingContinue: value.awaitingContinue,
  };
};
/** Parses receipts. */
const parseReceipts = (value: unknown, revision: number): YouTubeOperationReceipt[] | null => {
  if (!Array.isArray(value) || value.length > YOUTUBE_RECEIPT_LIMIT) return null;
  /** Provides receipts behavior. */
  const receipts: YouTubeOperationReceipt[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      !hasOnlyKeys(entry, ["id", "revision"]) ||
      !isBoundedId(entry.id) ||
      !isSafeNonNegativeInteger(entry.revision, revision)
    )
      return null;
    receipts.push({id: entry.id, revision: entry.revision});
  }
  return new Set(receipts.map(({id}) => id)).size === receipts.length ? receipts : null;
};
/** Parses preferences. */
const parsePreferences = (value: unknown): YouTubeSaveV1["preferences"] | null => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["reducedMotion", "highContrast", "guidanceComplete"]) ||
    !isBoolean(value.reducedMotion) ||
    !isBoolean(value.highContrast) ||
    !isBoolean(value.guidanceComplete)
  )
    return null;
  return {
    reducedMotion: value.reducedMotion,
    highContrast: value.highContrast,
    guidanceComplete: value.guidanceComplete,
  };
};
/** Describes you tube save parse result. */
export type YouTubeSaveParseResult =
  | {
      /** Stores kind. */
      kind: "empty";
      /** Stores save. */
      save: YouTubeSaveV1;
    }
  | {
      /** Stores kind. */
      kind: "valid";
      /** Stores save. */
      save: YouTubeSaveV1;
      /** Stores recovered active game. */
      recoveredActiveGame?: true;
      /** Stores migrated from schema version. */
      migratedFromSchemaVersion?: 0;
    }
  | {
      /** Stores kind. */
      kind: "invalid";
      /** Stores reason. */
      reason: string;
      /** Stores raw. */
      raw: string;
    }
  | {
      /** Stores kind. */
      kind: "future-version";
      /** Stores schema version. */
      schemaVersion: number;
      /** Stores raw. */
      raw: string;
    };
/** Creates the target-scoped initial state after an empty, successful SDK load. */
export function createEmptyYouTubeSave(contentVersion: string): YouTubeSaveV1 {
  return {
    schemaVersion: YOUTUBE_SAVE_SCHEMA_VERSION,
    revision: 0,
    contentVersion,
    progression: {
      coins: 300,
      xp: 0,
      level: 1,
      classicIndex: 0,
      gamesPlayed: 0,
      totalWins: 0,
      challengeWins: 0,
      dailyPuzzlesCompleted: 0,
      currentDailyStreak: 0,
      bestDailyStreak: 0,
      totalGuesses: 0,
      totalGuessesInWins: 0,
      totalHintsUsed: 0,
      highestClassicLevel: 0,
      unlockedAchievementIds: [],
    },
    activeGame: null,
    operationReceipts: [],
    preferences: {reducedMotion: false, highContrast: false, guidanceComplete: false},
  };
}
/** Parses only this target's exact schema; unknown/future data is retained for explicit reset. */
export function parseYouTubeSave(raw: string, contentVersion: string): YouTubeSaveParseResult {
  if (raw === "") return {kind: "empty", save: createEmptyYouTubeSave(contentVersion)};
  // The SDK defines save strings as UTF-16; count code units, not UTF-8 transport bytes.
  if (raw.length * 2 >= YOUTUBE_SAVE_BUDGET_BYTES) {
    return {kind: "invalid", reason: "save-too-large", raw};
  }
  /** Provides value behavior. */
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {kind: "invalid", reason: "save-json-invalid", raw};
  }
  if (!isRecord(value)) return {kind: "invalid", reason: "save-envelope-invalid", raw};
  /** Provides envelope behavior. */
  let envelope: Record<string, unknown> = value;
  if (typeof envelope.schemaVersion === "number" && envelope.schemaVersion > YOUTUBE_SAVE_SCHEMA_VERSION) {
    return {kind: "future-version", schemaVersion: envelope.schemaVersion, raw};
  }
  /** Provides migrated from schema version behavior. */
  let migratedFromSchemaVersion: 0 | undefined;
  if (envelope.schemaVersion === 0) {
    if (
      !hasOnlyKeys(envelope, [
        "schemaVersion",
        "revision",
        "contentVersion",
        "progression",
        "activeGame",
        "operationReceipts",
      ])
    )
      return {kind: "invalid", reason: "save-envelope-invalid", raw};
    envelope = {
      ...envelope,
      schemaVersion: 1,
      preferences: {reducedMotion: false, highContrast: false, guidanceComplete: false},
    };
    migratedFromSchemaVersion = 0;
  }
  if (
    envelope.schemaVersion !== YOUTUBE_SAVE_SCHEMA_VERSION ||
    !hasOnlyKeys(envelope, [
      "schemaVersion",
      "revision",
      "contentVersion",
      "progression",
      "activeGame",
      "operationReceipts",
      "preferences",
    ])
  )
    return {kind: "invalid", reason: "save-envelope-invalid", raw};
  if (!isSafeNonNegativeInteger(envelope.revision) || !isBoundedId(envelope.contentVersion, 160)) {
    return {kind: "invalid", reason: "save-metadata-invalid", raw};
  }
  /** Provides progression behavior. */
  const progression = parseProgression(envelope.progression);
  /** Provides active game behavior. */
  const activeGame = envelope.activeGame === null ? null : parseActiveGame(envelope.activeGame, envelope.revision);
  /** Provides operation receipts behavior. */
  const operationReceipts = parseReceipts(envelope.operationReceipts, envelope.revision);
  /** Provides preferences behavior. */
  const preferences = parsePreferences(envelope.preferences);
  if (!progression || !operationReceipts || !preferences) {
    return {kind: "invalid", reason: "save-state-invalid", raw};
  }
  // Active-puzzle state is a disposable resume cache. Preserve valid durable
  // progression when only that nested record is corrupt, then save a sanitized
  // document before gameplay becomes interactive.
  /** Provides recovered active game behavior. */
  const recoveredActiveGame = envelope.activeGame !== null && activeGame === null;

  return {
    kind: "valid",
    save: {
      schemaVersion: 1,
      revision: envelope.revision,
      contentVersion: envelope.contentVersion,
      progression,
      activeGame,
      operationReceipts,
      preferences,
    },
    ...(recoveredActiveGame ? {recoveredActiveGame: true as const} : {}),
    ...(migratedFromSchemaVersion === 0 ? {migratedFromSchemaVersion} : {}),
  };
}
/** Provides clone you tube save behavior. */
export function cloneYouTubeSave(save: YouTubeSaveV1): YouTubeSaveV1 {
  return JSON.parse(JSON.stringify(save)) as YouTubeSaveV1;
}
/** Serializes within the deliberately conservative Playables save budget. */
export function serializeYouTubeSave(save: YouTubeSaveV1): string {
  /** Serializes d. */
  const serialized = JSON.stringify(save);
  if (serialized.length * 2 >= YOUTUBE_SAVE_BUDGET_BYTES) {
    throw new Error("youtube-save-budget-exceeded");
  }
  return serialized;
}
/** Appends a bounded replay receipt to a newly staged revision. */
export function appendYouTubeReceipt(save: YouTubeSaveV1, id: string): void {
  if (!isBoundedId(id)) throw new Error("youtube-operation-id-invalid");
  save.operationReceipts = [
    ...save.operationReceipts.filter((receipt) => receipt.id !== id),
    {id, revision: save.revision},
  ].slice(-YOUTUBE_RECEIPT_LIMIT);
}
