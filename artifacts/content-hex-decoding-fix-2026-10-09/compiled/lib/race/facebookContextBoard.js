"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACEBOOK_CONTEXT_BOARD_SORT_ORDER = void 0;
exports.recordFacebookContextBoardRun = recordFacebookContextBoardRun;
exports.recordFacebookContextBoardBindingRun = recordFacebookContextBoardBindingRun;
exports.listFacebookContextBoard = listFacebookContextBoard;
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const facebookSecurity_1 = require("../facebook/facebookSecurity");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const facebookContextCompetition_1 = require("./facebookContextCompetition");
const facebookContextService_1 = require("./facebookContextService");
const raceEngine_1 = require("./raceEngine");
const raceSetupService_1 = require("./raceSetupService");
const facebookLiveTournament_1 = require("./facebookLiveTournament");
const facebookTournament_1 = require("./facebookTournament");
const facebookLiveContextBinding_1 = require("./facebookLiveContextBinding");
/** Defines the facebook context board sort order value. */
exports.FACEBOOK_CONTEXT_BOARD_SORT_ORDER = "LOWER_IS_BETTER";
/** Provides require member behavior. */
const requireMember = (userId, locale, nowMs, competition) => {
    if (competition.locale !== locale) {
        throw new https_1.HttpsError("failed-precondition", "Facebook context board locale does not match.");
    }
    if (nowMs < competition.createdAtMs || nowMs >= competition.expiresAtMs) {
        throw new https_1.HttpsError("failed-precondition", "Facebook context board has expired.");
    }
    /** Provides member behavior. */
    const member = competition.members.find((candidate) => candidate.userId === userId && candidate.active);
    if (!member) {
        throw new https_1.HttpsError("permission-denied", "Active Facebook context membership is required.");
    }
    return member;
};
/** Parses entry. */
const parseEntry = (value) => {
    if (value === undefined)
        return undefined;
    if (typeof value.contextKey !== "string" ||
        typeof value.locale !== "string" ||
        !(0, facebookSecurity_1.isFacebookFirebaseUid)(value.userId) ||
        typeof value.runId !== "string" ||
        !/^[A-Za-z0-9_-]{1,160}$/.test(value.runId) ||
        !Number.isSafeInteger(value.adjustedTimeMs) ||
        value.adjustedTimeMs < 0 ||
        value.adjustedTimeMs > race_1.RACE_MAX_ADJUSTED_TIME_MS ||
        !Number.isSafeInteger(value.completedAtMs) ||
        value.completedAtMs < 0)
        throw new https_1.HttpsError("data-loss", "Stored Facebook context board entry is invalid.");
    return value;
};
/** Provides derive entry behavior. */
const deriveEntry = (userId, locale, contextKey, run, startsAtMs, endsAtMs) => {
    if (run.userId !== userId || run.locale !== locale) {
        throw new https_1.HttpsError("permission-denied", "Facebook context race ownership or locale is invalid.");
    }
    if (run.status !== "completed" || run.correctCount !== race_1.RACE_TARGET_CORRECT || run.finishedAtMs === undefined) {
        throw new https_1.HttpsError("failed-precondition", "Only completed authoritative Race to 10 runs qualify.");
    }
    if (run.finishedAtMs < startsAtMs || run.finishedAtMs >= endsAtMs) {
        throw new https_1.HttpsError("failed-precondition", "The race was completed outside this context board window.");
    }
    /** Provides adjusted time ms behavior. */
    const adjustedTimeMs = (0, raceEngine_1.raceClock)(run, run.finishedAtMs).adjustedElapsedMs;
    if (!Number.isSafeInteger(adjustedTimeMs) || adjustedTimeMs < 0 || adjustedTimeMs > race_1.RACE_MAX_ADJUSTED_TIME_MS) {
        throw new https_1.HttpsError("data-loss", "The authoritative context score is invalid.");
    }
    return { contextKey, locale, userId, runId: run.runId, adjustedTimeMs, completedAtMs: run.finishedAtMs };
};
/** Records only the player's best server-derived run on one active seven-day context board. */
async function recordFacebookContextBoardRun(userId, input, options = {}) {
    return recordFacebookContextBoardKeyRun(userId, { ...input, contextKey: (0, facebookContextCompetition_1.facebookContextKey)(input.contextId) }, options);
}
/** Durable delivery uses the original hashed destination without recovering or persisting a raw SDK ID. */
function recordFacebookContextBoardBindingRun(userId, input, options) {
    return recordFacebookContextBoardKeyRun(userId, { runId: input.runId, locale: input.locale,
        contextKey: input.binding.contextKey, binding: input.binding }, options);
}
/** Browser and durable delivery share the same transaction, source validation and fastest-score write. */
async function recordFacebookContextBoardKeyRun(userId, input, options) {
    if (!(0, facebookSecurity_1.isFacebookFirebaseUid)(userId))
        throw new https_1.HttpsError("permission-denied", "Facebook identity is required.");
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.runId)) {
        throw new https_1.HttpsError("invalid-argument", "Facebook context run ID is invalid.");
    }
    /** Provides db behavior. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore();
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
        throw new https_1.HttpsError("invalid-argument", "Facebook context board time is invalid.");
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
        if (!contextSnapshot.exists)
            throw new https_1.HttpsError("not-found", "Facebook context board was not found.");
        /** Provides competition behavior. */
        const competition = (0, facebookContextService_1.parseFacebookContextCompetition)(contextSnapshot.data());
        /** Provides member behavior. */
        const member = requireMember(userId, input.locale, nowMs, competition);
        /** Recorded and live sources share the same private, immutable deck validation. */
        const source = runSnapshot.exists ? { run: (0, raceSetupService_1.parseRunRecord)(runSnapshot.data(), runSnapshot.id) } :
            await (0, facebookLiveTournament_1.readFacebookLiveTournamentRun)(transaction, db, userId, input.runId);
        if (!runSnapshot.exists) {
            /** Live source selection is immutable even when the browser later chooses another context. */
            const ticket = (await transaction.get(db.doc(`liveRaceTickets/${input.runId}`))).data();
            /** Missing binding preserves existing legacy live record behavior. */
            const binding = ticket?.facebookContext === undefined ? undefined : facebookLiveContextBinding_1.FacebookLiveContextBindingSchema.parse(ticket.facebookContext);
            if (binding && (binding.contextKey !== contextKey || binding.createdAtMs !== competition.createdAtMs || binding.joinedAtMs !== member.joinedAtMs))
                throw new https_1.HttpsError("failed-precondition", "Original Facebook context selection is unavailable.");
            if (input.binding && (!binding || binding.contextKey !== input.binding.contextKey ||
                binding.createdAtMs !== input.binding.createdAtMs || binding.joinedAtMs !== input.binding.joinedAtMs))
                throw new https_1.HttpsError("data-loss", "Stored Facebook context receipt is invalid.");
        }
        /** Owned live winners bind both seats to the creator's frozen deck. */
        const run = source.run;
        /** Legacy recorded runs retain their independently stored deck contract. */
        const deck = "deck" in source ? source.deck :
            (await transaction.get(db.doc(`raceDecks/${run.deckId}`))).data();
        if (!deck)
            throw new https_1.HttpsError("data-loss", "Facebook context race deck was not found.");
        (0, facebookTournament_1.assertFacebookTournamentDeck)(run, deck);
        if (run.finishedAtMs !== undefined && run.finishedAtMs > nowMs)
            throw new https_1.HttpsError("failed-precondition", "Facebook context race has not finished yet.");
        /** Provides candidate behavior. */
        const candidate = deriveEntry(userId, input.locale, contextKey, run, member.joinedAtMs, competition.expiresAtMs);
        /** Provides existing behavior. */
        const existing = parseEntry(existingSnapshot.exists ? existingSnapshot.data() : undefined);
        if (existing &&
            (existing.contextKey !== contextKey || existing.userId !== userId || existing.locale !== input.locale)) {
            throw new https_1.HttpsError("data-loss", "Stored Facebook context board scope is invalid.");
        }
        if (existing && (existing.completedAtMs < member.joinedAtMs || existing.completedAtMs >= competition.expiresAtMs)) {
            throw new https_1.HttpsError("data-loss", "Stored Facebook context board entry window is invalid.");
        }
        /** Provides entry behavior. */
        const entry = !existing || candidate.adjustedTimeMs < existing.adjustedTimeMs ? candidate : existing;
        /** Provides improved behavior. */
        const improved = entry === candidate;
        if (improved)
            transaction.set(entryRef, {
                ...entry,
                updatedAtMs: nowMs,
                expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(competition.expiresAtMs),
            }, { merge: false });
        return { entry, improved };
    });
}
/** Lists a bounded identity-free view for an active member of one exact context. */
async function listFacebookContextBoard(userId, input, options = {}) {
    if (!(0, facebookSecurity_1.isFacebookFirebaseUid)(userId))
        throw new https_1.HttpsError("permission-denied", "Facebook identity is required.");
    /** Provides db behavior. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore();
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
        throw new https_1.HttpsError("invalid-argument", "Facebook context board time is invalid.");
    }
    /** Provides context key behavior. */
    const contextKey = (0, facebookContextCompetition_1.facebookContextKey)(input.contextId);
    /** Provides context snapshot behavior. */
    const contextSnapshot = await db.doc(`facebookContextCompetitions/${contextKey}`).get();
    if (!contextSnapshot.exists)
        throw new https_1.HttpsError("not-found", "Facebook context board was not found.");
    /** Provides competition behavior. */
    const competition = (0, facebookContextService_1.parseFacebookContextCompetition)(contextSnapshot.data());
    requireMember(userId, input.locale, nowMs, competition);
    /** Provides snapshot behavior. */
    const snapshot = await db
        .collection(`facebookContextCompetitions/${contextKey}/entries`)
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
        const entry = parseEntry(document.data());
        if (!entry || entry.contextKey !== contextKey || entry.locale !== input.locale || entry.userId !== document.id) {
            throw new https_1.HttpsError("data-loss", "Stored Facebook context board scope is invalid.");
        }
        /** Provides member behavior. */
        const member = competition.members.find(({ userId: memberId }) => memberId === entry.userId);
        if (!member || entry.completedAtMs < member.joinedAtMs || entry.completedAtMs >= competition.expiresAtMs) {
            throw new https_1.HttpsError("data-loss", "Stored Facebook context board entry window is invalid.");
        }
        /** Provides rank behavior. */
        const rank = entry.adjustedTimeMs === previousTime ? previousRank : index + 1;
        previousTime = entry.adjustedTimeMs;
        previousRank = rank;
        return { rank, adjustedTimeMs: entry.adjustedTimeMs, isCurrentPlayer: document.id === userId };
    });
    /** Provides own standing behavior. */
    const ownStanding = standings.find((entry) => entry.isCurrentPlayer);
    return {
        locale: input.locale,
        startsAtMs: competition.createdAtMs,
        endsAtMs: competition.expiresAtMs,
        sortOrder: exports.FACEBOOK_CONTEXT_BOARD_SORT_ORDER,
        rewardsEnabled: false,
        standings,
        ...(ownStanding ? { currentPlayer: { ...ownStanding, isCurrentPlayer: true } } : {}),
    };
}
//# sourceMappingURL=facebookContextBoard.js.map