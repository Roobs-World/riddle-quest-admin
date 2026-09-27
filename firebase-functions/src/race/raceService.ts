import {admin} from "../shared/firebaseAdmin";
import {createHash, randomUUID} from "node:crypto";
import {
  AbandonRaceRunResponseSchema,
  PublishRaceChallengeResponseSchema,
  ReserveRaceInviteResponseSchema,
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
  type ReserveRaceInviteRequest,
  type ReserveRaceInviteResponse,
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

/** Server-owned two-seat lobby created before Jest opens its referral dialog. */
type RaceInviteLobbyRecord = {
  /** Opaque identifier carried by the provider referral payload. */
  challengeId: string;
  /** Internal user that created the invitation. */
  creatorId: string;
  /** First authenticated user to claim the second seat. */
  recipientId?: string;
  /** Content locale shared by both lobby seats. */
  locale: StartRaceRunRequest["locale"];
  /** Current server-owned invitation lifecycle state. */
  status: "inviting" | "claimed" | "published";
  /** Creation time in Unix milliseconds. */
  createdAtMs: number;
  /** Expiration time in Unix milliseconds. */
  expiresAtMs: number;
};

/** Parses only the fields used to authorize an invite-lobby transition. */
const parseRaceInviteLobby = (value: FirebaseFirestore.DocumentData | undefined): RaceInviteLobbyRecord => {
  if (
    !value ||
    typeof value.challengeId !== "string" ||
    typeof value.creatorId !== "string" ||
    (value.recipientId !== undefined && typeof value.recipientId !== "string") ||
    !["inviting", "claimed", "published"].includes(value.status) ||
    typeof value.createdAtMs !== "number" ||
    typeof value.expiresAtMs !== "number"
  ) {
    throw new HttpsError("internal", "Stored race invite lobby is invalid.");
  }
  return value as RaceInviteLobbyRecord;
};

/** Reserves an idempotent, expiring invite lobby before any provider share UI opens. */
export async function reserveRaceInviteForUser(
  userId: string,
  input: ReserveRaceInviteRequest,
  options: {
    /** Optional Firestore boundary used by integration tests. */
    db?: Firestore;
    /** Optional clock boundary used by integration tests. */
    nowMs?: number;
  } = {},
): Promise<ReserveRaceInviteResponse> {
  /** Authoritative storage and time boundary. */
  const db = dbOrDefault(options.db);
  /** Current server time used for creation and expiry. */
  const nowMs = options.nowMs ?? Date.now();
  /** Idempotency receipt for this user-scoped reservation request. */
  const requestRef = db.collection("raceInviteRequests").doc(requestDocumentId(userId, input.requestId));
  /** Non-reversible creator component used to namespace the opaque challenge ID. */
  const ownerHash = createHash("sha256").update(userId).digest("hex");
  /** Opaque challenge identifier sent through the Jest referral entry payload. */
  const challengeId = `jest-invite-${ownerHash}-${randomUUID().replace(/-/g, "")}`;
  /** Authoritative two-seat lobby document. */
  const lobbyRef = db.collection("raceInviteLobbies").doc(challengeId);
  /** Shared expiration timestamp for the lobby and request receipt. */
  const expiresAtMs = nowMs + RACE_CHALLENGE_TTL_MS;
  /** Validated response persisted for idempotent replays. */
  const response = ReserveRaceInviteResponseSchema.parse({challengeId, expiresAtMs});
  return db.runTransaction(async (transaction) => {
    /** Existing idempotency receipt, when the request was already handled. */
    const existing = await transaction.get(requestRef);
    if (existing.exists) return ReserveRaceInviteResponseSchema.parse(existing.data()?.response);
    /** Firestore TTL timestamp shared by both reservation documents. */
    const expiresAt = admin.firestore.Timestamp.fromMillis(expiresAtMs);
    transaction.create(lobbyRef, {
      challengeId,
      creatorId: userId,
      locale: input.locale,
      status: "inviting",
      createdAtMs: nowMs,
      expiresAtMs,
      expiresAt,
    });
    transaction.create(requestRef, {userId, createdAtMs: nowMs, response, expiresAt});
    return response;
  });
}

/** Atomically assigns the first authenticated referral recipient to the lobby's second seat. */
export async function claimRaceInviteForUser(
  userId: string,
  challengeId: string,
  locale: StartRaceRunRequest["locale"],
  options: {
    /** Optional Firestore boundary used by integration tests. */
    db?: Firestore;
    /** Optional clock boundary used by integration tests. */
    nowMs?: number;
  } = {},
): Promise<boolean> {
  if (!challengeId.startsWith("jest-invite-")) return false;
  /** Authoritative storage boundary. */
  const db = dbOrDefault(options.db);
  /** Current server time used to reject expired invitations. */
  const nowMs = options.nowMs ?? Date.now();
  /** Authoritative two-seat lobby document. */
  const lobbyRef = db.collection("raceInviteLobbies").doc(challengeId);
  return db.runTransaction(async (transaction) => {
    /** Current lobby state read inside the claim transaction. */
    const snapshot = await transaction.get(lobbyRef);
    // Invites created by an older release remain usable during migration.
    if (!snapshot.exists) return false;
    /** Validated server-owned lobby state. */
    const lobby = parseRaceInviteLobby(snapshot.data());
    if (lobby.expiresAtMs <= nowMs) throw new HttpsError("failed-precondition", "Race invite lobby has expired.");
    if (lobby.locale !== locale) throw new HttpsError("failed-precondition", "RaceTo10.ERROR_LOCALE_MISMATCH");
    if (lobby.creatorId === userId) throw new HttpsError("failed-precondition", "The creator cannot claim their own invite.");
    await assertRaceInteractionAllowed(transaction, db, userId, lobby.creatorId);
    if (lobby.recipientId && lobby.recipientId !== userId) {
      throw new HttpsError("already-exists", "Race invite lobby has already been claimed.");
    }
    if (!lobby.recipientId) transaction.update(lobbyRef, {recipientId: userId, status: "claimed", claimedAtMs: nowMs});
    return true;
  });
}
/** Starts race run for user. */
export async function startRaceRunForUser(
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

  if (input.rivalryChallengeId) {
    /** Provides rivalry snapshot behavior. */
    const rivalrySnapshot = await db.collection("raceChallenges").doc(input.rivalryChallengeId).get();
    if (!rivalrySnapshot.exists) throw new HttpsError("not-found", "Race rivalry not found.");
    /** Provides rivalry behavior. */
    const rivalry = parseChallengeRecord(rivalrySnapshot.data());
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
    challenge = parseChallengeRecord(challengeSnapshot.data());
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
      seed: runRef.id,
    }));
  }

  /** Provides run behavior. */
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
    /** Provides the idempotency receipt, ranked attempt, challenge, and optional invite lobby. */
    const [duplicateStart, challengeAttempt, committedChallengeSnapshot, inviteLobbySnapshot] = await Promise.all([
      transaction.get(startRequestRef),
      input.challengeId
        ? transaction.get(db.collection("raceAttempts").doc(requestDocumentId(input.challengeId, userId)))
        : Promise.resolve(null),
      input.challengeId
        ? transaction.get(db.collection("raceChallenges").doc(input.challengeId))
        : Promise.resolve(null),
      input.challengeId?.startsWith("jest-invite-")
        ? transaction.get(db.collection("raceInviteLobbies").doc(input.challengeId))
        : Promise.resolve(null),
    ]);
    if (duplicateStart.exists) return;
    if (input.challengeId) {
      if (!committedChallengeSnapshot?.exists) throw new HttpsError("not-found", "Race to 10 challenge not found.");
      /** Provides committed challenge behavior. */
      const committedChallenge = parseChallengeRecord(committedChallengeSnapshot.data());
      /** Provides creator deletion snapshot behavior. */
      const creatorDeletionSnapshot = await transaction.get(
        getJestAccountDeletionRef(db, committedChallenge.creatorId),
      );
      assertJestAccountActive(creatorDeletionSnapshot);
      await assertRaceInteractionAllowed(transaction, db, userId, committedChallenge.creatorId);
      if (inviteLobbySnapshot?.exists) {
        /** Lobby state constraining which recipient may accept this challenge. */
        const lobby = parseRaceInviteLobby(inviteLobbySnapshot.data());
        if (lobby.recipientId !== userId) {
          throw new HttpsError("permission-denied", "This race invite belongs to another recipient.");
        }
      }
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
    const stored = parseRunRecord(snapshot.data());
    if (stored.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    /** Provides privacy behavior. */
    const privacy = await resolveRaceOpponentPrivacy(transaction, db, stored);
    /** Provides refreshed behavior. */
    const refreshed = refreshRaceRun(privacy.run, nowMs);
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
    const storedRun = parseRunRecord(runSnapshot.data());
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
      const lobby = parseRaceInviteLobby(inviteLobbySnapshot.data());
      if (lobby.creatorId !== userId) throw new HttpsError("permission-denied", "This invite lobby belongs to another player.");
      if (lobby.expiresAtMs <= nowMs) throw new HttpsError("failed-precondition", "Race invite lobby has expired.");
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
      const existingChallenge = parseChallengeRecord(existingSnapshot.data());
      return PublishRaceChallengeResponseSchema.parse({
        challengeId: publishedChallengeId,
        preview: challengePreview(existingChallenge, nowMs),
      });
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
    const expiresAtMs = nowMs + RACE_CHALLENGE_TTL_MS;
    /** Provides deck snapshot behavior. */
    const deckSnapshot = await transaction.get(db.collection("raceDecks").doc(run.deckId));
    /** Provides deck behavior. */
    const deck = deckSnapshot.data() as RaceDeckRecord | undefined;
    if (!deck) throw new HttpsError("internal", "The completed race deck is missing.");
    /** Provides challenge behavior. */
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
    if (inviteLobbyRef && inviteLobbySnapshot?.exists) {
      transaction.update(inviteLobbyRef, {status: "published", publishedAtMs: nowMs});
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
