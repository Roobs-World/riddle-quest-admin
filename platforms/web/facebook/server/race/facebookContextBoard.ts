import {RACE_MAX_ADJUSTED_TIME_MS, RACE_TARGET_CORRECT, type RaceLocale} from "../../../../../src/races/contracts/index.js";
import type {Firestore} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {isFacebookFirebaseUid} from "../facebookSecurity";
import {admin} from "../../../../../firebase-functions/src/shared/firebaseAdmin";
import {facebookContextKey} from "./facebookContextCompetition";
import {parseFacebookContextCompetition} from "./facebookContextService";
import {raceClock, type RaceRunRecord} from "../../../../../firebase-functions/src/race/raceEngine";
import {parseRunRecord} from "../../../../../firebase-functions/src/race/raceSetupService";
import {readFacebookLiveTournamentRun} from "./facebookLiveTournament";
import {assertFacebookTournamentDeck, type FacebookTournamentDeckBinding} from "./facebookTournament";
import {FacebookLiveContextBindingSchema, type FacebookLiveContextBinding} from "./facebookLiveContextBinding";

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
  /** Provides member behavior. */
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
  )
    throw new HttpsError("data-loss", "Stored Facebook context board entry is invalid.");
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
  /** Provides adjusted time ms behavior. */
  const adjustedTimeMs = raceClock(run, run.finishedAtMs).adjustedElapsedMs;
  if (!Number.isSafeInteger(adjustedTimeMs) || adjustedTimeMs < 0 || adjustedTimeMs > RACE_MAX_ADJUSTED_TIME_MS) {
    throw new HttpsError("data-loss", "The authoritative context score is invalid.");
  }
  return {contextKey, locale, userId, runId: run.runId, adjustedTimeMs, completedAtMs: run.finishedAtMs};
};

/** Records only the player's best server-derived run on one active seven-day context board. */
export async function recordFacebookContextBoardRun(
  userId: string,
  input: {
    /** Stores context id. */
    contextId: string; /** Stores locale. */
    /** Stores locale. */
    locale: RaceLocale; /** Stores run id. */
    /** Stores run id. */
    runId: string;
  },
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<{
  /** Stores entry. */
  entry: FacebookContextBoardEntry; /** Stores improved. */
  /** Stores improved. */
  improved: boolean;
}> {
  return recordFacebookContextBoardKeyRun(userId, {...input, contextKey: facebookContextKey(input.contextId)}, options);
}

/** Durable delivery uses the original hashed destination without recovering or persisting a raw SDK ID. */
export function recordFacebookContextBoardBindingRun(userId: string, input: {
  /** Owned completed live seat. */ runId: string;
  /** Original source language. */ locale: RaceLocale;
  /** Server-captured board and membership epochs. */ binding: FacebookLiveContextBinding;
}, options: {
  /** Trusted authority store. */ db: Firestore;
  /** Server observation clock. */ nowMs: number;
}) {
  return recordFacebookContextBoardKeyRun(userId, {runId: input.runId, locale: input.locale,
    contextKey: input.binding.contextKey, binding: input.binding}, options);
}

/** Browser and durable delivery share the same transaction, source validation and fastest-score write. */
async function recordFacebookContextBoardKeyRun(userId: string, input: {
  /** Authenticated owner's immutable source. */ runId: string;
  /** Exact content language. */ locale: RaceLocale;
  /** Domain-separated original context identity. */ contextKey: string;
  /** Worker receipt additionally proves the original selection. */ binding?: FacebookLiveContextBinding;
}, options: {
  /** Trusted authority store. */ db?: Firestore;
  /** Server observation clock. */ nowMs?: number;
}): Promise<{
  /** Public score projection has no SDK context ID. */
  entry: FacebookContextBoardEntry;
  /** A slower or duplicate attempt never rewrites the score. */ improved: boolean}> {
  if (!isFacebookFirebaseUid(userId)) throw new HttpsError("permission-denied", "Facebook identity is required.");
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.runId)) {
    throw new HttpsError("invalid-argument", "Facebook context run ID is invalid.");
  }
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new HttpsError("invalid-argument", "Facebook context board time is invalid.");
  }
  /** Provides context key behavior. */
  const contextKey = input.contextKey;
  /** Provides context ref behavior. */
  const contextRef = db.doc(`facebookContextCompetitions/${contextKey}`);
  /** Provides run ref behavior. */
  const runRef = db.doc(`raceRuns/${input.runId}`);
  /** Provides entry ref behavior. */
  const entryRef = db.doc(`facebookContextCompetitions/${contextKey}/entries/${userId}`);
  return db.runTransaction(async (transaction) => {
    /** Provides [context snapshot, run snapshot, existing snapshot] behavior. */
    const [contextSnapshot, runSnapshot, existingSnapshot] = await Promise.all([
      transaction.get(contextRef),
      transaction.get(runRef),
      transaction.get(entryRef),
    ]);
    if (!contextSnapshot.exists) throw new HttpsError("not-found", "Facebook context board was not found.");
    /** Provides competition behavior. */
    const competition = parseFacebookContextCompetition(contextSnapshot.data());
    /** Provides member behavior. */
    const member = requireMember(userId, input.locale, nowMs, competition);
    /** Recorded and live sources share the same private, immutable deck validation. */
    const source = runSnapshot.exists ? {run: parseRunRecord(runSnapshot.data(), runSnapshot.id)} :
      await readFacebookLiveTournamentRun(transaction, db, userId, input.runId);
    if (!runSnapshot.exists) {
      /** Live source selection is immutable even when the browser later chooses another context. */
      const ticket = (await transaction.get(db.doc(`liveRaceTickets/${input.runId}`))).data();
      /** Missing binding preserves existing legacy live record behavior. */
      const binding = ticket?.facebookContext === undefined ? undefined : FacebookLiveContextBindingSchema.parse(ticket.facebookContext);
      if (binding && (binding.contextKey !== contextKey || binding.createdAtMs !== competition.createdAtMs || binding.joinedAtMs !== member.joinedAtMs))
        throw new HttpsError("failed-precondition", "Original Facebook context selection is unavailable.");
      if (input.binding && (!binding || binding.contextKey !== input.binding.contextKey ||
        binding.createdAtMs !== input.binding.createdAtMs || binding.joinedAtMs !== input.binding.joinedAtMs))
        throw new HttpsError("data-loss", "Stored Facebook context receipt is invalid.");
    }
    /** Owned live winners bind both seats to the creator's frozen deck. */
    const run = source.run;
    /** Legacy recorded runs retain their independently stored deck contract. */
    const deck = "deck" in source ? source.deck :
      (await transaction.get(db.doc(`raceDecks/${run.deckId}`))).data() as FacebookTournamentDeckBinding | undefined;
    if (!deck) throw new HttpsError("data-loss", "Facebook context race deck was not found.");
    assertFacebookTournamentDeck(run, deck);
    if (run.finishedAtMs !== undefined && run.finishedAtMs > nowMs)
      throw new HttpsError("failed-precondition", "Facebook context race has not finished yet.");
    /** Provides candidate behavior. */
    const candidate = deriveEntry(userId, input.locale, contextKey, run, member.joinedAtMs, competition.expiresAtMs);
    /** Provides existing behavior. */
    const existing = parseEntry(existingSnapshot.exists ? existingSnapshot.data() : undefined);
    if (
      existing &&
      (existing.contextKey !== contextKey || existing.userId !== userId || existing.locale !== input.locale)
    ) {
      throw new HttpsError("data-loss", "Stored Facebook context board scope is invalid.");
    }
    if (existing && (existing.completedAtMs < member.joinedAtMs || existing.completedAtMs >= competition.expiresAtMs)) {
      throw new HttpsError("data-loss", "Stored Facebook context board entry window is invalid.");
    }
    /** Provides entry behavior. */
    const entry = !existing || candidate.adjustedTimeMs < existing.adjustedTimeMs ? candidate : existing;
    /** Provides improved behavior. */
    const improved = entry === candidate;
    if (improved)
      transaction.set(
        entryRef,
        {
          ...entry,
          updatedAtMs: nowMs,
          expiresAt: admin.firestore.Timestamp.fromMillis(competition.expiresAtMs),
        },
        {merge: false},
      );
    return {entry, improved};
  });
}

/** Lists a bounded identity-free view for an active member of one exact context. */
export async function listFacebookContextBoard(
  userId: string,
  input: {
    /** Stores context id. */
    contextId: string; /** Stores locale. */
    /** Stores locale. */
    locale: RaceLocale;
  },
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<{
  /** Stores locale. */
  locale: RaceLocale;
  /** Stores starts at ms. */
  startsAtMs: number;
  /** Stores ends at ms. */
  endsAtMs: number;
  /** Stores sort order. */
  sortOrder: typeof FACEBOOK_CONTEXT_BOARD_SORT_ORDER;
  /** Stores rewards enabled. */
  rewardsEnabled: false;
  /** Stores standings. */
  standings: Array<{
    /** Stores rank. */
    rank: number; /** Stores adjusted time ms. */
    /** Stores adjusted time ms. */
    adjustedTimeMs: number; /** Stores is current player. */
    /** Stores is current player. */
    isCurrentPlayer: boolean;
  }>;
  /** Stores current player. */
  currentPlayer?: {
    /** Stores rank. */
    rank: number; /** Stores adjusted time ms. */
    /** Stores adjusted time ms. */
    adjustedTimeMs: number; /** Stores is current player. */
    /** Stores is current player. */
    isCurrentPlayer: true;
  };
}> {
  if (!isFacebookFirebaseUid(userId)) throw new HttpsError("permission-denied", "Facebook identity is required.");
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new HttpsError("invalid-argument", "Facebook context board time is invalid.");
  }
  /** Provides context key behavior. */
  const contextKey = facebookContextKey(input.contextId);
  /** Provides context snapshot behavior. */
  const contextSnapshot = await db.doc(`facebookContextCompetitions/${contextKey}`).get();
  if (!contextSnapshot.exists) throw new HttpsError("not-found", "Facebook context board was not found.");
  /** Provides competition behavior. */
  const competition = parseFacebookContextCompetition(contextSnapshot.data());
  requireMember(userId, input.locale, nowMs, competition);
  /** Provides snapshot behavior. */
  const snapshot = await db
    .collection(`facebookContextCompetitions/${contextKey}/entries`)
    .orderBy("adjustedTimeMs", "asc")
    .limit(50)
    .get();
  /** Provides previous time behavior. */
  let previousTime: number | undefined;
  /** Provides previous rank behavior. */
  let previousRank = 0;
  /** Provides standings behavior. */
  const standings = snapshot.docs.map((document, index) => {
    /** Provides entry behavior. */
    const entry = parseEntry(document.data());
    if (!entry || entry.contextKey !== contextKey || entry.locale !== input.locale || entry.userId !== document.id) {
      throw new HttpsError("data-loss", "Stored Facebook context board scope is invalid.");
    }
    /** Provides member behavior. */
    const member = competition.members.find(({userId: memberId}) => memberId === entry.userId);
    if (!member || entry.completedAtMs < member.joinedAtMs || entry.completedAtMs >= competition.expiresAtMs) {
      throw new HttpsError("data-loss", "Stored Facebook context board entry window is invalid.");
    }
    /** Provides rank behavior. */
    const rank = entry.adjustedTimeMs === previousTime ? previousRank : index + 1;
    previousTime = entry.adjustedTimeMs;
    previousRank = rank;
    return {rank, adjustedTimeMs: entry.adjustedTimeMs, isCurrentPlayer: document.id === userId};
  });
  /** Provides own standing behavior. */
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
