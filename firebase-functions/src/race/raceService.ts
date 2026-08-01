import {admin} from "../shared/firebaseAdmin";
import {createHash} from "node:crypto";
import {
  AbandonRaceRunResponseSchema,
  ListRaceCategoriesResponseSchema,
  ListRaceInboxResponseSchema,
  PublishRaceChallengeResponseSchema,
  RACE_CATEGORY_IDS,
  RACE_CHALLENGE_TTL_MS,
  RACE_DECK_SIZE,
  RACE_RULES,
  RACE_TARGET_CORRECT,
  RaceChallengePreviewSchema,
  RaceInboxItemSchema,
  RaceOutcomeSchema,
  RaceRunResponseSchema,
  RequestRaceHintResponseSchema,
  SkipRaceRiddleResponseSchema,
  SubmitRaceGuessResponseSchema,
  type ListRaceCategoriesResponse,
  type AbandonRaceRunRequest,
  type AbandonRaceRunResponse,
  type ListRaceInboxRequest,
  type ListRaceInboxResponse,
  type PublishRaceChallengeRequest,
  type PublishRaceChallengeResponse,
  type RaceCategory,
  type RaceCategoryId,
  type RaceLocale,
  type RaceChallengePreview,
  type RaceOutcome,
  type RaceRunResponse,
  type RequestRaceHintRequest,
  type RequestRaceHintResponse,
  type SkipRaceRiddleRequest,
  type SkipRaceRiddleResponse,
  type StartRaceRunRequest,
  type SubmitRaceGuessRequest,
  type SubmitRaceGuessResponse,
} from "@qwordly/core/race";
import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import {validateCallableResponse} from "../validation/callableValidation";
import {
  abandonRaceRun,
  applyRaceGuess,
  applyRaceHint,
  applyRaceSkip,
  raceOutcome,
  refreshRaceRun,
  toRaceRunView,
  type RaceOpponentRecord,
  type RaceRiddleSnapshot,
  type RaceRunRecord,
} from "./raceEngine";
import {RACE_POOL_SIZE, validateRacePool} from "./raceContentValidation";
import type {ExistingRaceContentRecord} from "./raceContentMigration";
import {evaluateRaceAchievementEvent, type RaceAchievementEvent} from "./raceAchievements";

type Firestore = FirebaseFirestore.Firestore;

type RaceChallengeRecord = {
  challengeId: string;
  creatorId: string;
  creatorRunId: string;
  rivalryChallengeId?: string;
  creatorSnapshot: {displayName: string; avatarUrl?: string | null};
  categoryId: RaceCategoryId;
  deckId: string;
  canonicalRiddleIds: string[];
  targetCorrect: typeof RACE_TARGET_CORRECT;
  creatorWallFinishMs: number;
  creatorHintPenaltyMs: number;
  creatorSkipPenaltyMs: number;
  creatorTotalPenaltyMs: number;
  creatorAdjustedFinishMs: number;
  ghostEvents: RaceRunRecord["events"];
  rules: typeof RACE_RULES;
  contentVersion: string;
  status: "active" | "expired" | "revoked";
  createdAtMs: number;
  expiresAtMs: number;
  expiresAt: FirebaseFirestore.Timestamp;
};

type RaceDeckRecord = {
  deckId: string;
  categoryId: RaceCategoryId;
  locale: RaceLocale;
  canonicalRiddleIds: string[];
  contentVersion: string;
  rulesVersion: typeof RACE_RULES.version;
  createdAtMs: number;
  expiresAt: FirebaseFirestore.Timestamp;
};

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

const dbOrDefault = (db?: Firestore): Firestore => db ?? admin.firestore();

const persistRaceAchievementEvent = (
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

const stableHash = (value: string): string => createHash("sha256").update(value).digest("hex");

const requestDocumentId = (userId: string, requestId: string): string => stableHash(`${userId}\u0000${requestId}`);

const RACE_ACTION_WINDOW_MS = 10_000;
const RACE_ACTION_LIMIT = 30;

const applyActionRateLimit = (run: RaceRunRecord, userId: string, nowMs: number): RaceRunRecord => {
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

const stripUndefined = <T>(value: T): T => {
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

const parseRunRecord = (value: FirebaseFirestore.DocumentData | undefined): RaceRunRecord => {
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

const parseChallengeRecord = (value: FirebaseFirestore.DocumentData | undefined): RaceChallengeRecord => {
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
  return value as RaceChallengeRecord;
};

const getLocalizedCollection = (db: Firestore, locale: RaceLocale) =>
  db.collection(`localizedRiddles/${locale}/riddles`);

const toContentRecord = (
  locale: RaceLocale,
  document: FirebaseFirestore.QueryDocumentSnapshot,
): ExistingRaceContentRecord => ({
  locale,
  documentPath: document.ref.path,
  data: document.data(),
});

async function loadEligibleContent(
  db: Firestore,
  locale: RaceLocale,
  categoryId?: RaceCategoryId,
): Promise<ExistingRaceContentRecord[]> {
  let query: FirebaseFirestore.Query = getLocalizedCollection(db, locale).where("raceEligible", "==", true);
  if (categoryId) query = query.where("categoryId", "==", categoryId);
  const snapshot = await query.get();
  return snapshot.docs.map((document) => toContentRecord(locale, document));
}

const deterministicSort = <T extends {data: {canonicalRiddleId?: unknown}}>(records: T[], seed: string): T[] =>
  [...records].sort((left, right) => {
    const leftId = String(left.data.canonicalRiddleId ?? "");
    const rightId = String(right.data.canonicalRiddleId ?? "");
    return stableHash(`${seed}:${leftId}`).localeCompare(stableHash(`${seed}:${rightId}`));
  });

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

async function resolveChallengeRiddles(
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

const challengePreview = (challenge: RaceChallengeRecord, nowMs: number): RaceChallengePreview =>
  RaceChallengePreviewSchema.parse({
    challengeId: challenge.challengeId,
    rivalryChallengeId: challenge.rivalryChallengeId,
    creator: challenge.creatorSnapshot,
    categoryId: challenge.categoryId,
    targetCorrect: challenge.targetCorrect,
    adjustedTimeToBeatMs: challenge.creatorAdjustedFinishMs,
    rulesVersion: challenge.rules.version,
    expiresAtMs: challenge.expiresAtMs,
    status: challenge.status === "active" && nowMs >= challenge.expiresAtMs ? "expired" : challenge.status,
  });

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

export async function startRaceRunForUser(
  userId: string,
  input: StartRaceRunRequest,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<RaceRunResponse> {
  const db = dbOrDefault(options.db);
  const nowMs = options.nowMs ?? Date.now();
  const startRequestRef = db.collection("raceStartRequests").doc(requestDocumentId(userId, input.requestId));
  const existingStart = await startRequestRef.get();
  if (existingStart.exists) {
    const runId = existingStart.data()?.runId;
    if (typeof runId !== "string") throw new HttpsError("internal", "Stored race start request is invalid.");
    const runSnapshot = await db.collection("raceRuns").doc(runId).get();
    if (!runSnapshot.exists) throw new HttpsError("internal", "Stored race run is missing.");
    return RaceRunResponseSchema.parse({run: toRaceRunView(parseRunRecord(runSnapshot.data()), nowMs)});
  }

  const runRef = db.collection("raceRuns").doc();
  const deckRef = db.collection("raceDecks").doc();
  let categoryId: RaceCategoryId;
  let riddles: RaceRiddleSnapshot[];
  let contentVersion: string;
  let opponent: RaceOpponentRecord | undefined;
  let challenge: RaceChallengeRecord | undefined;

  if (input.rivalryChallengeId) {
    const rivalrySnapshot = await db.collection("raceChallenges").doc(input.rivalryChallengeId).get();
    if (!rivalrySnapshot.exists) throw new HttpsError("not-found", "Race rivalry not found.");
    const rivalry = parseChallengeRecord(rivalrySnapshot.data());
    if (rivalry.creatorId !== userId) {
      const attempt = await db
        .collection("raceAttempts")
        .doc(requestDocumentId(input.rivalryChallengeId, userId))
        .get();
      if (!attempt.exists) throw new HttpsError("permission-denied", "This player is not part of the rivalry.");
    }
  }

  if (input.challengeId) {
    const challengeSnapshot = await db.collection("raceChallenges").doc(input.challengeId).get();
    if (!challengeSnapshot.exists) throw new HttpsError("not-found", "Race to 10 challenge not found.");
    challenge = parseChallengeRecord(challengeSnapshot.data());
    if (challenge.creatorId === userId) {
      throw new HttpsError("failed-precondition", "You cannot compete against your own challenge.");
    }
    const preview = challengePreview(challenge, nowMs);
    if (preview.status !== "active") throw new HttpsError("failed-precondition", `Challenge is ${preview.status}.`);
    categoryId = challenge.categoryId;
    riddles = await resolveChallengeRiddles(db, input.locale, challenge);
    contentVersion = challenge.contentVersion;
    opponent = {
      displayName: challenge.creatorSnapshot.displayName,
      avatarUrl: challenge.creatorSnapshot.avatarUrl,
      adjustedFinishMs: challenge.creatorAdjustedFinishMs,
      events: challenge.ghostEvents,
    };
  } else {
    categoryId = input.categoryId!;
    const content = await loadEligibleContent(db, input.locale, categoryId);
    ({riddles, contentVersion} = buildDeterministicRaceDeck(content, {
      locale: input.locale,
      categoryId,
      seed: runRef.id,
    }));
  }

  const run: RaceRunRecord = {
    runId: runRef.id,
    userId,
    challengeId: input.challengeId,
    rivalryChallengeId: input.rivalryChallengeId,
    role: input.challengeId ? "challenger" : "creator",
    status: "active",
    categoryId,
    locale: input.locale,
    rulesVersion: RACE_RULES.version,
    deckId: deckRef.id,
    riddles,
    currentPosition: 0,
    correctCount: 0,
    guessesUsed: 0,
    hintUsed: false,
    revealedLetters: [],
    startedAtMs: nowMs,
    hintPenaltyMs: 0,
    skipPenaltyMs: 0,
    events: [],
    opponent,
  };
  const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + RACE_CHALLENGE_TTL_MS);
  const deck: RaceDeckRecord = {
    deckId: deckRef.id,
    categoryId,
    locale: input.locale,
    canonicalRiddleIds: riddles.map((riddle) => riddle.canonicalRiddleId),
    contentVersion,
    rulesVersion: RACE_RULES.version,
    createdAtMs: nowMs,
    expiresAt,
  };

  await db.runTransaction(async (transaction) => {
    const [duplicateStart, challengeAttempt] = await Promise.all([
      transaction.get(startRequestRef),
      input.challengeId
        ? transaction.get(db.collection("raceAttempts").doc(requestDocumentId(input.challengeId, userId)))
        : Promise.resolve(null),
    ]);
    if (duplicateStart.exists) return;
    if (challengeAttempt?.exists) {
      throw new HttpsError("already-exists", "This player already has a ranked attempt for the challenge.");
    }
    transaction.create(deckRef, stripUndefined(deck));
    transaction.create(runRef, {...stripUndefined(run), expiresAt});
    transaction.create(startRequestRef, {runId: runRef.id, userId, createdAtMs: nowMs, expiresAt});
    if (input.challengeId) {
      transaction.create(db.collection("raceAttempts").doc(requestDocumentId(input.challengeId, userId)), {
        challengeId: input.challengeId,
        playerId: userId,
        runId: runRef.id,
        createdAtMs: nowMs,
        expiresAt,
      });
    }
  });

  const committedStart = await startRequestRef.get();
  const committedRunId = committedStart.data()?.runId;
  if (typeof committedRunId !== "string") throw new HttpsError("internal", "Race start was not committed.");
  const committedRun =
    committedRunId === runRef.id
      ? run
      : parseRunRecord((await db.collection("raceRuns").doc(committedRunId).get()).data());
  return RaceRunResponseSchema.parse({run: toRaceRunView(committedRun, nowMs)});
}

async function mutateRaceRun<T>(
  userId: string,
  runId: string,
  requestId: string,
  nowMs: number,
  db: Firestore,
  mutate: (run: RaceRunRecord) => {run: RaceRunRecord; response: T},
): Promise<T> {
  const runRef = db.collection("raceRuns").doc(runId);
  const requestRef = runRef.collection("requests").doc(requestDocumentId(userId, requestId));
  return db.runTransaction(async (transaction) => {
    const [requestSnapshot, runSnapshot] = await Promise.all([transaction.get(requestRef), transaction.get(runRef)]);
    if (requestSnapshot.exists) return requestSnapshot.data()?.response as T;
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    const run = parseRunRecord(runSnapshot.data());
    if (run.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    const result = mutate(applyActionRateLimit(run, userId, nowMs));
    if (
      run.status === "active" &&
      result.run.status !== "active" &&
      result.run.status !== "abandoned" &&
      result.run.challengeId
    ) {
      const challengeRef = db.collection("raceChallenges").doc(result.run.challengeId);
      const challengeSnapshot = await transaction.get(challengeRef);
      const challenge = parseChallengeRecord(challengeSnapshot.data());
      const creatorRef = db.collection("users").doc(challenge.creatorId);
      const [challengerSnapshot, creatorSnapshot] = await Promise.all([
        transaction.get(db.collection("users").doc(userId)),
        transaction.get(creatorRef),
      ]);
      const outcome = raceOutcome(result.run, nowMs);
      const adjustedDeltaMs = outcome.adjustedFinishMs - challenge.creatorAdjustedFinishMs;
      const creatorResult = adjustedDeltaMs < 0 ? "loss" : adjustedDeltaMs > 0 ? "win" : "tie";
      const challenger = challengerSnapshot.data() ?? {};
      const itemId = requestDocumentId(result.run.challengeId, userId);
      transaction.set(db.doc(`users/${challenge.creatorId}/raceInbox/${itemId}`), {
        itemId,
        challengeId: result.run.challengeId,
        opponentDisplayName: String(challenger.displayName || challenger.username || "Riddle Quest player")
          .trim()
          .slice(0, 80),
        ...(typeof challenger.avatarUrl === "string" ? {opponentAvatarUrl: challenger.avatarUrl} : {}),
        categoryId: result.run.categoryId,
        result: creatorResult,
        adjustedDeltaMs,
        read: false,
        createdAtMs: nowMs,
      });
      if (creatorSnapshot.exists) {
        persistRaceAchievementEvent(
          transaction,
          creatorRef,
          creatorSnapshot.data() ?? {},
          {kind: "opponent_resolved", won: creatorResult === "win"},
          nowMs,
        );
      }
    }
    transaction.set(runRef, stripUndefined(result.run), {merge: true});
    transaction.create(requestRef, {
      userId,
      createdAtMs: nowMs,
      response: stripUndefined(result.response),
      expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + RACE_CHALLENGE_TTL_MS),
    });
    return result.response;
  });
}

export async function abandonRaceRunForUser(
  userId: string,
  input: AbandonRaceRunRequest,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<AbandonRaceRunResponse> {
  const db = dbOrDefault(options.db);
  const nowMs = options.nowMs ?? Date.now();
  const response = await mutateRaceRun(userId, input.runId, input.requestId, nowMs, db, (run) => {
    const abandoned = abandonRaceRun(run, nowMs);
    return {
      run: abandoned,
      response: {
        run: toRaceRunView(abandoned, nowMs),
        result: null,
      },
    };
  });
  return AbandonRaceRunResponseSchema.parse(response);
}

export async function submitRaceGuessForUser(
  userId: string,
  input: SubmitRaceGuessRequest,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<SubmitRaceGuessResponse> {
  const db = dbOrDefault(options.db);
  const nowMs = options.nowMs ?? Date.now();
  const response = await mutateRaceRun(userId, input.runId, input.requestId, nowMs, db, (run) => {
    const result = applyRaceGuess(run, input, nowMs);
    return {
      run: result.run,
      response: {
        run: toRaceRunView(result.run, nowMs),
        feedback: result.feedback,
        isCorrect: result.isCorrect,
        autoSkipped: result.autoSkipped,
      },
    };
  });
  return SubmitRaceGuessResponseSchema.parse(response);
}

export async function requestRaceHintForUser(
  userId: string,
  input: RequestRaceHintRequest,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<RequestRaceHintResponse> {
  const db = dbOrDefault(options.db);
  const nowMs = options.nowMs ?? Date.now();
  const response = await mutateRaceRun(userId, input.runId, input.requestId, nowMs, db, (run) => {
    const result = applyRaceHint(run, input, nowMs);
    return {
      run: result.run,
      response: {
        run: toRaceRunView(result.run, nowMs),
        revealedLetter: result.revealedLetter,
        index: result.index,
      },
    };
  });
  return RequestRaceHintResponseSchema.parse(response);
}

export async function skipRaceRiddleForUser(
  userId: string,
  input: SkipRaceRiddleRequest,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<SkipRaceRiddleResponse> {
  const db = dbOrDefault(options.db);
  const nowMs = options.nowMs ?? Date.now();
  const response = await mutateRaceRun(userId, input.runId, input.requestId, nowMs, db, (run) => {
    const updated = applyRaceSkip(run, input, nowMs);
    return {
      run: updated,
      response: {
        run: toRaceRunView(updated, nowMs),
        penaltyAddedMs: RACE_RULES.skipPenaltyMs,
      },
    };
  });
  return SkipRaceRiddleResponseSchema.parse(response);
}

export async function resumeRaceRunForUser(
  userId: string,
  runId: string,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<RaceRunResponse> {
  const db = dbOrDefault(options.db);
  const nowMs = options.nowMs ?? Date.now();
  const runRef = db.collection("raceRuns").doc(runId);
  const run = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(runRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    const stored = parseRunRecord(snapshot.data());
    if (stored.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    const refreshed = refreshRaceRun(stored, nowMs);
    if (JSON.stringify(refreshed) !== JSON.stringify(stored)) {
      transaction.set(runRef, stripUndefined(refreshed), {merge: true});
    }
    return refreshed;
  });
  return RaceRunResponseSchema.parse({run: toRaceRunView(run, nowMs)});
}

export async function publishRaceChallengeForUser(
  userId: string,
  input: PublishRaceChallengeRequest,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<PublishRaceChallengeResponse> {
  const db = dbOrDefault(options.db);
  const nowMs = options.nowMs ?? Date.now();
  const runRef = db.collection("raceRuns").doc(input.runId);
  const requestRef = runRef.collection("requests").doc(requestDocumentId(userId, input.requestId));
  const challengeRef = db.collection("raceChallenges").doc();
  const response = await db.runTransaction(async (transaction) => {
    const [requestSnapshot, runSnapshot, userSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(runRef),
      transaction.get(db.collection("users").doc(userId)),
    ]);
    if (requestSnapshot.exists) return requestSnapshot.data()?.response as PublishRaceChallengeResponse;
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    const run = parseRunRecord(runSnapshot.data());
    if (run.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    const outcome = raceOutcome(run, nowMs);
    if (!outcome.publishable) {
      throw new HttpsError("failed-precondition", "Only a verified completed creator run can be published.");
    }
    const user = userSnapshot.data() ?? {};
    const displayName = String(user.displayName || user.username || "Riddle Quest player")
      .trim()
      .slice(0, 80);
    const avatarUrl = typeof user.avatarUrl === "string" ? user.avatarUrl : undefined;
    const expiresAtMs = nowMs + RACE_CHALLENGE_TTL_MS;
    const deckSnapshot = await transaction.get(db.collection("raceDecks").doc(run.deckId));
    const deck = deckSnapshot.data() as RaceDeckRecord | undefined;
    if (!deck) throw new HttpsError("internal", "The completed race deck is missing.");
    const challenge: RaceChallengeRecord = {
      challengeId: challengeRef.id,
      creatorId: userId,
      creatorRunId: run.runId,
      rivalryChallengeId: run.rivalryChallengeId ?? run.challengeId,
      creatorSnapshot: {displayName, avatarUrl},
      categoryId: run.categoryId,
      deckId: run.deckId,
      canonicalRiddleIds: deck.canonicalRiddleIds,
      targetCorrect: RACE_TARGET_CORRECT,
      creatorWallFinishMs: outcome.wallFinishMs,
      creatorHintPenaltyMs: outcome.hintPenaltyMs,
      creatorSkipPenaltyMs: outcome.skipPenaltyMs,
      creatorTotalPenaltyMs: outcome.totalPenaltyMs,
      creatorAdjustedFinishMs: outcome.adjustedFinishMs,
      ghostEvents: run.events,
      rules: RACE_RULES,
      contentVersion: deck.contentVersion,
      status: "active",
      createdAtMs: nowMs,
      expiresAtMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    };
    const result = PublishRaceChallengeResponseSchema.parse({
      challengeId: challengeRef.id,
      preview: challengePreview(challenge, nowMs),
      ...(() => {
        if (!userSnapshot.exists) return {};
        const update = evaluateRaceAchievementEvent(userSnapshot.data() ?? {}, {kind: "challenge_published"}, nowMs);
        return {
          newlyUnlockedAchievementIds: update.newlyUnlockedAchievementIds,
          achievementCoinsAwarded: update.achievementCoinsAwarded,
          newCoins: update.newCoins,
        };
      })(),
    });
    transaction.create(challengeRef, stripUndefined(challenge));
    transaction.set(runRef, {...stripUndefined(run), publishedChallengeId: challengeRef.id}, {merge: true});
    if (userSnapshot.exists) {
      persistRaceAchievementEvent(
        transaction,
        db.collection("users").doc(userId),
        userSnapshot.data() ?? {},
        {kind: "challenge_published"},
        nowMs,
      );
    }
    transaction.create(requestRef, {
      userId,
      createdAtMs: nowMs,
      response: stripUndefined(result),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    });
    return result;
  });
  return PublishRaceChallengeResponseSchema.parse(response);
}

export async function getRaceChallengePreview(
  challengeId: string,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<RaceChallengePreview> {
  const db = dbOrDefault(options.db);
  const snapshot = await db.collection("raceChallenges").doc(challengeId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Race to 10 challenge not found.");
  return challengePreview(parseChallengeRecord(snapshot.data()), options.nowMs ?? Date.now());
}

export async function getRaceOutcomeForUser(
  userId: string,
  runId: string,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<RaceOutcome> {
  const db = dbOrDefault(options.db);
  const nowMs = options.nowMs ?? Date.now();
  const runRef = db.collection("raceRuns").doc(runId);
  const userRef = db.collection("users").doc(userId);
  const outcome = await db.runTransaction(async (transaction) => {
    const [runSnapshot, userSnapshot] = await Promise.all([transaction.get(runRef), transaction.get(userRef)]);
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    const run = parseRunRecord(runSnapshot.data());
    if (run.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    const baseOutcome = raceOutcome(run, nowMs);
    if (run.achievementProgressRecordedAtMs !== undefined) return baseOutcome;
    if (!userSnapshot.exists) throw new HttpsError("internal", "Player progress is unavailable for this race.");

    const update = persistRaceAchievementEvent(
      transaction,
      userRef,
      userSnapshot.data() ?? {},
      {
        kind: "completed",
        won: baseOutcome.result === "player_win",
        cleanRun: baseOutcome.correctCount === RACE_TARGET_CORRECT && baseOutcome.totalPenaltyMs === 0,
      },
      nowMs,
    );
    transaction.set(runRef, {achievementProgressRecordedAtMs: nowMs}, {merge: true});
    return {
      ...baseOutcome,
      newlyUnlockedAchievementIds: update.newlyUnlockedAchievementIds,
      achievementCoinsAwarded: update.achievementCoinsAwarded,
      newCoins: update.newCoins,
    };
  });
  return validateCallableResponse(RaceOutcomeSchema, outcome, "getRaceOutcome");
}

const encodeInboxCursor = (createdAtMs: number, itemId: string): string =>
  Buffer.from(JSON.stringify({createdAtMs, itemId}), "utf8").toString("base64url");

const decodeInboxCursor = (cursor: string): {createdAtMs: number; itemId: string} => {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof value.createdAtMs !== "number" || typeof value.itemId !== "string") throw new Error("invalid");
    return {createdAtMs: value.createdAtMs, itemId: value.itemId};
  } catch {
    throw new HttpsError("invalid-argument", "Race inbox cursor is invalid.");
  }
};

export async function listRaceInboxForUser(
  userId: string,
  input: ListRaceInboxRequest,
  dbInput?: Firestore,
): Promise<ListRaceInboxResponse> {
  const db = dbOrDefault(dbInput);
  let query: FirebaseFirestore.Query = db
    .collection(`users/${userId}/raceInbox`)
    .orderBy("createdAtMs", "desc")
    .orderBy(admin.firestore.FieldPath.documentId(), "desc")
    .limit(input.limit + 1);
  if (input.cursor) {
    const cursor = decodeInboxCursor(input.cursor);
    query = query.startAfter(cursor.createdAtMs, cursor.itemId);
  }
  const snapshot = await query.get();
  const visible = snapshot.docs.slice(0, input.limit);
  const items = visible.map((document) => RaceInboxItemSchema.parse(document.data()));
  const last = visible.at(-1);
  const response = ListRaceInboxResponseSchema.parse({
    items,
    nextCursor:
      snapshot.docs.length > input.limit && last
        ? encodeInboxCursor(Number(last.data().createdAtMs), last.id)
        : undefined,
  });
  const unread = visible.filter((document) => document.data().read !== true);
  if (unread.length > 0) {
    const batch = db.batch();
    unread.forEach((document) => batch.update(document.ref, {read: true}));
    await batch.commit();
  }
  return response;
}
