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
import {raceReceiptExpiresAt} from "./raceReceiptPrivacy";
import {raceRunPrivacyWrite, resolveRaceOpponentPrivacy} from "./raceOpponentPrivacy";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {
  assertRaceLocaleCompatible,
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
import {assertRaceInteractionAllowed, mutateRaceRun} from "./raceRunMutation";
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
    return resumeRaceRunForUser(userId, runId, {db, nowMs});
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
    assertRaceLocaleCompatible(rivalry, input.locale);
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
    assertRaceLocaleCompatible(challenge, input.locale);
    if (challenge.creatorId === userId) {
      throw new HttpsError("failed-precondition", "You cannot compete against your own challenge.");
    }
    const preview = challengePreview(challenge, nowMs);
    if (preview.status !== "active") throw new HttpsError("failed-precondition", `Challenge is ${preview.status}.`);
    categoryId = challenge.categoryId;
    riddles = await resolveChallengeRiddles(db, input.locale, challenge);
    contentVersion = challenge.contentVersion;
    opponent = {
      subjectUserId: challenge.creatorId,
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
    const [duplicateStart, challengeAttempt, committedChallengeSnapshot] = await Promise.all([
      transaction.get(startRequestRef),
      input.challengeId ? transaction.get(db.collection("raceAttempts")
        .doc(requestDocumentId(input.challengeId, userId))) : Promise.resolve(null),
      input.challengeId ? transaction.get(db.collection("raceChallenges").doc(input.challengeId)) : Promise.resolve(null),
    ]);
    if (duplicateStart.exists) return;
    if (input.challengeId) {
      if (!committedChallengeSnapshot?.exists) throw new HttpsError("not-found", "Race to 10 challenge not found.");
      const committedChallenge = parseChallengeRecord(committedChallengeSnapshot.data());
      const creatorDeletionSnapshot = await transaction.get(getJestAccountDeletionRef(db, committedChallenge.creatorId));
      assertJestAccountActive(creatorDeletionSnapshot);
      await assertRaceInteractionAllowed(transaction, db, userId, committedChallenge.creatorId);
      if (challengePreview(committedChallenge, nowMs).status !== "active")
        throw new HttpsError("failed-precondition", "Race to 10 challenge is no longer active.");
      assertRaceLocaleCompatible(committedChallenge, input.locale);
    }
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
  return resumeRaceRunForUser(userId, committedRunId, {db, nowMs});
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
    const privacy = await resolveRaceOpponentPrivacy(transaction, db, stored);
    const refreshed = refreshRaceRun(privacy.run, nowMs);
    if (JSON.stringify(refreshed) !== JSON.stringify(stored)) {
      transaction.set(runRef, raceRunPrivacyWrite(refreshed, privacy.scrubbed), {merge: true});
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
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    const storedRun = parseRunRecord(runSnapshot.data());
    if (storedRun.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    const privacy = await resolveRaceOpponentPrivacy(transaction, db, storedRun);
    const run = privacy.run;
    if (requestSnapshot.exists) {
      if (privacy.scrubbed) transaction.set(runRef, raceRunPrivacyWrite(run, true), {merge: true});
      return requestSnapshot.data()?.response as PublishRaceChallengeResponse;
    }
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
      locale: run.locale,
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
    transaction.set(runRef, {
      ...raceRunPrivacyWrite(run, privacy.scrubbed),
      publishedChallengeId: challengeRef.id,
    }, {merge: true});
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
      expiresAt: raceReceiptExpiresAt(runSnapshot.data()?.expiresAt, expiresAtMs),
    });
    return result;
  });
  return PublishRaceChallengeResponseSchema.parse(response);
}
export {getRaceChallengePreview, getRaceOutcomeForUser, listRaceInboxForUser} from "./raceReadService";
