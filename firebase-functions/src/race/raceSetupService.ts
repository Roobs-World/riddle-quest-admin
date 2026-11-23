import {assertRaceDeckCompatible} from "./raceDeckCompatibility";
import {admin} from "../shared/firebaseAdmin";
import {createHash} from "node:crypto";
import {
  ListRaceCategoriesResponseSchema,
  RACE_CATEGORY_IDS,
  RACE_DECK_SIZE,
  RACE_RULES,
  RaceRulesSchema,
  RACE_SUPPORTED_LOCALES,
  RACE_TARGET_CORRECT,
  RaceChallengePreviewSchema,
  type ListRaceCategoriesResponse,
  type RaceCategory,
  type RaceCategoryId,
  type RaceLocale,
  type RaceChallengePreview,
} from "@riddle-quest/core/race";
import {raceDeckContentVersion, validateRaceDeckSnapshot, assertRaceCreatorArchiveLink} from "./raceDeckSnapshot";
import {assertRaceStoredRecord} from "./raceStoredRecords";
import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import {type RaceRiddleSnapshot, type RaceRunRecord} from "./raceEngine";
import {RACE_DECK_DIFFICULTY_COUNTS, validateRacePool} from "./raceContentValidation";
import type {ExistingRaceContentRecord} from "./raceContentMigration";
import {evaluateRaceAchievementEvent, type RaceAchievementEvent} from "./raceAchievements";

/** Describes firestore. */
export type Firestore = FirebaseFirestore.Firestore;

/** Describes race challenge record. */
export type RaceChallengeRecord = {
  /** Storage contract revision; absent on supported legacy records. */
  recordVersion?: 1;
  /** Stores challenge id. */
  challengeId: string;
  /** Stores creator id. */
  creatorId: string;
  /** Stores creator run id. */
  creatorRunId: string;
  /** Stores rivalry challenge id. */
  rivalryChallengeId?: string;
  /** Stores creator snapshot. */
  creatorSnapshot: {
    /** Stores display name. */
    displayName: string; /** Stores avatar url. */
    /** Stores avatar url. */
    avatarUrl?: string | null;
  };
  /** Stores category id. */
  categoryId: RaceCategoryId;
  /** Locale boundary for matching, rematches, and challenge acceptance. */
  locale: RaceLocale;
  /** Stores deck id. */
  deckId: string;
  /** Public recording or private, recipient-bound invitation. */
  scope?: "public" | "invitation";
  /** Complete immutable content shared by creator and challenger. */
  riddles?: RaceRiddleSnapshot[];
  /** Exact snapshot hashing contract; absent on recoverable legacy challenges. */
  snapshotVersion?: 1;
  /** Server-selected answer exposure policy; never controlled by a challenger. */
  evaluationPolicy?: "preloaded" | "server-only";
  /** Stores canonical riddle ids. */
  canonicalRiddleIds: string[];
  /** Stores target correct. */
  targetCorrect: typeof RACE_TARGET_CORRECT;
  /** Stores creator wall finish ms. */
  creatorWallFinishMs: number;
  /** Stores creator hint penalty ms. */
  creatorHintPenaltyMs: number;
  /** Stores creator skip penalty ms. */
  creatorSkipPenaltyMs: number;
  /** Stores creator total penalty ms. */
  creatorTotalPenaltyMs: number;
  /** Stores creator adjusted finish ms. */
  creatorAdjustedFinishMs: number;
  /** Stores ghost events. */
  ghostEvents: RaceRunRecord["events"];
  /** Stores rules. */
  rules: typeof RACE_RULES;
  /** Stores content version. */
  contentVersion: string;
  /** Fixed difficulty-normalized performance of the original recording. */
  recordingPerformanceMs?: number;
  /** Stores status. */
  status: "active" | "expired" | "revoked";
  /** Stores created at ms. */
  createdAtMs: number;
  /** Stores expires at ms. */
  expiresAtMs: number;
  /** Stores expires at. */
  expiresAt: FirebaseFirestore.Timestamp;
};

/** Describes race deck record. */
export type RaceDeckRecord = {
  /** Stores deck id. */
  deckId: string;
  /** Stores category id. */
  categoryId: RaceCategoryId;
  /** Stores locale. */
  locale: RaceLocale;
  /** Stores canonical riddle ids. */
  canonicalRiddleIds: string[];
  /** Stores content version. */
  contentVersion: string;
  /** Stores rules version. */
  rulesVersion: typeof RACE_RULES.version;
  /** Stores created at ms. */
  createdAtMs: number;
  /** Stores expires at. */
  expiresAt: FirebaseFirestore.Timestamp;
};

/** Defines the category presentation value. */
const CATEGORY_PRESENTATION: Record<
  RaceCategoryId,
  Pick<RaceCategory, "nameKey" | "descriptionKey" | "icon" | "colorToken">
> = {
  history: {
    nameKey: "RaceTo10.CATEGORY_HISTORY_NAME",
    descriptionKey: "RaceTo10.CATEGORY_HISTORY_DESCRIPTION",
    icon: "history",
    colorToken: "#2E8B57",
  },
  geography: {
    nameKey: "RaceTo10.CATEGORY_GEOGRAPHY_NAME",
    descriptionKey: "RaceTo10.CATEGORY_GEOGRAPHY_DESCRIPTION",
    icon: "geography",
    colorToken: "#286B8E",
  },
  music: {
    nameKey: "RaceTo10.CATEGORY_MUSIC_NAME",
    descriptionKey: "RaceTo10.CATEGORY_MUSIC_DESCRIPTION",
    icon: "music",
    colorToken: "#6847A5",
  },
  film: {
    nameKey: "RaceTo10.CATEGORY_FILM_NAME",
    descriptionKey: "RaceTo10.CATEGORY_FILM_DESCRIPTION",
    icon: "film",
    colorToken: "#247A55",
  },
  science: {
    nameKey: "RaceTo10.CATEGORY_SCIENCE_NAME",
    descriptionKey: "RaceTo10.CATEGORY_SCIENCE_DESCRIPTION",
    icon: "science",
    colorToken: "#A46712",
  },
  mixed: {
    nameKey: "RaceTo10.CATEGORY_MIXED_NAME",
    descriptionKey: "RaceTo10.CATEGORY_MIXED_DESCRIPTION",
    icon: "shuffle",
    colorToken: "#A43B4D",
  },
};

/** Provides db or default behavior. */
export const dbOrDefault = (db?: Firestore): Firestore => db ?? admin.firestore();

/** Provides persist race achievement event behavior. */
export const persistRaceAchievementEvent = (
  transaction: FirebaseFirestore.Transaction,
  userRef: FirebaseFirestore.DocumentReference,
  userData: FirebaseFirestore.DocumentData,
  event: RaceAchievementEvent,
  nowMs: number,
) => {
  /** Provides update behavior. */
  const update = prepareRaceAchievementEvent(userData, event, nowMs);
  transaction.set(
    userRef,
    {
      stats: update.stats,
      coins: update.newCoins,
      ...(update.unlockedAchievementEntries.length > 0
        ? {unlockedAchievements: admin.firestore.FieldValue.arrayUnion(...update.unlockedAchievementEntries)}
        : {}),
    },
    {merge: true},
  );
  return update;
};

/** Plans a grant against canonical currency for both response projection and transactional persistence. */
export function prepareRaceAchievementEvent(userData: FirebaseFirestore.DocumentData, event: RaceAchievementEvent, nowMs: number) {
  // Account currency is authority: malformed values must never be normalized into lost funds.
  readRaceCoinBalance(userData);
  /** The same checked proposal supplies the public balance and persisted grant. */
  const update = evaluateRaceAchievementEvent(userData, event, nowMs);
  if (!Number.isSafeInteger(update.newCoins) || update.newCoins < 0)
    throw new HttpsError("data-loss", "Stored race currency is invalid.");
  return update;
}

/** Reads canonical currency without coercion; missing legacy balances retain their zero default. */
export function readRaceCoinBalance(userData: FirebaseFirestore.DocumentData): number {
  /** A present malformed value is distinct from an absent historical balance. */
  const coins = userData.coins === undefined ? 0 : userData.coins;
  if (typeof coins !== "number" || !Number.isSafeInteger(coins) || coins < 0)
    throw new HttpsError("data-loss", "Stored race currency is invalid.");
  return coins;
}

/** Provides stable hash behavior. */
const stableHash = (value: string): string => createHash("sha256").update(value).digest("hex");

/** Requests document id. */
export const requestDocumentId = (userId: string, requestId: string): string =>
  stableHash(`${userId}\u0000${requestId}`);

/** Defines the race action window ms value. */
const RACE_ACTION_WINDOW_MS = 10_000;
/** Defines the race action limit value. */
const RACE_ACTION_LIMIT = 30;

/** Applies action rate limit. */
export const applyActionRateLimit = (run: RaceRunRecord, userId: string, nowMs: number): RaceRunRecord => {
  /** Provides window started at ms behavior. */
  const windowStartedAtMs = run.rateLimitWindowStartedAtMs ?? nowMs;
  /** Runs in window. */
  const withinWindow = nowMs - windowStartedAtMs < RACE_ACTION_WINDOW_MS;
  /** Provides rate limit action count behavior. */
  const rateLimitActionCount = withinWindow ? (run.rateLimitActionCount ?? 0) + 1 : 1;
  if (rateLimitActionCount > RACE_ACTION_LIMIT) {
    logger.warn("Race action rate limit exceeded", {
      runId: run.runId,
      userHash: stableHash(userId).slice(0, 12),
      actionCount: rateLimitActionCount,
    });
    throw new HttpsError("resource-exhausted", "Too many race actions. Please wait a moment and retry.");
  }
  return {
    ...run,
    rateLimitWindowStartedAtMs: withinWindow ? windowStartedAtMs : nowMs,
    rateLimitActionCount,
  };
};

/** Provides strip undefined behavior. */
export const stripUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (value && typeof value === "object") {
    /** Provides prototype behavior. */
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)]),
    ) as T;
  }
  return value;
};

/** Parses run record. */
export const parseRunRecord = (value: FirebaseFirestore.DocumentData | undefined, expectedId?: string): RaceRunRecord => {
  if (
    !value ||
    typeof value.runId !== "string" ||
    typeof value.userId !== "string" ||
    value.rulesVersion !== RACE_RULES.version ||
    !Array.isArray(value.riddles) ||
    !Array.isArray(value.events)
  ) {
    throw new HttpsError("internal", "Stored Race to 10 state is invalid.");
  }
  if (value.rulesSnapshot !== undefined) {
    /** Provides rules behavior. */
    const rules = RaceRulesSchema.safeParse(value.rulesSnapshot);
    if (!rules.success || rules.data.version !== value.rulesVersion) throw new HttpsError("data-loss", "Race rules snapshot is invalid.");
  }
  assertRaceStoredRecord(value, "run");
  if (expectedId !== undefined && value.runId !== expectedId) throw new HttpsError("data-loss", "Stored race run identity does not match its document.");
  return value as RaceRunRecord;
};

/** Parses challenge record. */
export const parseChallengeRecord = (value: FirebaseFirestore.DocumentData | undefined, expectedId?: string): RaceChallengeRecord => {
  if (
    !value ||
    typeof value.challengeId !== "string" ||
    typeof value.creatorId !== "string" ||
    !Array.isArray(value.canonicalRiddleIds) ||
    !Array.isArray(value.ghostEvents) ||
    value.rules?.version !== RACE_RULES.version
  ) {
    throw new HttpsError("internal", "Stored Race to 10 challenge is invalid.");
  }
  /** Provides locale behavior. */
  const locale = value.locale === undefined ? "en" : value.locale;
  if (!(RACE_SUPPORTED_LOCALES as readonly unknown[]).includes(locale)) {
    throw new HttpsError("internal", "Stored Race to 10 challenge locale is invalid.");
  }
  /** Provides rules behavior. */
  const rules = RaceRulesSchema.safeParse({...value.rules, maxHintsPerRiddle: value.rules.maxHintsPerRiddle ?? 1});
  if (!rules.success) throw new HttpsError("data-loss", "Race challenge rules are unsupported.");
  if (value.snapshotVersion !== undefined && value.snapshotVersion !== 1) {
    throw new HttpsError("data-loss", "Race deck snapshot version is unsupported.");
  }
  /** Provides normalized behavior. */
  const normalized = {...value, locale, rules: rules.data};
  assertRaceStoredRecord(normalized, "challenge");
  if (expectedId !== undefined && value.challengeId !== expectedId) throw new HttpsError("data-loss", "Stored race challenge identity does not match its document.");
  return normalized as RaceChallengeRecord;
};

/** Rejects challenge, rematch, and rivalry entry across locale boundaries. */
export const assertRaceLocaleCompatible = (challenge: RaceChallengeRecord, locale: RaceLocale): void => {
  if (challenge.locale !== locale) {
    throw new HttpsError("failed-precondition", "RaceTo10.ERROR_LOCALE_MISMATCH");
  }
};

/** Gets localized collection. */
const getLocalizedCollection = (db: Firestore, locale: RaceLocale) =>
  db.collection(`localizedRiddles/${locale}/riddles`);

/** Provides to content record behavior. */
const toContentRecord = (
  locale: RaceLocale,
  document: FirebaseFirestore.QueryDocumentSnapshot,
): ExistingRaceContentRecord => ({
  locale,
  documentPath: document.ref.path,
  data: document.data(),
});

/** Loads eligible content. */
export async function loadEligibleContent(
  db: Firestore,
  locale: RaceLocale,
  categoryId?: RaceCategoryId,
): Promise<ExistingRaceContentRecord[]> {
  /** Provides query behavior. */
  let query: FirebaseFirestore.Query = getLocalizedCollection(db, locale).where("raceEligible", "==", true);
  if (categoryId) query = query.where("categoryId", "==", categoryId);
  /** Retains all eligibility, validation and immutable-deck fields without loading unrelated catalog payload. */
  const snapshot = await query.select("riddleId", "canonicalRiddleId", "text", "answer", "categoryId", "difficultyBand", "raceEligible", "qualityVersion").get();
  return snapshot.docs.map((document) => toContentRecord(locale, document));
}

/** Provides deterministic sort behavior. */
const deterministicSort = <
  T extends {
    /** Stores data. */
    data: {
      /** Stores canonical riddle id. */
      canonicalRiddleId?: unknown;
    };
  },
>(
  records: T[],
  seed: string,
): T[] =>
  [...records].sort((left, right) => {
    /** Provides left id behavior. */
    const leftId = String(left.data.canonicalRiddleId ?? "");
    /** Provides right id behavior. */
    const rightId = String(right.data.canonicalRiddleId ?? "");
    return stableHash(`${seed}:${leftId}`).localeCompare(stableHash(`${seed}:${rightId}`));
  });

/** Builds a deterministic easy/medium deck from the validated category pool. */
export function buildDeterministicRaceDeck(
  records: ExistingRaceContentRecord[],
  options: {
    /** Stores locale. */
    locale: RaceLocale; /** Stores category id. */
    /** Stores category id. */
    categoryId: RaceCategoryId; /** Stores seed. */
    /** Stores seed. */
    seed: string;
  },
): {
  /** Stores riddles. */
  riddles: RaceRiddleSnapshot[]; /** Stores content version. */
  /** Stores content version. */
  contentVersion: string;
} {
  /** Provides validation behavior. */
  const validation = validateRacePool(records, {
    locale: options.locale,
    categoryId: options.categoryId,
  });
  if (!validation.valid) {
    throw new HttpsError(
      "failed-precondition",
      `Race category is not ready: ${validation.issues.map((issue) => issue.code).join(", ")}`,
    );
  }

  /** Selection is confined to the same eligible locale/category subset that passed validation. */
  const pool = records.filter(record => record.locale === options.locale && record.data.categoryId === options.categoryId && record.data.raceEligible === true);
  /** Provides selected behavior. */
  const selected: ExistingRaceContentRecord[] = [];
  for (const difficultyBand of ["easy", "medium"] as const) {
    selected.push(
      ...deterministicSort(
        pool.filter((record) => record.data.difficultyBand === difficultyBand),
        `${options.seed}:${difficultyBand}`,
      ).slice(0, RACE_DECK_DIFFICULTY_COUNTS[difficultyBand]),
    );
  }
  /** Provides ordered behavior. */
  const ordered = deterministicSort(selected, `${options.seed}:order`);
  if (ordered.length !== RACE_DECK_SIZE) {
    throw new HttpsError("failed-precondition", "Race category does not have enough easy and medium riddles.");
  }

  /** Provides riddles behavior. */
  const riddles = ordered.map((record, position): RaceRiddleSnapshot => {
    /** Provides data behavior. */
    const data = record.data;
    if (
      typeof data.riddleId !== "string" ||
      typeof data.canonicalRiddleId !== "string" ||
      typeof data.text !== "string" ||
      typeof data.answer !== "string"
    ) {
      throw new HttpsError("internal", `Race content is incomplete at ${record.documentPath}.`);
    }
    return {
      riddleId: data.riddleId,
      canonicalRiddleId: data.canonicalRiddleId,
      text: data.text,
      answer: data.answer,
      position,
      ...(["easy", "medium", "hard"].includes(String(data.difficultyBand)) ?
        {difficultyBand: data.difficultyBand as "easy" | "medium" | "hard"} : {}),
    };
  });
  /** Provides content version behavior. */
  const contentVersion = raceDeckContentVersion(riddles);
  return {riddles, contentVersion};
}

/** Resolves challenge riddles. */
export async function resolveChallengeRiddles(
  db: Firestore,
  locale: RaceLocale,
  challenge: RaceChallengeRecord,
  /** Optional admission transaction locks legacy content before any dependent seat write. */
  transaction?: FirebaseFirestore.Transaction,
): Promise<RaceRiddleSnapshot[]> {
  assertRaceLocaleCompatible(challenge, locale);
  if (challenge.riddles) {
    /** Integrity and playability are separate checks; neither rewrites the original snapshot. */
    const riddles = validateRaceDeckSnapshot(challenge.riddles, challenge.canonicalRiddleIds,
      challenge.snapshotVersion === 1 ? challenge.contentVersion : undefined);
    assertRaceDeckCompatible(riddles, locale);
    return riddles;
  }
  // Upgrade legacy challenges from the creator's authoritative snapshot. Never
  // reconstruct a competitive deck from mutable localized catalog documents.
  /** Canonical legacy source reference is bound to this recorded creator. */
  const creatorRef = db.doc(`raceRuns/${challenge.creatorRunId}`);
  /** Modern snapshots require no additional read; legacy content shares the caller's transaction when supplied. */
  const creator = transaction ? await transaction.get(creatorRef) : await creatorRef.get();
  /** Provides data behavior. */
  const data = creator.data();
  if (!creator.exists || data?.runId !== challenge.creatorRunId || data?.userId !== challenge.creatorId || data?.locale !== locale) {
    throw new HttpsError("failed-precondition", "The original challenge deck is unavailable.");
  }
  /** Legacy recovery consumes a validated source rather than a same-owner partial document. */
  const original = parseRunRecord(data, challenge.creatorRunId);
  assertRaceCreatorArchiveLink(original, challenge);
  /** Legacy hydration must also be compatible before a new competitive attempt can consume it. */
  const riddles = validateRaceDeckSnapshot(original.riddles, challenge.canonicalRiddleIds);
  assertRaceDeckCompatible(riddles, locale);
  return riddles;
}

/** Provides challenge preview behavior. */
export const challengePreview = (challenge: RaceChallengeRecord, nowMs: number): RaceChallengePreview =>
  RaceChallengePreviewSchema.parse({
    challengeId: challenge.challengeId,
    rivalryChallengeId: challenge.rivalryChallengeId,
    creator: challenge.creatorSnapshot,
    categoryId: challenge.categoryId,
    locale: challenge.locale,
    targetCorrect: challenge.targetCorrect,
    adjustedTimeToBeatMs: challenge.creatorAdjustedFinishMs,
    rulesVersion: challenge.rules.version,
    expiresAtMs: challenge.expiresAtMs,
    status: challenge.status === "active" && nowMs >= challenge.expiresAtMs ? "expired" : challenge.status,
  });

/** Lists race categories for locale. */
export async function listRaceCategoriesForLocale(
  locale: RaceLocale,
  dbInput?: Firestore,
): Promise<ListRaceCategoriesResponse> {
  /** Provides db behavior. */
  const db = dbOrDefault(dbInput);
  /** Records s. */
  const records = await loadEligibleContent(db, locale);
  /** Provides categories behavior. */
  const categories = RACE_CATEGORY_IDS.flatMap((categoryId): RaceCategory[] => {
    /** Provides validation behavior. */
    const validation = validateRacePool(records, {locale, categoryId});
    if (!validation.valid) return [];
    return [{categoryId, ...CATEGORY_PRESENTATION[categoryId], availableRiddleCount: validation.eligibleCount}];
  });
  return ListRaceCategoriesResponseSchema.parse({categories, rules: RACE_RULES});
}
