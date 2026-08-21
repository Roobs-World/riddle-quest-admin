import {RACE_DECK_SIZE, RACE_MAX_ADJUSTED_TIME_MS, RACE_TARGET_CORRECT, type RaceLocale} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {isRedditFirebaseUid} from "../reddit/redditSecurity";
import {raceClock, type RaceRunRecord} from "./raceEngine";
import {parseRunRecord} from "./raceSetupService";

/** Defines the reddit tournament duration ms value. */
export const REDDIT_TOURNAMENT_DURATION_MS = 24 * 60 * 60 * 1_000;
/** Defines the reddit tournament sort order value. */
export const REDDIT_TOURNAMENT_SORT_ORDER = "LOWER_IS_BETTER" as const;
/** Defines the max firestore timestamp ms value. */
const MAX_FIRESTORE_TIMESTAMP_MS = 253_402_300_799_999;

/** Describes reddit tournament entry. */
export type RedditTournamentEntry = {
  /** Stores tournament id. */
  tournamentId: string; /** Stores locale. */
  /** Stores locale. */
  locale: RaceLocale; /** Stores user id. */
  /** Stores user id. */
  userId: string; /** Stores run id. */
  /** Stores run id. */
  runId: string;
  /** Stores adjusted time ms. */
  adjustedTimeMs: number; /** Stores completed at ms. */
  /** Stores completed at ms. */
  completedAtMs: number;
};

/** Describes reddit tournament deck binding. */
export type RedditTournamentDeckBinding = {
  /** Stores deck id. */
  deckId: string; /** Stores locale. */
  /** Stores locale. */
  locale: RaceLocale; /** Stores category id. */
  /** Stores category id. */
  categoryId: RaceRunRecord["categoryId"];
  /** Stores rules version. */
  rulesVersion: RaceRunRecord["rulesVersion"]; /** Stores canonical riddle ids. */
  /** Stores canonical riddle ids. */
  canonicalRiddleIds: string[];
};

/** Asserts reddit tournament deck. */
export function assertRedditTournamentDeck(run: RaceRunRecord, deck: RedditTournamentDeckBinding): void {
  const ids = run.riddles.map(({canonicalRiddleId}) => canonicalRiddleId);
  if (deck.deckId !== run.deckId || deck.locale !== run.locale || deck.categoryId !== run.categoryId ||
    deck.rulesVersion !== run.rulesVersion || deck.canonicalRiddleIds.length !== RACE_DECK_SIZE ||
    ids.length !== RACE_DECK_SIZE || deck.canonicalRiddleIds.some((id, index) => id !== ids[index])) {
    throw new HttpsError("data-loss", "The authoritative race deck binding is invalid.");
  }
}

/** Provides reddit tournament window behavior. */
export function redditTournamentWindow(locale: RaceLocale, nowMs: number) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 ||
    nowMs > MAX_FIRESTORE_TIMESTAMP_MS - REDDIT_TOURNAMENT_DURATION_MS) {
    throw new HttpsError("invalid-argument", "Tournament time must be a non-negative safe integer.");
  }
  const startsAtMs = Math.floor(nowMs / REDDIT_TOURNAMENT_DURATION_MS) * REDDIT_TOURNAMENT_DURATION_MS;
  return {
    tournamentId: `reddit-race10-${locale}-${new Date(startsAtMs).toISOString().slice(0, 10)}`,
    startsAtMs, endsAtMs: startsAtMs + REDDIT_TOURNAMENT_DURATION_MS,
  };
}

/** Provides derive reddit tournament entry behavior. */
export function deriveRedditTournamentEntry(
  userId: string, locale: RaceLocale, run: RaceRunRecord, nowMs: number,
): RedditTournamentEntry {
  if (!isRedditFirebaseUid(userId) || run.userId !== userId) {
    throw new HttpsError("permission-denied", "Tournament race ownership is invalid.");
  }
  if (run.locale !== locale) throw new HttpsError("failed-precondition", "Tournament and race locales must match.");
  if (run.status !== "completed" || run.correctCount !== RACE_TARGET_CORRECT || run.finishedAtMs === undefined) {
    throw new HttpsError("failed-precondition", "Only completed authoritative Race to 10 runs qualify.");
  }
  const window = redditTournamentWindow(locale, nowMs);
  if (run.finishedAtMs < window.startsAtMs || run.finishedAtMs >= window.endsAtMs) {
    throw new HttpsError("failed-precondition", "The race was completed outside this tournament window.");
  }
  const adjustedTimeMs = raceClock(run, run.finishedAtMs).adjustedElapsedMs;
  if (!Number.isSafeInteger(adjustedTimeMs) || adjustedTimeMs < 0 || adjustedTimeMs > RACE_MAX_ADJUSTED_TIME_MS) {
    throw new HttpsError("data-loss", "The authoritative race score is invalid.");
  }
  return {tournamentId: window.tournamentId, locale, userId, runId: run.runId, adjustedTimeMs,
    completedAtMs: run.finishedAtMs};
}

/** Provides select best reddit tournament entry behavior. */
export function selectBestRedditTournamentEntry(
  existing: RedditTournamentEntry | undefined, candidate: RedditTournamentEntry,
): RedditTournamentEntry {
  if (existing && (existing.tournamentId !== candidate.tournamentId || existing.locale !== candidate.locale ||
    existing.userId !== candidate.userId)) throw new HttpsError("failed-precondition", "Tournament entry scopes do not match.");
  return !existing || candidate.adjustedTimeMs < existing.adjustedTimeMs ? candidate : existing;
}

/** Parses stored entry. */
const parseStoredEntry = (value: FirebaseFirestore.DocumentData | undefined): RedditTournamentEntry | undefined => {
  if (value === undefined) return undefined;
  if (typeof value.tournamentId !== "string" || typeof value.locale !== "string" ||
    !isRedditFirebaseUid(value.userId) || typeof value.runId !== "string" ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(value.runId) || !Number.isSafeInteger(value.adjustedTimeMs) ||
    value.adjustedTimeMs < 0 || value.adjustedTimeMs > RACE_MAX_ADJUSTED_TIME_MS ||
    !Number.isSafeInteger(value.completedAtMs) || value.completedAtMs < 0) {
    throw new HttpsError("data-loss", "Stored tournament entry is invalid.");
  }
  return value as RedditTournamentEntry;
};

/** Asserts window. */
const assertWindow = (entry: RedditTournamentEntry, window: ReturnType<typeof redditTournamentWindow>) => {
  if (entry.tournamentId !== window.tournamentId || entry.completedAtMs < window.startsAtMs ||
    entry.completedAtMs >= window.endsAtMs) throw new HttpsError("data-loss", "Stored tournament entry window is invalid.");
};

/** Records reddit tournament run. */
export async function recordRedditTournamentRun(
  userId: string, input: {runId: string; locale: RaceLocale},
  options: {db?: FirebaseFirestore.Firestore; nowMs?: number} = {},
): Promise<{entry: RedditTournamentEntry; improved: boolean}> {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.runId)) throw new HttpsError("invalid-argument", "Tournament run ID is invalid.");
  const db = options.db ?? admin.firestore();
  const nowMs = options.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 ||
    nowMs > MAX_FIRESTORE_TIMESTAMP_MS - REDDIT_TOURNAMENT_DURATION_MS) {
    throw new HttpsError("invalid-argument", "Tournament write time must be a non-negative safe integer.");
  }
  return db.runTransaction(async (transaction) => {
    const runSnapshot = await transaction.get(db.collection("raceRuns").doc(input.runId));
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Tournament race run was not found.");
    const run = parseRunRecord(runSnapshot.data());
    if (run.finishedAtMs === undefined) throw new HttpsError("failed-precondition", "Only completed authoritative Race to 10 runs qualify.");
    if (nowMs < run.finishedAtMs) throw new HttpsError("failed-precondition", "Tournament submission predates authoritative completion.");
    const window = redditTournamentWindow(input.locale, run.finishedAtMs);
    const entryRef = db.doc(`redditTournaments/${window.tournamentId}/entries/${userId}`);
    const tournamentRef = db.collection("redditTournaments").doc(window.tournamentId);
    const [deckSnapshot, existingSnapshot] = await Promise.all([
      transaction.get(db.collection("raceDecks").doc(run.deckId)), transaction.get(entryRef),
    ]);
    if (!deckSnapshot.exists) throw new HttpsError("data-loss", "Tournament race deck was not found.");
    assertRedditTournamentDeck(run, deckSnapshot.data() as RedditTournamentDeckBinding);
    const candidate = deriveRedditTournamentEntry(userId, input.locale, run, run.finishedAtMs);
    const existing = parseStoredEntry(existingSnapshot.exists ? existingSnapshot.data() : undefined);
    if (existing) assertWindow(existing, window);
    const entry = selectBestRedditTournamentEntry(existing, candidate);
    const improved = entry === candidate;
    transaction.set(tournamentRef, {tournamentId: window.tournamentId, locale: input.locale,
      startsAtMs: window.startsAtMs, endsAtMs: window.endsAtMs, sortOrder: REDDIT_TOURNAMENT_SORT_ORDER,
      rewardsEnabled: false, expiresAt: admin.firestore.Timestamp.fromMillis(window.endsAtMs)}, {merge: false});
    if (improved) transaction.set(entryRef, {...entry, updatedAtMs: nowMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(window.endsAtMs)}, {merge: false});
    return {entry, improved};
  });
}

/** Lists reddit tournament standings. */
export async function listRedditTournamentStandings(
  userId: string, locale: RaceLocale, options: {db?: FirebaseFirestore.Firestore; nowMs?: number} = {},
) {
  if (!isRedditFirebaseUid(userId)) throw new HttpsError("permission-denied", "A Reddit player identity is required.");
  const db = options.db ?? admin.firestore();
  const window = redditTournamentWindow(locale, options.nowMs ?? Date.now());
  const snapshot = await db.collection(`redditTournaments/${window.tournamentId}/entries`)
    .orderBy("adjustedTimeMs", "asc").limit(50).get();
  let previousTime: number | undefined;
  let previousRank = 0;
  const standings = snapshot.docs.map((document, index) => {
    const entry = parseStoredEntry(document.data());
    if (!entry || entry.tournamentId !== window.tournamentId || entry.locale !== locale ||
      entry.userId !== document.id) throw new HttpsError("data-loss", "Stored tournament entry scope is invalid.");
    assertWindow(entry, window);
    const rank = entry.adjustedTimeMs === previousTime ? previousRank : index + 1;
    previousTime = entry.adjustedTimeMs; previousRank = rank;
    return {rank, adjustedTimeMs: entry.adjustedTimeMs, isCurrentPlayer: document.id === userId};
  });
  const own = standings.find(({isCurrentPlayer}) => isCurrentPlayer);
  return {tournamentId: window.tournamentId, locale, startsAtMs: window.startsAtMs,
    endsAtMs: window.endsAtMs, sortOrder: REDDIT_TOURNAMENT_SORT_ORDER, rewardsEnabled: false as const,
    standings, ...(own ? {currentPlayer: {...own, isCurrentPlayer: true as const}} : {})};
}
