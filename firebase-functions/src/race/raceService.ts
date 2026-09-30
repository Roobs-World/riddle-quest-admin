import {admin} from "../shared/firebaseAdmin";
import {logger} from "firebase-functions";
import {createHash} from "node:crypto";
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
import {assertRaceMatchOfferForStart} from "./raceMatchOffer";
import {
  abandonRaceRun,
  applyRaceGuess,
  applyRaceHint,
  applyRaceSkip,
  raceOutcome,
  raceRules,
  raceDeadlineAtMs,
  RACE_PREPARATION_WINDOW_MS,
  toRaceRunView,
  type RaceOpponentRecord,
  type RaceRiddleSnapshot,
  type RaceRunRecord,
} from "./raceEngine";
import {evaluateRaceAchievementEvent} from "./raceAchievements";
import {raceReceiptExpiresAt} from "./raceReceiptPrivacy";
import {raceRunPrivacyWrite, resolveRaceOpponentPrivacy} from "./raceOpponentPrivacy";
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
import {mutateRaceRun} from "./raceRunMutation";
import {assertRaceChallengeEligible, inspectRaceChallengeEligibility, raceProviderScope} from "./raceEligibility";
import {projectRaceMatchCandidate} from "./raceMatchCandidates";
import {raceDeckContentVersion, raceRecordingFingerprint, assertRacePreparedRecording} from "./raceDeckSnapshot";
import {emptyRaceMatchProfile, RaceMatchProfileSchema, raceDifficultyAdjustedMs, recordRaceExposure} from "./raceMatchPerformance";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
export {readyRaceRunForUser} from "./raceRunLifecycle";
import {settleRaceRun} from "./raceSettlement";
import {parseRaceInvitation, assertRaceInvitationOpen} from "./raceInvitationRecord";
import {buildRaceBotOpponent, parseRaceBotOffer} from "./raceBot";
export {reserveRaceInviteForUser, claimRaceInviteForUser} from "./raceInvitation";
export {buildDeterministicRaceDeck, listRaceCategoriesForLocale} from "./raceSetupService";

/** Reports one answer-free command observation outside transactions, including failed offer acceptance. */
export async function startRaceRunForUser(
  userId: string,
  input: StartRaceRunRequest,
  options: Parameters<typeof prepareRaceRunForUser>[2] = {},
): Promise<RaceRunResponse> {
  /** Elapsed command time includes preparation and authoritative replay, not client delivery. */
  const started = Date.now();
  /** Entry kind describes the command; an offer reference is never treated as authorization. */
  const entryKind = input.fallbackOfferId ? "fallback" : input.offerId ? "offer" : input.challengeId ? "challenge" : "creator";
  /** Pool labels stay bounded and omit the authenticated account identity. */
  const provider = raceProviderScope(userId) ?? "legacy";
  try {
    /** Preparation and all idempotency/eligibility checks retain their existing authority. */
    const response = await prepareRaceRunForUser(userId, input, options);
    logger.info("Race start command", {telemetryVersion: 1, disposition: "returned", entryKind, provider,
      locale: response.run.locale, categoryId: response.run.categoryId, status: response.run.status, durationMs: Date.now() - started});
    return response;
  } catch (error) {
    logger.warn("Race start command", {telemetryVersion: 1, disposition: "failed", entryKind, provider,
      locale: input.locale, failureCode: error instanceof HttpsError ? error.code : "internal", durationMs: Date.now() - started});
    throw error;
  }
}

/** Prepares or replays one server-owned run without deriving authority from telemetry. */
async function prepareRaceRunForUser(
  userId: string,
  input: StartRaceRunRequest,
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<RaceRunResponse> {
  /** Provides db behavior. */
  const db = dbOrDefault(options.db);
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Starts request ref. */
  const startRequestRef = db.collection("raceStartRequests").doc(requestDocumentId(userId, input.requestId));
  /** Provides existing start behavior. */
  const existingStart = await startRequestRef.get();
  if (existingStart.exists) {
    if (existingStart.data()?.fallbackOfferId !== input.fallbackOfferId)
      throw new HttpsError("invalid-argument", "Race start request was reused for another opponent.");
    /** Provides run id behavior. */
    const runId = existingStart.data()?.runId;
    if (typeof runId !== "string") throw new HttpsError("internal", "Stored race start request is invalid.");
    return resumeRaceRunForUser(userId, runId, {db, nowMs, includeEvaluation: input.includeEvaluation});
  }

  /** Provides run ref behavior. */
  const runRef = db.collection("raceRuns").doc();
  /** Provides deck ref behavior. */
  const deckRef = db.collection("raceDecks").doc();
  /** Provides category id behavior. */
  let categoryId: RaceCategoryId;
  /** Provides riddles behavior. */
  let riddles: RaceRiddleSnapshot[];
  /** Provides content version behavior. */
  let contentVersion: string;
  /** Provides opponent behavior. */
  let opponent: RaceOpponentRecord | undefined;
  /** Provides challenge behavior. */
  let challenge: RaceChallengeRecord | undefined;
  /** A fallback may only consume a receipt issued by successful empty discovery. */
  const botOfferRef = input.fallbackOfferId ? db.doc(`raceBotOffers/${input.fallbackOfferId}`) : undefined;
  if (botOfferRef) {
    /** Current offer must belong to this player and requested category. */
    const snapshot = await botOfferRef.get();
    if (!snapshot.exists) throw new HttpsError("not-found", "Opponent offer is unavailable.");
    /** Previously accepted offers resume their existing run. */
    const offer = parseRaceBotOffer(snapshot.data(), userId, input, botOfferRef.id);
    if (offer.acceptedRunId) return resumeRaceRunForUser(userId, offer.acceptedRunId, {db, nowMs, includeEvaluation: input.includeEvaluation});
    if (offer.createdAtMs > nowMs || offer.expiresAtMs <= nowMs) throw new HttpsError("failed-precondition", "Opponent offer expired.");
  }

  if (input.rivalryChallengeId) {
    /** Provides rivalry snapshot behavior. */
    const rivalrySnapshot = await db.collection("raceChallenges").doc(input.rivalryChallengeId).get();
    if (!rivalrySnapshot.exists) throw new HttpsError("not-found", "Race rivalry not found.");
    /** Provides rivalry behavior. */
    const rivalry = parseChallengeRecord(rivalrySnapshot.data(), rivalrySnapshot.id);
    assertRaceLocaleCompatible(rivalry, input.locale);
    if (rivalry.creatorId !== userId) {
      /** Provides attempt behavior. */
      const attempt = await db
        .collection("raceAttempts")
        .doc(requestDocumentId(input.rivalryChallengeId, userId))
        .get();
      if (!attempt.exists) throw new HttpsError("permission-denied", "This player is not part of the rivalry.");
    }
  }

  if (input.challengeId) {
    /** Provides challenge snapshot behavior. */
    const challengeSnapshot = await db.collection("raceChallenges").doc(input.challengeId).get();
    if (!challengeSnapshot.exists) throw new HttpsError("not-found", "Race to 10 challenge not found.");
    challenge = parseChallengeRecord(challengeSnapshot.data(), challengeSnapshot.id);
    assertRaceLocaleCompatible(challenge, input.locale);
    if (challenge.creatorId === userId) {
      throw new HttpsError("failed-precondition", "You cannot compete against your own challenge.");
    }
    /** Provides preview behavior. */
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
    /** Provides content behavior. */
    const content = await loadEligibleContent(db, input.locale, categoryId);
    ({riddles, contentVersion} = buildDeterministicRaceDeck(content, {
      locale: input.locale,
      categoryId,
      seed: botOfferRef?.id ?? runRef.id,
    }));
  }

  /** Provides run behavior. */
  const run: RaceRunRecord = {
    recordVersion: 1,
    ...(challenge ? {recordingFingerprint: raceRecordingFingerprint(challenge, riddles)} : {}),
    ...(input.offerId ? {matchOfferId: input.offerId} : {}),
    ...(input.fallbackOfferId ? {fallbackOfferId: input.fallbackOfferId} : {}),
    runId: runRef.id,
    userId,
    challengeId: input.challengeId,
    rivalryChallengeId: input.rivalryChallengeId,
    role: input.challengeId || botOfferRef ? "challenger" : "creator",
    status: input.prepare ? "prepared" : "active",
    ...(input.prepare ? {preparationExpiresAtMs: (options.nowMs ?? Date.now()) + RACE_PREPARATION_WINDOW_MS} : {}),
    categoryId,
    locale: input.locale,
    rulesVersion: challenge?.rules.version ?? RACE_RULES.version,
    rulesSnapshot: challenge?.rules ?? RACE_RULES,
    contentVersion,
    evaluationPolicy: challenge?.evaluationPolicy ?? "preloaded",
    deckId: deckRef.id,
    riddles,
    currentPosition: 0,
    correctCount: 0,
    guessesUsed: 0,
    hintUsed: false,
    revealedLetters: [],
    startedAtMs: input.prepare ? 0 : nowMs,
    hintPenaltyMs: 0,
    skipPenaltyMs: 0,
    events: [],
    opponent,
  };
  /** Provides expires at behavior. */
  const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + RACE_CHALLENGE_TTL_MS);
  /** Provides deck behavior. */
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
    /** Provides [duplicate start, committed challenge snapshot] behavior. */
    const matchProfileRef = db.doc(`users/${userId}/raceMatchProfiles/${input.locale}`);
    /** Provides [duplicate start, committed challenge snapshot, match profile, deletion, match offer] behavior. */
    const [duplicateStart, committedChallengeSnapshot, matchProfile, deletion, matchOffer, botOffer] = await Promise.all([
      transaction.get(startRequestRef),
      input.challengeId ? transaction.get(db.doc(`raceChallenges/${input.challengeId}`)) : Promise.resolve(null),
      transaction.get(matchProfileRef),
      transaction.get(getJestAccountDeletionRef(db, userId)),
      input.offerId ? transaction.get(db.doc(`raceMatchOffers/${input.offerId}`)) : Promise.resolve(null),
      botOfferRef ? transaction.get(botOfferRef) : Promise.resolve(null),
    ]);
    assertJestAccountActive(deletion);
    if (duplicateStart.exists) {
      if (duplicateStart.data()?.fallbackOfferId !== input.fallbackOfferId)
        throw new HttpsError("invalid-argument", "Race start request was reused for another opponent.");
      return;
    }
    if (botOfferRef) {
      if (!botOffer?.exists) throw new HttpsError("not-found", "Opponent offer is unavailable.");
      /** Transactional acceptance revalidates ownership and expiry before creating a run. */
      const committedOffer = parseRaceBotOffer(botOffer.data(), userId, input, botOfferRef.id);
      if (committedOffer.acceptedRunId) {
        transaction.create(startRequestRef, {runId: committedOffer.acceptedRunId, userId, fallbackOfferId: input.fallbackOfferId, createdAtMs: nowMs, expiresAt});
        return;
      }
      /** Provides acceptance now behavior. */
      const acceptanceNow = options.nowMs ?? Date.now();
      if (committedOffer.createdAtMs > acceptanceNow || committedOffer.expiresAtMs <= acceptanceNow)
        throw new HttpsError("failed-precondition", "Opponent offer expired.");
      opponent = buildRaceBotOpponent(committedOffer, botOfferRef.id, riddles);
      run.opponent = opponent;
    }
    assertRaceMatchOfferForStart(matchOffer, userId, input, run);
    if (input.challengeId) {
      if (!committedChallengeSnapshot?.exists) throw new HttpsError("not-found", "Race to 10 challenge not found.");
      /** Provides committed challenge behavior. */
      const committedChallenge = parseChallengeRecord(committedChallengeSnapshot.data(), committedChallengeSnapshot.id);
      /** Acceptance binds the prepared run to the same authorized immutable recording. */
      const inspection = await inspectRaceChallengeEligibility(transaction, db, userId, committedChallenge, input.locale, nowMs);
      assertRaceChallengeEligible(inspection.reason);
      assertRacePreparedRecording(run, committedChallenge, inspection.riddles!);
    }
    /** Provides profile behavior. */
    const profile = matchProfile.exists ? RaceMatchProfileSchema.parse(matchProfile.data()) : emptyRaceMatchProfile();
    transaction.set(matchProfileRef, recordRaceExposure(profile, userId, riddles, challenge?.creatorId));
    transaction.create(deckRef, stripUndefined(deck));
    transaction.create(runRef, {...stripUndefined({...run, deadlineAtMs: raceDeadlineAtMs(run)}), expiresAt});
    transaction.create(startRequestRef, {runId: runRef.id, userId, ...(input.fallbackOfferId ? {fallbackOfferId: input.fallbackOfferId} : {}), createdAtMs: nowMs, expiresAt});
    if (botOfferRef) transaction.update(botOfferRef, {acceptedRunId: runRef.id});
    if (matchOffer) transaction.update(matchOffer.ref, {acceptedRunId: runRef.id, acceptedAtMs: nowMs,
      preparationRequested: Boolean(input.prepare), offerExpiredAtAcceptance: matchOffer.data()!.expiresAtMs <= nowMs,
      ...(!input.prepare ? {startsAtMs: run.startedAtMs} : {}), expiresAt});
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

  /** Provides committed start behavior. */
  const committedStart = await startRequestRef.get();
  /** Provides committed run id behavior. */
  const committedRunId = committedStart.data()?.runId;
  if (typeof committedRunId !== "string") throw new HttpsError("internal", "Race start was not committed.");
  return resumeRaceRunForUser(userId, committedRunId, {db, nowMs, includeEvaluation: input.includeEvaluation});
}
/** Provides abandon race run for user behavior. */
export async function abandonRaceRunForUser(
  userId: string,
  input: AbandonRaceRunRequest,
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<AbandonRaceRunResponse> {
  /** Provides db behavior. */
  const db = dbOrDefault(options.db);
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Provides response behavior. */
  const response = await mutateRaceRun(userId, input.runId, input.requestId, nowMs, db, (run) => {
    /** Provides abandoned behavior. */
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
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<SubmitRaceGuessResponse> {
  /** Provides db behavior. */
  const db = dbOrDefault(options.db);
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Provides response behavior. */
  const response = await mutateRaceRun(userId, input.runId, input.requestId, nowMs, db, (run) => {
    /** Provides result behavior. */
    const result = applyRaceGuess(run, input, nowMs);
    return {
      run: result.run,
      response: {
        run: toRaceRunView(result.run, nowMs, input.includeEvaluation),
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
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number; /** Stores enforce access. */
    /** Stores enforce access. */
    enforceAccess?: boolean;
  } = {},
): Promise<RequestRaceHintResponse> {
  /** Provides db behavior. */
  const db = dbOrDefault(options.db);
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Provides response behavior. */
  const response = await mutateRaceRun(
    userId,
    input.runId,
    input.requestId,
    nowMs,
    db,
    (run) => {
      /** Provides result behavior. */
      const result = applyRaceHint(run, input, nowMs);
      return {
        run: result.run,
        response: {
          run: toRaceRunView(result.run, nowMs, input.includeEvaluation),
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
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<SkipRaceRiddleResponse> {
  /** Provides db behavior. */
  const db = dbOrDefault(options.db);
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Provides response behavior. */
  const response = await mutateRaceRun(userId, input.runId, input.requestId, nowMs, db, (run) => {
    /** Updates d. */
    const updated = applyRaceSkip(run, input, nowMs);
    return {
      run: updated,
      response: {
        run: toRaceRunView(updated, nowMs, input.includeEvaluation),
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
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
    /** The include evaluation used by the authoritative operation. */
    includeEvaluation?: boolean;
  } = {},
): Promise<RaceRunResponse> {
  /** Provides db behavior. */
  const db = dbOrDefault(options.db);
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Provides run ref behavior. */
  const runRef = db.collection("raceRuns").doc(runId);
  /** Provides run behavior. */
  const run = await db.runTransaction(async (transaction) => {
    /** Provides snapshot behavior. */
    const snapshot = await transaction.get(runRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    /** Stores d. */
    const stored = parseRunRecord(snapshot.data(), snapshot.id);
    if (stored.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    /** Provides privacy behavior. */
    const privacy = await resolveRaceOpponentPrivacy(transaction, db, stored);
    /** Provides refreshed behavior. */
    const refreshed = await settleRaceRun(transaction, db, privacy.run, nowMs);
    if (JSON.stringify(refreshed) !== JSON.stringify(stored)) {
      transaction.set(runRef, raceRunPrivacyWrite(refreshed, privacy.scrubbed), {merge: true});
    }
    return refreshed;
  });
  return RaceRunResponseSchema.parse({run: toRaceRunView(run, nowMs, options.includeEvaluation)});
}

/** Publishes race challenge for user. */
export async function publishRaceChallengeForUser(
  userId: string,
  input: PublishRaceChallengeRequest,
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<PublishRaceChallengeResponse> {
  if (input.reservedChallengeId) {
    /** Hash binding a reserved invitation to the authenticated creator. */
    const ownerHash = createHash("sha256").update(userId).digest("hex");
    if (!input.reservedChallengeId.startsWith(`jest-invite-${ownerHash}-`)) {
      throw new HttpsError("permission-denied", "This invitation belongs to another player.");
    }
  }
  /** Provides db behavior. */
  const db = dbOrDefault(options.db);
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Provides run ref behavior. */
  const runRef = db.collection("raceRuns").doc(input.runId);
  /** Requests ref. */
  const requestRef = runRef.collection("requests").doc(requestDocumentId(userId, input.requestId));
  /** Provides challenge ref behavior. */
  const challengeRef = input.reservedChallengeId
    ? db.collection("raceChallenges").doc(input.reservedChallengeId)
    : db.collection("raceChallenges").doc();
  /** Optional pre-shared lobby that this publication must finalize. */
  const inviteLobbyRef = input.reservedChallengeId
    ? db.collection("raceInviteLobbies").doc(input.reservedChallengeId)
    : null;
  /** Provides response behavior. */
  const response = await db.runTransaction(async (transaction) => {
    /** Reads the publication receipt, run owner, profile, and optional pre-shared lobby. */
    const [requestSnapshot, runSnapshot, userSnapshot, inviteLobbySnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(runRef),
      transaction.get(db.collection("users").doc(userId)),
      inviteLobbyRef ? transaction.get(inviteLobbyRef) : Promise.resolve(null),
    ]);
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    /** Stores d run. */
    const storedRun = parseRunRecord(runSnapshot.data(), runSnapshot.id);
    if (storedRun.userId !== userId)
      throw new HttpsError("permission-denied", "This race run belongs to another player.");
    /** Provides privacy behavior. */
    const privacy = await resolveRaceOpponentPrivacy(transaction, db, storedRun);
    /** Provides run behavior. */
    const run = privacy.run;
    if (requestSnapshot.exists) {
      if (privacy.scrubbed) transaction.set(runRef, raceRunPrivacyWrite(run, true), {merge: true});
      return requestSnapshot.data()?.response as PublishRaceChallengeResponse;
    }
    if (inviteLobbySnapshot?.exists) {
      /** Validated lobby state authorizing publication by its creator. */
      const lobby = parseRaceInvitation(inviteLobbySnapshot.data(), false, inviteLobbySnapshot.id);
      if (lobby.creatorId !== userId) throw new HttpsError("permission-denied", "This invite lobby belongs to another player.");
      assertRaceInvitationOpen(lobby, nowMs);
      if (lobby.locale !== run.locale) throw new HttpsError("failed-precondition", "RaceTo10.ERROR_LOCALE_MISMATCH");
    }
    /** Challenge already published for this run, if any. */
    const publishedChallengeId = runSnapshot.data()?.publishedChallengeId;
    if (typeof publishedChallengeId === "string" && publishedChallengeId.length > 0) {
      if (input.reservedChallengeId && input.reservedChallengeId !== publishedChallengeId) {
        throw new HttpsError("failed-precondition", "This run was already published to another invitation.");
      }
      /** Existing challenge returned for an idempotent publication replay. */
      const existingSnapshot = await transaction.get(db.collection("raceChallenges").doc(publishedChallengeId));
      if (!existingSnapshot.exists) throw new HttpsError("internal", "The published challenge is missing.");
      /** Validated existing challenge record. */
      const existingChallenge = parseChallengeRecord(existingSnapshot.data(), existingSnapshot.id);
      return PublishRaceChallengeResponseSchema.parse({
        challengeId: publishedChallengeId,
        preview: challengePreview(existingChallenge, nowMs),
      });
    }
    /** Provides outcome behavior. */
    if (inviteLobbyRef && !inviteLobbySnapshot?.exists) {
      throw new HttpsError("failed-precondition", "Race invite reservation is unavailable.");
    }
    /** Provides outcome behavior. */
    const outcome = raceOutcome(run, nowMs);
    if (!outcome.publishable) {
      throw new HttpsError("failed-precondition", "Only a verified completed creator run can be published.");
    }
    /** Provides r. */
    const user = userSnapshot.data() ?? {};
    /** Provides display name behavior. */
    const displayName = String(user.displayName || user.username || "Riddle Quest player")
      .trim()
      .slice(0, 80);
    /** Provides avatar url behavior. */
    const avatarUrl = typeof user.avatarUrl === "string" ? user.avatarUrl : undefined;
    /** Provides expires at ms behavior. */
    const expiresAtMs = Math.min(nowMs + RACE_CHALLENGE_TTL_MS,
      inviteLobbySnapshot?.exists ? parseRaceInvitation(inviteLobbySnapshot.data(), false, inviteLobbySnapshot.id).expiresAtMs : Infinity);
    /** Provides deck snapshot behavior. */
    const deckSnapshot = await transaction.get(db.collection("raceDecks").doc(run.deckId));
    /** Provides deck behavior. */
    const deck = deckSnapshot.data() as RaceDeckRecord | undefined;
    if (!deck) throw new HttpsError("internal", "The completed race deck is missing.");
    /** Provides challenge behavior. */
    const challenge: RaceChallengeRecord = {
      recordVersion: 1,
      challengeId: challengeRef.id,
      creatorId: userId,
      creatorRunId: run.runId,
      scope: input.reservedChallengeId ? "invitation" : "public",
      rivalryChallengeId: run.rivalryChallengeId ?? run.challengeId,
      creatorSnapshot: {displayName, avatarUrl},
      categoryId: run.categoryId,
      locale: run.locale,
      deckId: run.deckId,
      canonicalRiddleIds: deck.canonicalRiddleIds,
      riddles: run.riddles.map((riddle) => ({...riddle})),
      snapshotVersion: 1,
      evaluationPolicy: run.evaluationPolicy ?? "preloaded",
      targetCorrect: RACE_TARGET_CORRECT,
      creatorWallFinishMs: outcome.wallFinishMs,
      creatorHintPenaltyMs: outcome.hintPenaltyMs,
      creatorSkipPenaltyMs: outcome.skipPenaltyMs,
      creatorTotalPenaltyMs: outcome.totalPenaltyMs,
      creatorAdjustedFinishMs: outcome.adjustedFinishMs,
      ghostEvents: run.events,
      rules: raceRules(run),
      contentVersion: raceDeckContentVersion(run.riddles),
      recordingPerformanceMs: raceDifficultyAdjustedMs(outcome.adjustedFinishMs, run.riddles, run.correctCount),
      status: "active",
      createdAtMs: nowMs,
      expiresAtMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    };
    /** Provides result behavior. */
    const result = PublishRaceChallengeResponseSchema.parse({
      challengeId: challengeRef.id,
      preview: challengePreview(challenge, nowMs),
      ...(() => {
        if (!userSnapshot.exists) return {};
        /** Provides update behavior. */
        const update = evaluateRaceAchievementEvent(userSnapshot.data() ?? {}, {kind: "challenge_published"}, nowMs);
        return {
          newlyUnlockedAchievementIds: update.newlyUnlockedAchievementIds,
          achievementCoinsAwarded: update.achievementCoinsAwarded,
          newCoins: update.newCoins,
        };
      })(),
    });
    transaction.create(challengeRef, stripUndefined(challenge));
    /** Provides candidate behavior. */
    const candidate = projectRaceMatchCandidate(challenge);
    if (candidate) transaction.create(db.doc(`raceMatchCandidates/${challenge.challengeId}`), candidate);
    if (inviteLobbyRef && inviteLobbySnapshot?.exists) {
      transaction.update(inviteLobbyRef, {status: "published", publicationState: "published", publishedAtMs: nowMs});
    }
    transaction.set(
      runRef,
      {
        ...raceRunPrivacyWrite(run, privacy.scrubbed),
        publishedChallengeId: challengeRef.id,
      },
      {merge: true},
    );
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
