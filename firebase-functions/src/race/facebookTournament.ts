import {RACE_DECK_SIZE, RACE_MAX_ADJUSTED_TIME_MS, RACE_TARGET_CORRECT, type RaceLocale} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {isFacebookFirebaseUid} from "../facebook/facebookSecurity";
import {raceClock, type RaceRunRecord} from "./raceEngine";
import {parseRunRecord} from "./raceSetupService";

/** Defines the facebook tournament duration ms value. */
export const FACEBOOK_TOURNAMENT_DURATION_MS = 24 * 60 * 60 * 1_000;
/** Defines the facebook tournament sort order value. */
export const FACEBOOK_TOURNAMENT_SORT_ORDER = "LOWER_IS_BETTER" as const;
// Firestore Timestamp's documented upper bound is 9999-12-31T23:59:59.999Z.
/** Defines the max firestore timestamp ms value. */
const MAX_FIRESTORE_TIMESTAMP_MS = 253_402_300_799_999;

/** Server-owned tournament row. It deliberately has no reward or economy fields. */
export type FacebookTournamentEntry = {
  /** Stores tournament id. */
  tournamentId: string;
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

/** Describes facebook tournament deck binding. */
export type FacebookTournamentDeckBinding = {
  /** Stores deck id. */
  deckId: string;
  /** Stores locale. */
  locale: RaceLocale;
  /** Stores category id. */
  categoryId: RaceRunRecord["categoryId"];
  /** Stores rules version. */
  rulesVersion: RaceRunRecord["rulesVersion"];
  /** Stores canonical riddle ids. */
  canonicalRiddleIds: string[];
};

/** Ensures the server-owned run still matches its immutable server-owned deck. */
export function assertFacebookTournamentDeck(
  run: RaceRunRecord,
  deck: FacebookTournamentDeckBinding,
): void {
  const runCanonicalIds = run.riddles.map(({canonicalRiddleId}) => canonicalRiddleId);
  if (
    deck.deckId !== run.deckId ||
    deck.locale !== run.locale ||
    deck.categoryId !== run.categoryId ||
    deck.rulesVersion !== run.rulesVersion ||
    deck.canonicalRiddleIds.length !== RACE_DECK_SIZE ||
    runCanonicalIds.length !== RACE_DECK_SIZE ||
    deck.canonicalRiddleIds.some((id, index) => id !== runCanonicalIds[index])
  ) {
    throw new HttpsError("data-loss", "The authoritative race deck binding is invalid.");
  }
}

/** Returns the locale-isolated UTC tournament containing the supplied instant. */
export function facebookTournamentWindow(locale: RaceLocale, nowMs: number): {
  tournamentId: string;
  startsAtMs: number;
  endsAtMs: number;
} {
  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0 ||
    nowMs > MAX_FIRESTORE_TIMESTAMP_MS - FACEBOOK_TOURNAMENT_DURATION_MS
  ) {
    throw new HttpsError("invalid-argument", "Tournament time must be a non-negative safe integer.");
  }
  const startsAtMs = Math.floor(nowMs / FACEBOOK_TOURNAMENT_DURATION_MS) * FACEBOOK_TOURNAMENT_DURATION_MS;
  const day = new Date(startsAtMs).toISOString().slice(0, 10);
  return {
    tournamentId: `facebook-race10-${locale}-${day}`,
    startsAtMs,
    endsAtMs: startsAtMs + FACEBOOK_TOURNAMENT_DURATION_MS,
  };
}

/**
 * Derives an official tournament entry from an authoritative completed run.
 * A client/Meta score is intentionally not accepted as input.
 */
export function deriveFacebookTournamentEntry(
  userId: string,
  locale: RaceLocale,
  run: RaceRunRecord,
  nowMs: number,
): FacebookTournamentEntry {
  if (!isFacebookFirebaseUid(userId) || run.userId !== userId) {
    throw new HttpsError("permission-denied", "Tournament race ownership is invalid.");
  }
  if (run.locale !== locale) {
    throw new HttpsError("failed-precondition", "Tournament and race locales must match.");
  }
  if (run.status !== "completed" || run.correctCount !== RACE_TARGET_CORRECT || run.finishedAtMs === undefined) {
    throw new HttpsError("failed-precondition", "Only completed authoritative Race to 10 runs qualify.");
  }
  const window = facebookTournamentWindow(locale, nowMs);
  if (run.finishedAtMs < window.startsAtMs || run.finishedAtMs >= window.endsAtMs) {
    throw new HttpsError("failed-precondition", "The race was completed outside this tournament window.");
  }
  const adjustedTimeMs = raceClock(run, run.finishedAtMs).adjustedElapsedMs;
  if (!Number.isSafeInteger(adjustedTimeMs) || adjustedTimeMs < 0 || adjustedTimeMs > RACE_MAX_ADJUSTED_TIME_MS) {
    throw new HttpsError("data-loss", "The authoritative race score is invalid.");
  }
  return {
    tournamentId: window.tournamentId,
    locale,
    userId,
    runId: run.runId,
    adjustedTimeMs,
    completedAtMs: run.finishedAtMs,
  };
}

/** Keeps the best official row. Equal or slower attempts never replace it. */
export function selectBestFacebookTournamentEntry(
  existing: FacebookTournamentEntry | undefined,
  candidate: FacebookTournamentEntry,
): FacebookTournamentEntry {
  if (existing && (
    existing.tournamentId !== candidate.tournamentId ||
    existing.locale !== candidate.locale ||
    existing.userId !== candidate.userId
  )) {
    throw new HttpsError("failed-precondition", "Tournament entry scopes do not match.");
  }
  return !existing || candidate.adjustedTimeMs < existing.adjustedTimeMs ? candidate : existing;
}

/** Parses stored entry. */
const parseStoredEntry = (value: FirebaseFirestore.DocumentData | undefined): FacebookTournamentEntry | undefined => {
  if (value === undefined) return undefined;
  if (
    typeof value.tournamentId !== "string" ||
    typeof value.locale !== "string" ||
    !isFacebookFirebaseUid(value.userId) ||
    typeof value.runId !== "string" ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(value.runId) ||
    !Number.isSafeInteger(value.adjustedTimeMs) ||
    value.adjustedTimeMs < 0 ||
    value.adjustedTimeMs > RACE_MAX_ADJUSTED_TIME_MS ||
    !Number.isSafeInteger(value.completedAtMs) ||
    value.completedAtMs < 0
  ) {
    throw new HttpsError("data-loss", "Stored tournament entry is invalid.");
  }
  return value as FacebookTournamentEntry;
};

/** Asserts stored entry window. */
const assertStoredEntryWindow = (
  entry: FacebookTournamentEntry,
  window: {tournamentId: string; startsAtMs: number; endsAtMs: number},
): void => {
  if (
    entry.tournamentId !== window.tournamentId ||
    entry.completedAtMs < window.startsAtMs ||
    entry.completedAtMs >= window.endsAtMs
  ) throw new HttpsError("data-loss", "Stored tournament entry window is invalid.");
};

/** Atomically records only the player's best server-derived tournament run. */
export async function recordFacebookTournamentRun(
  userId: string,
  input: {runId: string; locale: RaceLocale},
  options: {db?: FirebaseFirestore.Firestore; nowMs?: number} = {},
): Promise<{entry: FacebookTournamentEntry; improved: boolean}> {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.runId)) {
    throw new HttpsError("invalid-argument", "Tournament run ID is invalid.");
  }
  const db = options.db ?? admin.firestore();
  const nowMs = options.nowMs ?? Date.now();
  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0 ||
    nowMs > MAX_FIRESTORE_TIMESTAMP_MS - FACEBOOK_TOURNAMENT_DURATION_MS
  ) {
    throw new HttpsError("invalid-argument", "Tournament write time must be a non-negative safe integer.");
  }
  const runRef = db.collection("raceRuns").doc(input.runId);

  return db.runTransaction(async (transaction) => {
    const runSnapshot = await transaction.get(runRef);
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Tournament race run was not found.");
    const run = parseRunRecord(runSnapshot.data());
    if (run.finishedAtMs === undefined) {
      throw new HttpsError("failed-precondition", "Only completed authoritative Race to 10 runs qualify.");
    }
    if (nowMs < run.finishedAtMs) {
      throw new HttpsError("failed-precondition", "Tournament submission predates authoritative completion.");
    }
    // Bind recovery to the authoritative finish day, not the retry/submission
    // day, so a crash or midnight rollover cannot move or reject a valid run.
    const window = facebookTournamentWindow(input.locale, run.finishedAtMs);
    const entryRef = db.doc(`facebookTournaments/${window.tournamentId}/entries/${userId}`);
    const tournamentRef = db.collection("facebookTournaments").doc(window.tournamentId);
    const deckRef = db.collection("raceDecks").doc(run.deckId);
    const [deckSnapshot, existingSnapshot] = await Promise.all([
      transaction.get(deckRef),
      transaction.get(entryRef),
    ]);
    if (!deckSnapshot.exists) throw new HttpsError("data-loss", "Tournament race deck was not found.");
    assertFacebookTournamentDeck(run, deckSnapshot.data() as FacebookTournamentDeckBinding);
    const candidate = deriveFacebookTournamentEntry(userId, input.locale, run, run.finishedAtMs);
    const existing = parseStoredEntry(existingSnapshot.exists ? existingSnapshot.data() : undefined);
    if (existing) assertStoredEntryWindow(existing, window);
    const entry = selectBestFacebookTournamentEntry(existing, candidate);
    const improved = entry === candidate;
    transaction.set(tournamentRef, {
      tournamentId: window.tournamentId,
      locale: input.locale,
      startsAtMs: window.startsAtMs,
      endsAtMs: window.endsAtMs,
      sortOrder: FACEBOOK_TOURNAMENT_SORT_ORDER,
      rewardsEnabled: false,
      expiresAt: admin.firestore.Timestamp.fromMillis(window.endsAtMs),
    }, {merge: false});
    if (improved) transaction.set(entryRef, {
      ...entry,
      updatedAtMs: nowMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(window.endsAtMs),
    }, {merge: false});
    return {entry, improved};
  });
}

/** Lists a bounded, identity-free view of the active locale tournament. */
export async function listFacebookTournamentStandings(
  userId: string,
  locale: RaceLocale,
  options: {db?: FirebaseFirestore.Firestore; nowMs?: number} = {},
): Promise<{
  tournamentId: string;
  locale: RaceLocale;
  startsAtMs: number;
  endsAtMs: number;
  sortOrder: typeof FACEBOOK_TOURNAMENT_SORT_ORDER;
  rewardsEnabled: false;
  standings: Array<{rank: number; adjustedTimeMs: number; isCurrentPlayer: boolean}>;
  currentPlayer?: {rank: number; adjustedTimeMs: number; isCurrentPlayer: true};
}> {
  if (!isFacebookFirebaseUid(userId)) {
    throw new HttpsError("permission-denied", "A Facebook player identity is required.");
  }
  const db = options.db ?? admin.firestore();
  const window = facebookTournamentWindow(locale, options.nowMs ?? Date.now());
  const snapshot = await db.collection(`facebookTournaments/${window.tournamentId}/entries`)
    .orderBy("adjustedTimeMs", "asc")
    .limit(50)
    .get();
  let previousTime: number | undefined;
  let previousRank = 0;
  const standings = snapshot.docs.map((document, index) => {
    const entry = parseStoredEntry(document.data());
    if (
      !entry ||
      entry.tournamentId !== window.tournamentId ||
      entry.locale !== locale ||
      entry.userId !== document.id
    ) {
      throw new HttpsError("data-loss", "Stored tournament entry scope is invalid.");
    }
    assertStoredEntryWindow(entry, window);
    const rank = entry.adjustedTimeMs === previousTime ? previousRank : index + 1;
    previousTime = entry.adjustedTimeMs;
    previousRank = rank;
    return {rank, adjustedTimeMs: entry.adjustedTimeMs, isCurrentPlayer: document.id === userId};
  });
  const ownStanding = standings.find((entry) => entry.isCurrentPlayer);
  return {
    tournamentId: window.tournamentId,
    locale,
    startsAtMs: window.startsAtMs,
    endsAtMs: window.endsAtMs,
    sortOrder: FACEBOOK_TOURNAMENT_SORT_ORDER,
    rewardsEnabled: false,
    standings,
    ...(ownStanding
      ? {currentPlayer: {...ownStanding, isCurrentPlayer: true as const}}
      : {}),
  };
}
