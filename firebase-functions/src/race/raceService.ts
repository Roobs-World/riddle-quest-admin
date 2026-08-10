import {admin} from "../shared/firebaseAdmin";
import {
  AbandonRaceRunResponseSchema,
  PublishRaceChallengeResponseSchema,
  RACE_CHALLENGE_TTL_MS,
  RACE_RULES,
  RACE_TARGET_CORRECT,
  RaceRunResponseSchema,
  RequestRaceHintResponseSchema,
  SkipRaceRiddleResponseSchema,
  SubmitRaceGuessResponseSchema,
  type AbandonRaceRunRequest,
  type AbandonRaceRunResponse,
  type PublishRaceChallengeRequest,
  type PublishRaceChallengeResponse,
  type RaceCategoryId,
  type RaceRunResponse,
  type RequestRaceHintRequest,
  type RequestRaceHintResponse,
  type SkipRaceRiddleRequest,
  type SkipRaceRiddleResponse,
  type StartRaceRunRequest,
  type SubmitRaceGuessRequest,
  type SubmitRaceGuessResponse,
} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
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
import {evaluateRaceAchievementEvent} from "./raceAchievements";
import {evaluateRaceRollout} from "./raceRollout";
import {
  applyActionRateLimit,
  buildDeterministicRaceDeck,
  challengePreview,
  dbOrDefault,
  loadEligibleContent,
  parseChallengeRecord,
  parseRunRecord,
  persistRaceAchievementEvent,
  requestDocumentId,
  resolveChallengeRiddles,
  stripUndefined,
  type Firestore,
  type RaceChallengeRecord,
  type RaceDeckRecord,
} from "./raceSetupService";

export {buildDeterministicRaceDeck, listRaceCategoriesForLocale} from "./raceSetupService";

/** Starts race run for user. */
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

/** Provides mutate race run behavior. */
async function mutateRaceRun<T>(
  userId: string,
  runId: string,
  requestId: string,
  nowMs: number,
  db: Firestore,
  mutate: (run: RaceRunRecord) => {run: RaceRunRecord; response: T},
  options: {enforceRaceAccess?: boolean} = {},
): Promise<T> {
  const runRef = db.collection("raceRuns").doc(runId);
  const requestRef = runRef.collection("requests").doc(requestDocumentId(userId, requestId));
  return db.runTransaction(async (transaction) => {
    const [requestSnapshot, runSnapshot, rolloutSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(runRef),
      options.enforceRaceAccess ? transaction.get(db.doc("raceConfig/rollout")) : Promise.resolve(null),
    ]);
    if (requestSnapshot.exists) return requestSnapshot.data()?.response as T;
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    if (
      options.enforceRaceAccess &&
      !evaluateRaceRollout(rolloutSnapshot?.exists ? rolloutSnapshot.data() : undefined, userId).enabled
    ) {
      throw new HttpsError("permission-denied", "Race to 10 is not enabled for this player.");
    }
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

/** Provides abandon race run for user behavior. */
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

/** Submits race guess for user. */
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

/** Requests race hint for user. */
export async function requestRaceHintForUser(
  userId: string,
  input: RequestRaceHintRequest,
  options: {db?: Firestore; nowMs?: number; enforceAccess?: boolean} = {},
): Promise<RequestRaceHintResponse> {
  const db = dbOrDefault(options.db);
  const nowMs = options.nowMs ?? Date.now();
  const response = await mutateRaceRun(
    userId,
    input.runId,
    input.requestId,
    nowMs,
    db,
    (run) => {
      const result = applyRaceHint(run, input, nowMs);
      return {
        run: result.run,
        response: {
          run: toRaceRunView(result.run, nowMs),
          revealedLetter: result.revealedLetter,
          index: result.index,
        },
      };
    },
    {enforceRaceAccess: options.enforceAccess},
  );
  return RequestRaceHintResponseSchema.parse(response);
}

/** Provides skip race riddle for user behavior. */
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

/** Provides resume race run for user behavior. */
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

/** Publishes race challenge for user. */
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

export {getRaceChallengePreview, getRaceOutcomeForUser, listRaceInboxForUser} from "./raceReadService";
