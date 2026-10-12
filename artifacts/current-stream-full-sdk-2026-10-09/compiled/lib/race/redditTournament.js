"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDDIT_TOURNAMENT_SORT_ORDER = exports.REDDIT_TOURNAMENT_DURATION_MS = void 0;
exports.assertRedditTournamentDeck = assertRedditTournamentDeck;
exports.redditTournamentWindow = redditTournamentWindow;
exports.deriveRedditTournamentEntry = deriveRedditTournamentEntry;
exports.selectBestRedditTournamentEntry = selectBestRedditTournamentEntry;
exports.recordRedditTournamentRun = recordRedditTournamentRun;
exports.listRedditTournamentStandings = listRedditTournamentStandings;
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const redditSecurity_1 = require("../reddit/redditSecurity");
const raceEngine_1 = require("./raceEngine");
const raceSetupService_1 = require("./raceSetupService");
const redditLiveTournament_1 = require("./redditLiveTournament");
/** Defines the reddit tournament duration ms value. */
exports.REDDIT_TOURNAMENT_DURATION_MS = 24 * 60 * 60 * 1_000;
/** Defines the reddit tournament sort order value. */
exports.REDDIT_TOURNAMENT_SORT_ORDER = "LOWER_IS_BETTER";
/** Defines the max firestore timestamp ms value. */
const MAX_FIRESTORE_TIMESTAMP_MS = 253_402_300_799_999;
/** Asserts reddit tournament deck. */
function assertRedditTournamentDeck(run, deck) {
    /** Provides ids behavior. */
    const ids = run.riddles.map(({ canonicalRiddleId }) => canonicalRiddleId);
    if (deck.deckId !== run.deckId ||
        deck.locale !== run.locale ||
        deck.categoryId !== run.categoryId ||
        deck.rulesVersion !== run.rulesVersion ||
        deck.canonicalRiddleIds.length !== race_1.RACE_DECK_SIZE ||
        ids.length !== race_1.RACE_DECK_SIZE ||
        deck.canonicalRiddleIds.some((id, index) => id !== ids[index])) {
        throw new https_1.HttpsError("data-loss", "The authoritative race deck binding is invalid.");
    }
}
/** Provides reddit tournament window behavior. */
function redditTournamentWindow(locale, nowMs) {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > MAX_FIRESTORE_TIMESTAMP_MS - exports.REDDIT_TOURNAMENT_DURATION_MS) {
        throw new https_1.HttpsError("invalid-argument", "Tournament time must be a non-negative safe integer.");
    }
    /** Starts s at ms. */
    const startsAtMs = Math.floor(nowMs / exports.REDDIT_TOURNAMENT_DURATION_MS) * exports.REDDIT_TOURNAMENT_DURATION_MS;
    return {
        tournamentId: `reddit-race10-${locale}-${new Date(startsAtMs).toISOString().slice(0, 10)}`,
        startsAtMs,
        endsAtMs: startsAtMs + exports.REDDIT_TOURNAMENT_DURATION_MS,
    };
}
/** Provides derive reddit tournament entry behavior. */
function deriveRedditTournamentEntry(userId, locale, run, nowMs) {
    if (!(0, redditSecurity_1.isRedditFirebaseUid)(userId) || run.userId !== userId) {
        throw new https_1.HttpsError("permission-denied", "Tournament race ownership is invalid.");
    }
    if (run.locale !== locale)
        throw new https_1.HttpsError("failed-precondition", "Tournament and race locales must match.");
    if (run.status !== "completed" || run.correctCount !== race_1.RACE_TARGET_CORRECT || run.finishedAtMs === undefined) {
        throw new https_1.HttpsError("failed-precondition", "Only completed authoritative Race to 10 runs qualify.");
    }
    /** Provides window behavior. */
    const window = redditTournamentWindow(locale, nowMs);
    if (run.finishedAtMs < window.startsAtMs || run.finishedAtMs >= window.endsAtMs) {
        throw new https_1.HttpsError("failed-precondition", "The race was completed outside this tournament window.");
    }
    /** Provides adjusted time ms behavior. */
    const adjustedTimeMs = (0, raceEngine_1.raceClock)(run, run.finishedAtMs).adjustedElapsedMs;
    if (!Number.isSafeInteger(adjustedTimeMs) || adjustedTimeMs < 0 || adjustedTimeMs > race_1.RACE_MAX_ADJUSTED_TIME_MS) {
        throw new https_1.HttpsError("data-loss", "The authoritative race score is invalid.");
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
/** Provides select best reddit tournament entry behavior. */
function selectBestRedditTournamentEntry(existing, candidate) {
    if (existing &&
        (existing.tournamentId !== candidate.tournamentId ||
            existing.locale !== candidate.locale ||
            existing.userId !== candidate.userId))
        throw new https_1.HttpsError("failed-precondition", "Tournament entry scopes do not match.");
    return !existing || candidate.adjustedTimeMs < existing.adjustedTimeMs ? candidate : existing;
}
/** Parses stored entry. */
const parseStoredEntry = (value) => {
    if (value === undefined)
        return undefined;
    if (typeof value.tournamentId !== "string" ||
        typeof value.locale !== "string" ||
        !(0, redditSecurity_1.isRedditFirebaseUid)(value.userId) ||
        typeof value.runId !== "string" ||
        !/^[A-Za-z0-9_-]{1,160}$/.test(value.runId) ||
        !Number.isSafeInteger(value.adjustedTimeMs) ||
        value.adjustedTimeMs < 0 ||
        value.adjustedTimeMs > race_1.RACE_MAX_ADJUSTED_TIME_MS ||
        !Number.isSafeInteger(value.completedAtMs) ||
        value.completedAtMs < 0) {
        throw new https_1.HttpsError("data-loss", "Stored tournament entry is invalid.");
    }
    return value;
};
/** Asserts window. */
const assertWindow = (entry, window) => {
    if (entry.tournamentId !== window.tournamentId ||
        entry.completedAtMs < window.startsAtMs ||
        entry.completedAtMs >= window.endsAtMs)
        throw new https_1.HttpsError("data-loss", "Stored tournament entry window is invalid.");
};
/** Records reddit tournament run. */
async function recordRedditTournamentRun(userId, input, options = {}) {
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.runId))
        throw new https_1.HttpsError("invalid-argument", "Tournament run ID is invalid.");
    /** Provides db behavior. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore();
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > MAX_FIRESTORE_TIMESTAMP_MS - exports.REDDIT_TOURNAMENT_DURATION_MS) {
        throw new https_1.HttpsError("invalid-argument", "Tournament write time must be a non-negative safe integer.");
    }
    return db.runTransaction(async (transaction) => {
        /** Provides run snapshot behavior. */
        const runSnapshot = await transaction.get(db.collection("raceRuns").doc(input.runId));
        /** Live PvP uses private matches and the independent creator frozen deck. */
        const live = runSnapshot.exists ? undefined : await (0, redditLiveTournament_1.readRedditLiveTournamentRun)(transaction, db, userId, input.runId);
        /** Provides run behavior. */
        const run = live?.run ?? (0, raceSetupService_1.parseRunRecord)(runSnapshot.data(), runSnapshot.id);
        if (run.finishedAtMs === undefined)
            throw new https_1.HttpsError("failed-precondition", "Only completed authoritative Race to 10 runs qualify.");
        if (nowMs < run.finishedAtMs)
            throw new https_1.HttpsError("failed-precondition", "Tournament submission predates authoritative completion.");
        /** Provides window behavior. */
        const window = redditTournamentWindow(input.locale, run.finishedAtMs);
        /** Provides entry ref behavior. */
        const entryRef = db.doc(`redditTournaments/${window.tournamentId}/entries/${userId}`);
        /** Provides tournament ref behavior. */
        const tournamentRef = db.collection("redditTournaments").doc(window.tournamentId);
        /** Provides [deck snapshot, existing snapshot] behavior. */
        const [deckSnapshot, existingSnapshot] = await Promise.all([
            live ? Promise.resolve(undefined) : transaction.get(db.collection("raceDecks").doc(run.deckId)),
            transaction.get(entryRef),
        ]);
        if (!live && !deckSnapshot?.exists)
            throw new https_1.HttpsError("data-loss", "Tournament race deck was not found.");
        assertRedditTournamentDeck(run, live?.deck ?? deckSnapshot.data());
        /** Provides candidate behavior. */
        const candidate = deriveRedditTournamentEntry(userId, input.locale, run, run.finishedAtMs);
        /** Provides existing behavior. */
        const existing = parseStoredEntry(existingSnapshot.exists ? existingSnapshot.data() : undefined);
        if (existing)
            assertWindow(existing, window);
        /** Provides entry behavior. */
        const entry = selectBestRedditTournamentEntry(existing, candidate);
        /** Provides improved behavior. */
        const improved = entry === candidate;
        transaction.set(tournamentRef, {
            tournamentId: window.tournamentId,
            locale: input.locale,
            startsAtMs: window.startsAtMs,
            endsAtMs: window.endsAtMs,
            sortOrder: exports.REDDIT_TOURNAMENT_SORT_ORDER,
            rewardsEnabled: false,
            expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(window.endsAtMs),
        }, { merge: false });
        if (improved)
            transaction.set(entryRef, { ...entry, updatedAtMs: nowMs, expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(window.endsAtMs) }, { merge: false });
        return { entry, improved };
    });
}
/** Lists reddit tournament standings. */
async function listRedditTournamentStandings(userId, locale, options = {}) {
    if (!(0, redditSecurity_1.isRedditFirebaseUid)(userId))
        throw new https_1.HttpsError("permission-denied", "A Reddit player identity is required.");
    /** Provides db behavior. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore();
    /** Provides window behavior. */
    const window = redditTournamentWindow(locale, options.nowMs ?? Date.now());
    /** Provides snapshot behavior. */
    const snapshot = await db
        .collection(`redditTournaments/${window.tournamentId}/entries`)
        .orderBy("adjustedTimeMs", "asc")
        .limit(50)
        .get();
    /** Provides previous time behavior. */
    let previousTime;
    /** Provides previous rank behavior. */
    let previousRank = 0;
    /** Provides standings behavior. */
    const standings = snapshot.docs.map((document, index) => {
        /** Provides entry behavior. */
        const entry = parseStoredEntry(document.data());
        if (!entry || entry.tournamentId !== window.tournamentId || entry.locale !== locale || entry.userId !== document.id)
            throw new https_1.HttpsError("data-loss", "Stored tournament entry scope is invalid.");
        assertWindow(entry, window);
        /** Provides rank behavior. */
        const rank = entry.adjustedTimeMs === previousTime ? previousRank : index + 1;
        previousTime = entry.adjustedTimeMs;
        previousRank = rank;
        return { rank, adjustedTimeMs: entry.adjustedTimeMs, isCurrentPlayer: document.id === userId };
    });
    /** Provides own behavior. */
    const own = standings.find(({ isCurrentPlayer }) => isCurrentPlayer);
    return {
        tournamentId: window.tournamentId,
        locale,
        startsAtMs: window.startsAtMs,
        endsAtMs: window.endsAtMs,
        sortOrder: exports.REDDIT_TOURNAMENT_SORT_ORDER,
        rewardsEnabled: false,
        standings,
        ...(own ? { currentPlayer: { ...own, isCurrentPlayer: true } } : {}),
    };
}
//# sourceMappingURL=redditTournament.js.map