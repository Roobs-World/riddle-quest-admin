"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACEBOOK_TOURNAMENT_SORT_ORDER = exports.FACEBOOK_TOURNAMENT_DURATION_MS = void 0;
exports.assertFacebookTournamentDeck = assertFacebookTournamentDeck;
exports.facebookTournamentWindow = facebookTournamentWindow;
exports.deriveFacebookTournamentEntry = deriveFacebookTournamentEntry;
exports.selectBestFacebookTournamentEntry = selectBestFacebookTournamentEntry;
exports.recordFacebookTournamentRun = recordFacebookTournamentRun;
exports.listFacebookTournamentStandings = listFacebookTournamentStandings;
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const facebookSecurity_1 = require("../facebook/facebookSecurity");
const raceEngine_1 = require("./raceEngine");
const facebookLiveTournament_1 = require("./facebookLiveTournament");
const raceSetupService_1 = require("./raceSetupService");
/** Defines the facebook tournament duration ms value. */
exports.FACEBOOK_TOURNAMENT_DURATION_MS = 24 * 60 * 60 * 1_000;
/** Defines the facebook tournament sort order value. */
exports.FACEBOOK_TOURNAMENT_SORT_ORDER = "LOWER_IS_BETTER";
// Firestore Timestamp's documented upper bound is 9999-12-31T23:59:59.999Z.
/** Defines the max firestore timestamp ms value. */
const MAX_FIRESTORE_TIMESTAMP_MS = 253_402_300_799_999;
/** Ensures the server-owned run still matches its immutable server-owned deck. */
function assertFacebookTournamentDeck(run, deck) {
    /** Provides run canonical ids behavior. */
    const runCanonicalIds = run.riddles.map(({ canonicalRiddleId }) => canonicalRiddleId);
    if (deck.deckId !== run.deckId ||
        deck.locale !== run.locale ||
        deck.categoryId !== run.categoryId ||
        deck.rulesVersion !== run.rulesVersion ||
        deck.canonicalRiddleIds.length !== race_1.RACE_DECK_SIZE ||
        runCanonicalIds.length !== race_1.RACE_DECK_SIZE ||
        deck.canonicalRiddleIds.some((id, index) => id !== runCanonicalIds[index])) {
        throw new https_1.HttpsError("data-loss", "The authoritative race deck binding is invalid.");
    }
}
/** Returns the locale-isolated UTC tournament containing the supplied instant. */
function facebookTournamentWindow(locale, nowMs) {
    if (!Number.isSafeInteger(nowMs) ||
        nowMs < 0 ||
        nowMs > MAX_FIRESTORE_TIMESTAMP_MS - exports.FACEBOOK_TOURNAMENT_DURATION_MS) {
        throw new https_1.HttpsError("invalid-argument", "Tournament time must be a non-negative safe integer.");
    }
    /** Starts s at ms. */
    const startsAtMs = Math.floor(nowMs / exports.FACEBOOK_TOURNAMENT_DURATION_MS) * exports.FACEBOOK_TOURNAMENT_DURATION_MS;
    /** Provides day behavior. */
    const day = new Date(startsAtMs).toISOString().slice(0, 10);
    return {
        tournamentId: `facebook-race10-${locale}-${day}`,
        startsAtMs,
        endsAtMs: startsAtMs + exports.FACEBOOK_TOURNAMENT_DURATION_MS,
    };
}
/**
 * Derives an official tournament entry from an authoritative completed run.
 * A client/Meta score is intentionally not accepted as input.
 */
function deriveFacebookTournamentEntry(userId, locale, run, nowMs) {
    if (!(0, facebookSecurity_1.isFacebookFirebaseUid)(userId) || run.userId !== userId) {
        throw new https_1.HttpsError("permission-denied", "Tournament race ownership is invalid.");
    }
    if (run.locale !== locale) {
        throw new https_1.HttpsError("failed-precondition", "Tournament and race locales must match.");
    }
    if (run.status !== "completed" || run.correctCount !== race_1.RACE_TARGET_CORRECT || run.finishedAtMs === undefined) {
        throw new https_1.HttpsError("failed-precondition", "Only completed authoritative Race to 10 runs qualify.");
    }
    /** Provides window behavior. */
    const window = facebookTournamentWindow(locale, nowMs);
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
/** Keeps the best official row. Equal or slower attempts never replace it. */
function selectBestFacebookTournamentEntry(existing, candidate) {
    if (existing &&
        (existing.tournamentId !== candidate.tournamentId ||
            existing.locale !== candidate.locale ||
            existing.userId !== candidate.userId)) {
        throw new https_1.HttpsError("failed-precondition", "Tournament entry scopes do not match.");
    }
    return !existing || candidate.adjustedTimeMs < existing.adjustedTimeMs ? candidate : existing;
}
/** Parses stored entry. */
const parseStoredEntry = (value) => {
    if (value === undefined)
        return undefined;
    if (typeof value.tournamentId !== "string" ||
        typeof value.locale !== "string" ||
        !(0, facebookSecurity_1.isFacebookFirebaseUid)(value.userId) ||
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
/** Asserts stored entry window. */
const assertStoredEntryWindow = (entry, window) => {
    if (entry.tournamentId !== window.tournamentId ||
        entry.completedAtMs < window.startsAtMs ||
        entry.completedAtMs >= window.endsAtMs)
        throw new https_1.HttpsError("data-loss", "Stored tournament entry window is invalid.");
};
/** Atomically records only the player's best server-derived tournament run. */
async function recordFacebookTournamentRun(userId, input, options = {}) {
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.runId)) {
        throw new https_1.HttpsError("invalid-argument", "Tournament run ID is invalid.");
    }
    /** Provides db behavior. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore();
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    if (!Number.isSafeInteger(nowMs) ||
        nowMs < 0 ||
        nowMs > MAX_FIRESTORE_TIMESTAMP_MS - exports.FACEBOOK_TOURNAMENT_DURATION_MS) {
        throw new https_1.HttpsError("invalid-argument", "Tournament write time must be a non-negative safe integer.");
    }
    /** Provides run ref behavior. */
    const runRef = db.collection("raceRuns").doc(input.runId);
    return db.runTransaction(async (transaction) => {
        /** Provides run snapshot behavior. */
        const runSnapshot = await transaction.get(runRef);
        /** Live PvP retains authority in its match rather than the recorded-race store. */
        const live = runSnapshot.exists ? undefined : await (0, facebookLiveTournament_1.readFacebookLiveTournamentRun)(transaction, db, userId, input.runId);
        /** Provides run behavior. */
        const run = live?.run ?? (0, raceSetupService_1.parseRunRecord)(runSnapshot.data(), runSnapshot.id);
        if (run.finishedAtMs === undefined) {
            throw new https_1.HttpsError("failed-precondition", "Only completed authoritative Race to 10 runs qualify.");
        }
        if (nowMs < run.finishedAtMs) {
            throw new https_1.HttpsError("failed-precondition", "Tournament submission predates authoritative completion.");
        }
        // Bind recovery to the authoritative finish day, not the retry/submission
        // day, so a crash or midnight rollover cannot move or reject a valid run.
        /** Provides window behavior. */
        const window = facebookTournamentWindow(input.locale, run.finishedAtMs);
        /** Provides entry ref behavior. */
        const entryRef = db.doc(`facebookTournaments/${window.tournamentId}/entries/${userId}`);
        /** Provides tournament ref behavior. */
        const tournamentRef = db.collection("facebookTournaments").doc(window.tournamentId);
        /** Provides deck ref behavior. */
        const deckRef = db.collection("raceDecks").doc(run.deckId);
        /** Provides [deck snapshot, existing snapshot] behavior. */
        const [deckSnapshot, existingSnapshot] = await Promise.all([live ? Promise.resolve(undefined) : transaction.get(deckRef), transaction.get(entryRef)]);
        if (!live && !deckSnapshot?.exists)
            throw new https_1.HttpsError("data-loss", "Tournament race deck was not found.");
        assertFacebookTournamentDeck(run, live?.deck ?? deckSnapshot.data());
        /** Provides candidate behavior. */
        const candidate = deriveFacebookTournamentEntry(userId, input.locale, run, run.finishedAtMs);
        /** Provides existing behavior. */
        const existing = parseStoredEntry(existingSnapshot.exists ? existingSnapshot.data() : undefined);
        if (existing)
            assertStoredEntryWindow(existing, window);
        /** Provides entry behavior. */
        const entry = selectBestFacebookTournamentEntry(existing, candidate);
        /** Provides improved behavior. */
        const improved = entry === candidate;
        transaction.set(tournamentRef, {
            tournamentId: window.tournamentId,
            locale: input.locale,
            startsAtMs: window.startsAtMs,
            endsAtMs: window.endsAtMs,
            sortOrder: exports.FACEBOOK_TOURNAMENT_SORT_ORDER,
            rewardsEnabled: false,
            expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(window.endsAtMs),
        }, { merge: false });
        if (improved)
            transaction.set(entryRef, {
                ...entry,
                updatedAtMs: nowMs,
                expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(window.endsAtMs),
            }, { merge: false });
        return { entry, improved };
    });
}
/** Lists a bounded, identity-free view of the active locale tournament. */
async function listFacebookTournamentStandings(userId, locale, options = {}) {
    if (!(0, facebookSecurity_1.isFacebookFirebaseUid)(userId)) {
        throw new https_1.HttpsError("permission-denied", "A Facebook player identity is required.");
    }
    /** Provides db behavior. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore();
    /** Provides window behavior. */
    const window = facebookTournamentWindow(locale, options.nowMs ?? Date.now());
    /** Provides snapshot behavior. */
    const snapshot = await db
        .collection(`facebookTournaments/${window.tournamentId}/entries`)
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
        if (!entry ||
            entry.tournamentId !== window.tournamentId ||
            entry.locale !== locale ||
            entry.userId !== document.id) {
            throw new https_1.HttpsError("data-loss", "Stored tournament entry scope is invalid.");
        }
        assertStoredEntryWindow(entry, window);
        /** Provides rank behavior. */
        const rank = entry.adjustedTimeMs === previousTime ? previousRank : index + 1;
        previousTime = entry.adjustedTimeMs;
        previousRank = rank;
        return { rank, adjustedTimeMs: entry.adjustedTimeMs, isCurrentPlayer: document.id === userId };
    });
    /** Provides own standing behavior. */
    const ownStanding = standings.find((entry) => entry.isCurrentPlayer);
    return {
        tournamentId: window.tournamentId,
        locale,
        startsAtMs: window.startsAtMs,
        endsAtMs: window.endsAtMs,
        sortOrder: exports.FACEBOOK_TOURNAMENT_SORT_ORDER,
        rewardsEnabled: false,
        standings,
        ...(ownStanding ? { currentPlayer: { ...ownStanding, isCurrentPlayer: true } } : {}),
    };
}
//# sourceMappingURL=facebookTournament.js.map