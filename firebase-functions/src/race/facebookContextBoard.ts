import {RACE_MAX_ADJUSTED_TIME_MS, RACE_TARGET_CORRECT, type RaceLocale} from "@qwordly/core/race";
import type {Firestore} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {isFacebookFirebaseUid} from "../facebook/facebookSecurity";
import {admin} from "../shared/firebaseAdmin";
import {facebookContextKey} from "./facebookContextCompetition";
import {parseFacebookContextCompetition} from "./facebookContextService";
import {raceClock, type RaceRunRecord} from "./raceEngine";
import {parseRunRecord} from "./raceSetupService";
import {assertFacebookTournamentDeck, type FacebookTournamentDeckBinding} from "./facebookTournament";

/** Defines the facebook context board sort order value. */
export const FACEBOOK_CONTEXT_BOARD_SORT_ORDER = "LOWER_IS_BETTER" as const;

/** Describes facebook context board entry. */
type FacebookContextBoardEntry = {
  /** Stores context key. */
  contextKey: string;
  /** Stores locale. */
  locale: RaceLocale;
  /** Stores user id. */
  userId: string;
  /** Stores run id. */
  runId: string;
  /** Stores adjusted time ms. */
  adjustedTimeMs: number;
  /** Stores completed at ms. */
  completedAtMs: number;
};

/** Provides require member behavior. */
const requireMember = (
  userId: string,
  locale: RaceLocale,
  nowMs: number,
  competition: ReturnType<typeof parseFacebookContextCompetition>,
): ReturnType<typeof parseFacebookContextCompetition>["members"][number] => {
  if (competition.locale !== locale) {
    throw new HttpsError("failed-precondition", "Facebook context board locale does not match.");
  }
  if (nowMs < competition.createdAtMs || nowMs >= competition.expiresAtMs) {
    throw new HttpsError("failed-precondition", "Facebook context board has expired.");
  }
  const member = competition.members.find((candidate) => candidate.userId === userId && candidate.active);
  if (!member) {
    throw new HttpsError("permission-denied", "Active Facebook context membership is required.");
  }
  return member;
};

/** Parses entry. */
const parseEntry = (value: FirebaseFirestore.DocumentData | undefined): FacebookContextBoardEntry | undefined => {
  if (value === undefined) return undefined;
  if (
    typeof value.contextKey !== "string" ||
    typeof value.locale !== "string" ||
    !isFacebookFirebaseUid(value.userId) ||
    typeof value.runId !== "string" ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(value.runId) ||
    !Number.isSafeInteger(value.adjustedTimeMs) ||
    value.adjustedTimeMs < 0 ||
    value.adjustedTimeMs > RACE_MAX_ADJUSTED_TIME_MS ||
    !Number.isSafeInteger(value.completedAtMs) ||
    value.completedAtMs < 0
  ) throw new HttpsError("data-loss", "Stored Facebook context board entry is invalid.");
  return value as FacebookContextBoardEntry;
};

/** Provides derive entry behavior. */
const deriveEntry = (
  userId: string,
  locale: RaceLocale,
  contextKey: string,
  run: RaceRunRecord,
  startsAtMs: number,
  endsAtMs: number,
): FacebookContextBoardEntry => {
  if (run.userId !== userId || run.locale !== locale) {
    throw new HttpsError("permission-denied", "Facebook context race ownership or locale is invalid.");
  }
  if (run.status !== "completed" || run.correctCount !== RACE_TARGET_CORRECT || run.finishedAtMs === undefined) {
    throw new HttpsError("failed-precondition", "Only completed authoritative Race to 10 runs qualify.");
  }
  if (run.finishedAtMs < startsAtMs || run.finishedAtMs >= endsAtMs) {
    throw new HttpsError("failed-precondition", "The race was completed outside this context board window.");
  }
  const adjustedTimeMs = raceClock(run, run.finishedAtMs).adjustedElapsedMs;
  if (!Number.isSafeInteger(adjustedTimeMs) || adjustedTimeMs < 0 || adjustedTimeMs > RACE_MAX_ADJUSTED_TIME_MS) {
    throw new HttpsError("data-loss", "The authoritative context score is invalid.");
  }
  return {contextKey, locale, userId, runId: run.runId, adjustedTimeMs, completedAtMs: run.finishedAtMs};
};

/** Records only the player's best server-derived run on one active seven-day context board. */
export async function recordFacebookContextBoardRun(
  userId: string,
  input: {contextId: string; locale: RaceLocale; runId: string},
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<{entry: FacebookContextBoardEntry; improved: boolean}> {
  if (!isFacebookFirebaseUid(userId)) throw new HttpsError("permission-denied", "Facebook identity is required.");
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.runId)) {
    throw new HttpsError("invalid-argument", "Facebook context run ID is invalid.");
  }
  const db = options.db ?? admin.firestore();
  const nowMs = options.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new HttpsError("invalid-argument", "Facebook context board time is invalid.");
  }
  const contextKey = facebookContextKey(input.contextId);
  const contextRef = db.doc(`facebookContextCompetitions/${contextKey}`);
  const runRef = db.doc(`raceRuns/${input.runId}`);
  const entryRef = db.doc(`facebookContextCompetitions/${contextKey}/entries/${userId}`);
  return db.runTransaction(async (transaction) => {
    const [contextSnapshot, runSnapshot, existingSnapshot] = await Promise.all([
      transaction.get(contextRef), transaction.get(runRef), transaction.get(entryRef),
    ]);
    if (!contextSnapshot.exists) throw new HttpsError("not-found", "Facebook context board was not found.");
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Facebook context race run was not found.");
    const competition = parseFacebookContextCompetition(contextSnapshot.data());
    const member = requireMember(userId, input.locale, nowMs, competition);
    const run = parseRunRecord(runSnapshot.data());
    const deckSnapshot = await transaction.get(db.doc(`raceDecks/${run.deckId}`));
    if (!deckSnapshot.exists) throw new HttpsError("data-loss", "Facebook context race deck was not found.");
    assertFacebookTournamentDeck(run, deckSnapshot.data() as FacebookTournamentDeckBinding);
    const candidate = deriveEntry(
      userId, input.locale, contextKey, run, member.joinedAtMs, competition.expiresAtMs,
    );
    const existing = parseEntry(existingSnapshot.exists ? existingSnapshot.data() : undefined);
    if (existing && (existing.contextKey !== contextKey || existing.userId !== userId || existing.locale !== input.locale)) {
      throw new HttpsError("data-loss", "Stored Facebook context board scope is invalid.");
    }
    if (existing && (existing.completedAtMs < member.joinedAtMs || existing.completedAtMs >= competition.expiresAtMs)) {
      throw new HttpsError("data-loss", "Stored Facebook context board entry window is invalid.");
    }
    const entry = !existing || candidate.adjustedTimeMs < existing.adjustedTimeMs ? candidate : existing;
    const improved = entry === candidate;
    if (improved) transaction.set(entryRef, {
      ...entry,
      updatedAtMs: nowMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(competition.expiresAtMs),
    }, {merge: false});
    return {entry, improved};
  });
}

/** Lists a bounded identity-free view for an active member of one exact context. */
export async function listFacebookContextBoard(
  userId: string,
  input: {contextId: string; locale: RaceLocale},
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<{
  locale: RaceLocale;
  startsAtMs: number;
  endsAtMs: number;
  sortOrder: typeof FACEBOOK_CONTEXT_BOARD_SORT_ORDER;
  rewardsEnabled: false;
  standings: Array<{rank: number; adjustedTimeMs: number; isCurrentPlayer: boolean}>;
  currentPlayer?: {rank: number; adjustedTimeMs: number; isCurrentPlayer: true};
}> {
  if (!isFacebookFirebaseUid(userId)) throw new HttpsError("permission-denied", "Facebook identity is required.");
  const db = options.db ?? admin.firestore();
  const nowMs = options.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new HttpsError("invalid-argument", "Facebook context board time is invalid.");
  }
  const contextKey = facebookContextKey(input.contextId);
  const contextSnapshot = await db.doc(`facebookContextCompetitions/${contextKey}`).get();
  if (!contextSnapshot.exists) throw new HttpsError("not-found", "Facebook context board was not found.");
  const competition = parseFacebookContextCompetition(contextSnapshot.data());
  requireMember(userId, input.locale, nowMs, competition);
  const snapshot = await db.collection(`facebookContextCompetitions/${contextKey}/entries`)
    .orderBy("adjustedTimeMs", "asc").limit(50).get();
  let previousTime: number | undefined;
  let previousRank = 0;
  const standings = snapshot.docs.map((document, index) => {
    const entry = parseEntry(document.data());
    if (
      !entry ||
      entry.contextKey !== contextKey ||
      entry.locale !== input.locale ||
      entry.userId !== document.id
    ) {
      throw new HttpsError("data-loss", "Stored Facebook context board scope is invalid.");
    }
    const member = competition.members.find(({userId: memberId}) => memberId === entry.userId);
    if (!member || entry.completedAtMs < member.joinedAtMs || entry.completedAtMs >= competition.expiresAtMs) {
      throw new HttpsError("data-loss", "Stored Facebook context board entry window is invalid.");
    }
    const rank = entry.adjustedTimeMs === previousTime ? previousRank : index + 1;
    previousTime = entry.adjustedTimeMs;
    previousRank = rank;
    return {rank, adjustedTimeMs: entry.adjustedTimeMs, isCurrentPlayer: document.id === userId};
  });
  const ownStanding = standings.find((entry) => entry.isCurrentPlayer);
  return {
    locale: input.locale,
    startsAtMs: competition.createdAtMs,
    endsAtMs: competition.expiresAtMs,
    sortOrder: FACEBOOK_CONTEXT_BOARD_SORT_ORDER,
    rewardsEnabled: false,
    standings,
    ...(ownStanding ? {currentPlayer: {...ownStanding, isCurrentPlayer: true as const}} : {}),
  };
}
