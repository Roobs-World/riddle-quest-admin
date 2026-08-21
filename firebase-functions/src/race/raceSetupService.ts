import {admin} from "../shared/firebaseAdmin";
import {createHash} from "node:crypto";
import {
  ListRaceCategoriesResponseSchema,
  RACE_CATEGORY_IDS,
  RACE_DECK_SIZE,
  RACE_RULES,
  RACE_SUPPORTED_LOCALES,
  RACE_TARGET_CORRECT,
  RaceChallengePreviewSchema,
  type ListRaceCategoriesResponse,
  type RaceCategory,
  type RaceCategoryId,
  type RaceLocale,
  type RaceChallengePreview,
} from "@qwordly/core/race";
import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import {
  type RaceRiddleSnapshot,
  type RaceRunRecord,
} from "./raceEngine";
import {RACE_POOL_SIZE, validateRacePool} from "./raceContentValidation";
import type {ExistingRaceContentRecord} from "./raceContentMigration";
import {evaluateRaceAchievementEvent, type RaceAchievementEvent} from "./raceAchievements";

/** Describes firestore. */
export type Firestore = FirebaseFirestore.Firestore;

/** Describes race challenge record. */
export type RaceChallengeRecord = {
  /** Stores challenge id. */
  challengeId: string;
  /** Stores creator id. */
  creatorId: string;
  /** Stores creator run id. */
  creatorRunId: string;
  /** Stores rivalry challenge id. */
  rivalryChallengeId?: string;
  /** Stores creator snapshot. */
  creatorSnapshot: {displayName: string; avatarUrl?: string | null};
  /** Stores category id. */
  categoryId: RaceCategoryId;
  /** Locale boundary for matching, rematches, and challenge acceptance. */
  locale: RaceLocale;
  /** Stores deck id. */
  deckId: string;
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
  const update = evaluateRaceAchievementEvent(userData, event, nowMs);
  transaction.set(userRef, {
    stats: update.stats,
    coins: update.newCoins,
    ...(update.unlockedAchievementEntries.length > 0
      ? {unlockedAchievements: admin.firestore.FieldValue.arrayUnion(...update.unlockedAchievementEntries)}
      : {}),
  }, {merge: true});
  return update;
};

/** Provides stable hash behavior. */
const stableHash = (value: string): string => createHash("sha256").update(value).digest("hex");

/** Requests document id. */
export const requestDocumentId = (userId: string, requestId: string): string => stableHash(`${userId}\u0000${requestId}`);

/** Defines the race action window ms value. */
const RACE_ACTION_WINDOW_MS = 10_000;
/** Defines the race action limit value. */
const RACE_ACTION_LIMIT = 30;

/** Applies action rate limit. */
export const applyActionRateLimit = (run: RaceRunRecord, userId: string, nowMs: number): RaceRunRecord => {
  const windowStartedAtMs = run.rateLimitWindowStartedAtMs ?? nowMs;
  const withinWindow = nowMs - windowStartedAtMs < RACE_ACTION_WINDOW_MS;
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
export const parseRunRecord = (value: FirebaseFirestore.DocumentData | undefined): RaceRunRecord => {
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
  return value as RaceRunRecord;
};

/** Parses challenge record. */
export const parseChallengeRecord = (value: FirebaseFirestore.DocumentData | undefined): RaceChallengeRecord => {
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
  const locale = value.locale === undefined ? "en" : value.locale;
  if (!(RACE_SUPPORTED_LOCALES as readonly unknown[]).includes(locale)) {
    throw new HttpsError("internal", "Stored Race to 10 challenge locale is invalid.");
  }
  return {...value, locale} as RaceChallengeRecord;
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
  let query: FirebaseFirestore.Query = getLocalizedCollection(db, locale).where("raceEligible", "==", true);
  if (categoryId) query = query.where("categoryId", "==", categoryId);
  const snapshot = await query.get();
  return snapshot.docs.map((document) => toContentRecord(locale, document));
}

/** Provides deterministic sort behavior. */
const deterministicSort = <T extends {data: {canonicalRiddleId?: unknown}}>(records: T[], seed: string): T[] =>
  [...records].sort((left, right) => {
    const leftId = String(left.data.canonicalRiddleId ?? "");
    const rightId = String(right.data.canonicalRiddleId ?? "");
    return stableHash(`${seed}:${leftId}`).localeCompare(stableHash(`${seed}:${rightId}`));
  });

/** Builds a balanced deterministic deck from a validated category pool. */
export function buildDeterministicRaceDeck(
  records: ExistingRaceContentRecord[],
  options: {locale: RaceLocale; categoryId: RaceCategoryId; seed: string},
): {riddles: RaceRiddleSnapshot[]; contentVersion: string} {
  const validation = validateRacePool(records, {
    locale: options.locale,
    categoryId: options.categoryId,
    poolSize: RACE_POOL_SIZE,
  });
  if (!validation.valid) {
    throw new HttpsError(
      "failed-precondition",
      `Race category is not ready: ${validation.issues.map((issue) => issue.code).join(", ")}`,
    );
  }

  const selected: ExistingRaceContentRecord[] = [];
  for (const difficultyBand of ["easy", "medium", "hard"] as const) {
    selected.push(
      ...deterministicSort(
        records.filter((record) => record.data.difficultyBand === difficultyBand),
        `${options.seed}:${difficultyBand}`,
      ).slice(0, RACE_DECK_SIZE / 3),
    );
  }
  const ordered = deterministicSort(selected, `${options.seed}:order`);
  if (ordered.length !== RACE_DECK_SIZE) {
    throw new HttpsError("failed-precondition", "Race category does not have a balanced 15-riddle deck.");
  }

  const riddles = ordered.map((record, position): RaceRiddleSnapshot => {
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
    };
  });
  const contentVersion = stableHash(
    riddles
      .map((riddle) => {
        const qualityVersion = records.find((record) => record.data.canonicalRiddleId === riddle.canonicalRiddleId)
          ?.data.qualityVersion;
        return `${riddle.canonicalRiddleId}:${String(qualityVersion ?? "unknown")}`;
      })
      .join("|"),
  ).slice(0, 24);
  return {riddles, contentVersion};
}

/** Resolves challenge riddles. */
export async function resolveChallengeRiddles(
  db: Firestore,
  locale: RaceLocale,
  challenge: RaceChallengeRecord,
): Promise<RaceRiddleSnapshot[]> {
  const snapshot = await getLocalizedCollection(db, locale)
    .where("canonicalRiddleId", "in", challenge.canonicalRiddleIds)
    .get();
  const byCanonical = new Map(snapshot.docs.map((document) => [document.data().canonicalRiddleId, document.data()]));
  return challenge.canonicalRiddleIds.map((canonicalRiddleId, position) => {
    const data = byCanonical.get(canonicalRiddleId);
    if (
      !data ||
      data.raceEligible !== true ||
      typeof data.riddleId !== "string" ||
      typeof data.text !== "string" ||
      typeof data.answer !== "string"
    ) {
      throw new HttpsError(
        "failed-precondition",
        `The challenge is unavailable in locale ${locale}; translation ${canonicalRiddleId} is missing.`,
      );
    }
    return {riddleId: data.riddleId, canonicalRiddleId, text: data.text, answer: data.answer, position};
  });
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
  const db = dbOrDefault(dbInput);
  const records = await loadEligibleContent(db, locale);
  const categories = RACE_CATEGORY_IDS.flatMap((categoryId): RaceCategory[] => {
    const validation = validateRacePool(records, {locale, categoryId});
    if (!validation.valid) return [];
    return [{categoryId, ...CATEGORY_PRESENTATION[categoryId], availableRiddleCount: validation.eligibleCount}];
  });
  return ListRaceCategoriesResponseSchema.parse({categories, rules: RACE_RULES});
}
