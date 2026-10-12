"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRaceInboxForUser = exports.getRaceOutcomeForUser = exports.getRaceChallengePreview = exports.listRaceCategoriesForLocale = exports.buildDeterministicRaceDeck = exports.getRaceChallengeForUser = exports.claimRaceInviteForUser = exports.reserveRaceInviteForUser = exports.readyRaceRunForUser = void 0;
exports.startRaceRunForUser = startRaceRunForUser;
exports.abandonRaceRunForUser = abandonRaceRunForUser;
exports.submitRaceGuessForUser = submitRaceGuessForUser;
exports.requestRaceHintForUser = requestRaceHintForUser;
exports.skipRaceRiddleForUser = skipRaceRiddleForUser;
exports.resumeRaceRunForUser = resumeRaceRunForUser;
exports.publishRaceChallengeForUser = publishRaceChallengeForUser;
const raceDeckCompatibility_1 = require("./raceDeckCompatibility");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const firebase_functions_1 = require("firebase-functions");
const node_crypto_1 = require("node:crypto");
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const raceMatchOffer_1 = require("./raceMatchOffer");
const raceEngine_1 = require("./raceEngine");
const raceReceiptPrivacy_1 = require("./raceReceiptPrivacy");
const raceOpponentPrivacy_1 = require("./raceOpponentPrivacy");
const raceSetupService_1 = require("./raceSetupService");
const raceRunMutation_1 = require("./raceRunMutation");
const raceRequestBinding_1 = require("./raceRequestBinding");
const raceEligibility_1 = require("./raceEligibility");
const raceMatchCandidates_1 = require("./raceMatchCandidates");
const raceDeckSnapshot_1 = require("./raceDeckSnapshot");
const raceMatchPerformance_1 = require("./raceMatchPerformance");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
var raceRunLifecycle_1 = require("./raceRunLifecycle");
Object.defineProperty(exports, "readyRaceRunForUser", { enumerable: true, get: function () { return raceRunLifecycle_1.readyRaceRunForUser; } });
const raceSettlement_1 = require("./raceSettlement");
const raceRunResponse_1 = require("./raceRunResponse");
const raceInvitationRecord_1 = require("./raceInvitationRecord");
const raceBot_1 = require("./raceBot");
var raceInvitation_1 = require("./raceInvitation");
Object.defineProperty(exports, "reserveRaceInviteForUser", { enumerable: true, get: function () { return raceInvitation_1.reserveRaceInviteForUser; } });
Object.defineProperty(exports, "claimRaceInviteForUser", { enumerable: true, get: function () { return raceInvitation_1.claimRaceInviteForUser; } });
Object.defineProperty(exports, "getRaceChallengeForUser", { enumerable: true, get: function () { return raceInvitation_1.getRaceChallengeForUser; } });
var raceSetupService_2 = require("./raceSetupService");
Object.defineProperty(exports, "buildDeterministicRaceDeck", { enumerable: true, get: function () { return raceSetupService_2.buildDeterministicRaceDeck; } });
Object.defineProperty(exports, "listRaceCategoriesForLocale", { enumerable: true, get: function () { return raceSetupService_2.listRaceCategoriesForLocale; } });
/** Reports one answer-free command observation outside transactions, including failed offer acceptance. */
async function startRaceRunForUser(userId, input, options = {}) {
    /** Elapsed command time includes preparation and authoritative replay, not client delivery. */
    const started = Date.now();
    /** Entry kind describes the command; an offer reference is never treated as authorization. */
    const entryKind = input.fallbackOfferId ? "fallback" : input.offerId ? "offer" : input.challengeId ? "challenge" : "creator";
    /** Pool labels stay bounded and omit the authenticated account identity. */
    const provider = (0, raceEligibility_1.raceProviderScope)(userId) ?? "legacy";
    try {
        /** Preparation and all idempotency/eligibility checks retain their existing authority. */
        const response = await prepareRaceRunForUser(userId, input, options);
        firebase_functions_1.logger.info("Race start command", { telemetryVersion: 1, disposition: "returned", entryKind, provider,
            locale: response.run.locale, categoryId: response.run.categoryId, status: response.run.status, durationMs: Date.now() - started });
        return response;
    }
    catch (error) {
        firebase_functions_1.logger.warn("Race start command", { telemetryVersion: 1, disposition: "failed", entryKind, provider,
            locale: input.locale, failureCode: error instanceof https_1.HttpsError ? error.code : "internal", durationMs: Date.now() - started });
        throw error;
    }
}
/** Prepares or replays one server-owned run without deriving authority from telemetry. */
async function prepareRaceRunForUser(userId, input, options = {}) {
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(options.db);
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    /** Starts request ref. */
    const startRequestRef = db.collection("raceStartRequests").doc((0, raceSetupService_1.requestDocumentId)(userId, input.requestId));
    /** Start intent excludes presentation because replay projects the currently owned run afresh. */
    const commandBinding = (0, raceRequestBinding_1.bindRaceRequest)({ kind: "start", input });
    /** Provides existing start behavior. */
    const existingStart = await startRequestRef.get();
    if (existingStart.exists) {
        /** Unbound history must prove its retained canonical run context. */
        const bound = (0, raceRequestBinding_1.assertRaceRequestReplay)(existingStart.data(), userId, commandBinding);
        /** Provides run id behavior. */
        const runId = existingStart.data()?.runId;
        if (typeof runId !== "string")
            throw new https_1.HttpsError("internal", "Stored race start request is invalid.");
        if (!bound) {
            /** Legacy context is read from the original physical owned run, never a mutable content catalog. */
            const source = await db.doc(`raceRuns/${runId}`).get();
            if (!source.exists)
                throw new https_1.HttpsError("not-found", "Race to 10 run not found.");
            /** Validated source is required before a legacy receipt can authorize recovery. */
            const original = (0, raceSetupService_1.parseRunRecord)(source.data(), source.id);
            if (original.userId !== userId)
                throw new https_1.HttpsError("data-loss", "Stored race request is invalid.");
            (0, raceRequestBinding_1.assertLegacyRaceStart)(input, original);
        }
        return resumeRaceRunForUser(userId, runId, { db, nowMs, includeEvaluation: input.includeEvaluation });
    }
    /** Provides run ref behavior. */
    const runRef = db.collection("raceRuns").doc();
    /** Provides deck ref behavior. */
    const deckRef = db.collection("raceDecks").doc();
    /** Provides category id behavior. */
    let categoryId;
    /** Provides riddles behavior. */
    let riddles;
    /** Provides content version behavior. */
    let contentVersion;
    /** Provides opponent behavior. */
    let opponent;
    /** Provides challenge behavior. */
    let challenge;
    /** A fallback may only consume a receipt issued by successful empty discovery. */
    const botOfferRef = input.fallbackOfferId ? db.doc(`raceBotOffers/${input.fallbackOfferId}`) : undefined;
    if (botOfferRef) {
        /** Current offer must belong to this player and requested category. */
        const snapshot = await botOfferRef.get();
        if (!snapshot.exists)
            throw new https_1.HttpsError("not-found", "Opponent offer is unavailable.");
        /** Previously accepted offers resume their existing run. */
        const offer = (0, raceBot_1.parseRaceBotOffer)(snapshot.data(), userId, input, botOfferRef.id);
        if (offer.acceptedRunId) {
            /** Aliases of an already accepted fallback still need an owner-bound receipt for this command ID. */
            return db.runTransaction(async (transaction) => {
                /** Recheck the receipt, consumed offer, original run and account together before creating an alias. */
                const [receipt, currentOffer, source, deletion] = await Promise.all([transaction.get(startRequestRef), transaction.get(botOfferRef),
                    transaction.get(db.doc(`raceRuns/${offer.acceptedRunId}`)), transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId))]);
                (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
                if (!source.exists || !currentOffer.exists)
                    throw new https_1.HttpsError("not-found", "Race to 10 run not found.");
                /** The offer may resume only its original immutable owner-bound run. */
                const original = (0, raceSetupService_1.parseRunRecord)(source.data(), source.id);
                (0, raceBot_1.assertRaceAcceptedBotRun)(original, (0, raceBot_1.parseRaceBotOffer)(currentOffer.data(), userId, input, botOfferRef.id), botOfferRef.id);
                if (receipt.exists) {
                    if (!(0, raceRequestBinding_1.assertRaceRequestReplay)(receipt.data(), userId, commandBinding))
                        (0, raceRequestBinding_1.assertLegacyRaceStart)(input, original);
                    if (receipt.data()?.runId !== original.runId)
                        throw new https_1.HttpsError("data-loss", "Stored race request is invalid.");
                }
                /** Settlement and public decoding must succeed together before accepting a new alias. */
                const refreshed = await (0, raceSettlement_1.settleRaceRun)(transaction, db, original, nowMs);
                /** Return this exact accepted projection rather than validating after alias commit. */
                const response = (0, raceRunResponse_1.projectRaceRunResponse)(refreshed, nowMs, input.includeEvaluation);
                if (!receipt.exists)
                    transaction.create(startRequestRef, { userId, runId: original.runId, fallbackOfferId: input.fallbackOfferId,
                        commandBinding, createdAtMs: nowMs, expiresAt: (0, raceReceiptPrivacy_1.raceReceiptExpiresAt)(source.data()?.expiresAt, nowMs + race_1.RACE_CHALLENGE_TTL_MS) });
                return response;
            });
        }
        if (offer.createdAtMs > nowMs || offer.expiresAtMs <= nowMs)
            throw new https_1.HttpsError("failed-precondition", "Opponent offer expired.");
    }
    if (input.rivalryChallengeId) {
        /** Provides rivalry snapshot behavior. */
        const rivalrySnapshot = await db.collection("raceChallenges").doc(input.rivalryChallengeId).get();
        if (!rivalrySnapshot.exists)
            throw new https_1.HttpsError("not-found", "Race rivalry not found.");
        /** Provides rivalry behavior. */
        const rivalry = (0, raceSetupService_1.parseChallengeRecord)(rivalrySnapshot.data(), rivalrySnapshot.id);
        (0, raceSetupService_1.assertRaceLocaleCompatible)(rivalry, input.locale);
        if (rivalry.creatorId !== userId) {
            /** Provides attempt behavior. */
            const attempt = await db
                .collection("raceAttempts")
                .doc((0, raceSetupService_1.requestDocumentId)(input.rivalryChallengeId, userId))
                .get();
            if (!attempt.exists)
                throw new https_1.HttpsError("permission-denied", "This player is not part of the rivalry.");
        }
    }
    if (input.challengeId) {
        /** Provides challenge snapshot behavior. */
        const challengeSnapshot = await db.collection("raceChallenges").doc(input.challengeId).get();
        if (!challengeSnapshot.exists)
            throw new https_1.HttpsError("not-found", "Race to 10 challenge not found.");
        challenge = (0, raceSetupService_1.parseChallengeRecord)(challengeSnapshot.data(), challengeSnapshot.id);
        (0, raceSetupService_1.assertRaceLocaleCompatible)(challenge, input.locale);
        if (challenge.creatorId === userId) {
            throw new https_1.HttpsError("failed-precondition", "You cannot compete against your own challenge.");
        }
        /** Provides preview behavior. */
        const preview = (0, raceSetupService_1.challengePreview)(challenge, nowMs);
        if (preview.status !== "active")
            throw new https_1.HttpsError("failed-precondition", `Challenge is ${preview.status}.`);
        categoryId = challenge.categoryId;
        riddles = await (0, raceSetupService_1.resolveChallengeRiddles)(db, input.locale, challenge);
        contentVersion = challenge.contentVersion;
        opponent = {
            subjectUserId: challenge.creatorId,
            displayName: challenge.creatorSnapshot.displayName,
            avatarUrl: challenge.creatorSnapshot.avatarUrl,
            adjustedFinishMs: challenge.creatorAdjustedFinishMs,
            events: challenge.ghostEvents,
        };
    }
    else {
        categoryId = input.categoryId;
        /** Provides content behavior. */
        const content = await (0, raceSetupService_1.loadEligibleContent)(db, input.locale, categoryId);
        ({ riddles, contentVersion } = (0, raceSetupService_1.buildDeterministicRaceDeck)(content, {
            locale: input.locale,
            categoryId,
            seed: botOfferRef?.id ?? runRef.id,
        }));
    }
    /** Provides run behavior. */
    const run = {
        recordVersion: 1,
        ...(challenge ? { recordingFingerprint: (0, raceDeckSnapshot_1.raceRecordingFingerprint)(challenge, riddles) } : {}),
        ...(input.offerId ? { matchOfferId: input.offerId } : {}),
        ...(input.fallbackOfferId ? { fallbackOfferId: input.fallbackOfferId } : {}),
        runId: runRef.id,
        userId,
        challengeId: input.challengeId,
        rivalryChallengeId: input.rivalryChallengeId,
        role: input.challengeId || botOfferRef ? "challenger" : "creator",
        status: input.prepare ? "prepared" : "active",
        ...(input.prepare ? { preparationExpiresAtMs: (options.nowMs ?? Date.now()) + raceEngine_1.RACE_PREPARATION_WINDOW_MS } : {}),
        categoryId,
        locale: input.locale,
        rulesVersion: challenge?.rules.version ?? race_1.RACE_RULES.version,
        rulesSnapshot: challenge?.rules ?? race_1.RACE_RULES,
        contentVersion,
        evaluationPolicy: challenge?.evaluationPolicy ?? "preloaded",
        deckId: deckRef.id,
        riddles,
        currentPosition: 0,
        correctCount: 0,
        guessesUsed: 0,
        guessHistory: [],
        hintUsed: false,
        revealedLetters: [],
        startedAtMs: input.prepare ? 0 : nowMs,
        hintPenaltyMs: 0,
        skipPenaltyMs: 0,
        events: [],
        opponent,
    };
    /** Provides expires at behavior. */
    const expiresAt = firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nowMs + race_1.RACE_CHALLENGE_TTL_MS);
    /** Provides deck behavior. */
    const deck = {
        deckId: deckRef.id,
        categoryId,
        locale: input.locale,
        canonicalRiddleIds: riddles.map((riddle) => riddle.canonicalRiddleId),
        contentVersion,
        rulesVersion: race_1.RACE_RULES.version,
        createdAtMs: nowMs,
        expiresAt,
    };
    /** A newly accepted run or alias returns the same projection validated before its writes. */
    const acceptedResponse = await db.runTransaction(async (transaction) => {
        /** Provides [duplicate start, committed challenge snapshot] behavior. */
        const matchProfileRef = db.doc(`users/${userId}/raceMatchProfiles/${input.locale}`);
        /** Provides [duplicate start, committed challenge snapshot, match profile, deletion, match offer] behavior. */
        const [duplicateStart, committedChallengeSnapshot, matchProfile, deletion, matchOffer, botOffer] = await Promise.all([
            transaction.get(startRequestRef),
            input.challengeId ? transaction.get(db.doc(`raceChallenges/${input.challengeId}`)) : Promise.resolve(null),
            transaction.get(matchProfileRef),
            transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId)),
            input.offerId ? transaction.get(db.doc(`raceMatchOffers/${input.offerId}`)) : Promise.resolve(null),
            botOfferRef ? transaction.get(botOfferRef) : Promise.resolve(null),
        ]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
        if (duplicateStart.exists) {
            if (!(0, raceRequestBinding_1.assertRaceRequestReplay)(duplicateStart.data(), userId, commandBinding)) {
                /** A concurrent historical receipt must be checked against its actual original run. */
                const source = await transaction.get(db.doc(`raceRuns/${duplicateStart.data()?.runId}`));
                if (!source.exists)
                    throw new https_1.HttpsError("not-found", "Race to 10 run not found.");
                /** Supported old receipts remain replayable only for their retained original context. */
                const original = (0, raceSetupService_1.parseRunRecord)(source.data(), source.id);
                if (original.userId !== userId)
                    throw new https_1.HttpsError("data-loss", "Stored race request is invalid.");
                (0, raceRequestBinding_1.assertLegacyRaceStart)(input, original);
            }
            return;
        }
        if (botOfferRef) {
            if (!botOffer?.exists)
                throw new https_1.HttpsError("not-found", "Opponent offer is unavailable.");
            /** Transactional acceptance revalidates ownership and expiry before creating a run. */
            const committedOffer = (0, raceBot_1.parseRaceBotOffer)(botOffer.data(), userId, input, botOfferRef.id);
            if (committedOffer.acceptedRunId) {
                /** Concurrent acceptance cannot write an alias before its original owned source is validated. */
                const original = await transaction.get(db.doc(`raceRuns/${committedOffer.acceptedRunId}`));
                if (!original.exists)
                    throw new https_1.HttpsError("not-found", "Race to 10 run not found.");
                /** Validate the actual concurrent winner, including pending settlement, inside alias acceptance. */
                const owned = (0, raceSetupService_1.parseRunRecord)(original.data(), original.id);
                (0, raceBot_1.assertRaceAcceptedBotRun)(owned, committedOffer, botOfferRef.id);
                /** Pending rewards roll back if this accepted response cannot be delivered. */
                const refreshed = await (0, raceSettlement_1.settleRaceRun)(transaction, db, owned, nowMs);
                /** The alias inherits the original source's retention cap. */
                const response = (0, raceRunResponse_1.projectRaceRunResponse)(refreshed, nowMs, input.includeEvaluation);
                transaction.create(startRequestRef, { runId: committedOffer.acceptedRunId, userId, fallbackOfferId: input.fallbackOfferId,
                    commandBinding, createdAtMs: nowMs, expiresAt: (0, raceReceiptPrivacy_1.raceReceiptExpiresAt)(original.data()?.expiresAt, nowMs + race_1.RACE_CHALLENGE_TTL_MS) });
                return response;
            }
            /** Provides acceptance now behavior. */
            const acceptanceNow = options.nowMs ?? Date.now();
            if (committedOffer.createdAtMs > acceptanceNow || committedOffer.expiresAtMs <= acceptanceNow)
                throw new https_1.HttpsError("failed-precondition", "Opponent offer expired.");
            opponent = (0, raceBot_1.buildRaceBotOpponent)(committedOffer, botOfferRef.id, riddles);
            run.opponent = opponent;
        }
        (0, raceMatchOffer_1.assertRaceMatchOfferForStart)(matchOffer, userId, input, run);
        if (input.challengeId) {
            if (!committedChallengeSnapshot?.exists)
                throw new https_1.HttpsError("not-found", "Race to 10 challenge not found.");
            /** Provides committed challenge behavior. */
            const committedChallenge = (0, raceSetupService_1.parseChallengeRecord)(committedChallengeSnapshot.data(), committedChallengeSnapshot.id);
            /** Acceptance binds the prepared run to the same authorized immutable recording. */
            const inspection = await (0, raceEligibility_1.inspectRaceChallengeEligibility)(transaction, db, userId, committedChallenge, input.locale, nowMs);
            (0, raceEligibility_1.assertRaceChallengeEligible)(inspection.reason);
            (0, raceDeckSnapshot_1.assertRacePreparedRecording)(run, committedChallenge, inspection.riddles);
        }
        /** Invalid public content cannot consume an exclusive attempt or create a half-accepted start. */
        const response = (0, raceRunResponse_1.projectRaceRunResponse)(run, nowMs, input.includeEvaluation);
        /** Provides profile behavior. */
        const profile = matchProfile.exists ? raceMatchPerformance_1.RaceMatchProfileSchema.parse(matchProfile.data()) : (0, raceMatchPerformance_1.emptyRaceMatchProfile)();
        transaction.set(matchProfileRef, (0, raceMatchPerformance_1.recordRaceExposure)(profile, userId, riddles, challenge?.creatorId));
        transaction.create(deckRef, (0, raceSetupService_1.stripUndefined)(deck));
        transaction.create(runRef, { ...(0, raceSetupService_1.stripUndefined)({ ...run, deadlineAtMs: (0, raceEngine_1.raceDeadlineAtMs)(run) }), expiresAt });
        transaction.create(startRequestRef, { runId: runRef.id, userId, commandBinding, ...(input.fallbackOfferId ? { fallbackOfferId: input.fallbackOfferId } : {}), createdAtMs: nowMs, expiresAt });
        if (botOfferRef)
            transaction.update(botOfferRef, { acceptedRunId: runRef.id });
        if (matchOffer)
            transaction.update(matchOffer.ref, { acceptedRunId: runRef.id, acceptedAtMs: nowMs,
                preparationRequested: Boolean(input.prepare), offerExpiredAtAcceptance: matchOffer.data().expiresAtMs <= nowMs,
                ...(!input.prepare ? { startsAtMs: run.startedAtMs } : {}), expiresAt });
        if (input.challengeId) {
            transaction.create(db.collection("raceAttempts").doc((0, raceSetupService_1.requestDocumentId)(input.challengeId, userId)), {
                challengeId: input.challengeId,
                playerId: userId,
                runId: runRef.id,
                createdAtMs: nowMs,
                expiresAt,
            });
        }
        return response;
    });
    if (acceptedResponse)
        return acceptedResponse;
    /** Provides committed start behavior. */
    const committedStart = await startRequestRef.get();
    (0, raceRequestBinding_1.assertRaceRequestReplay)(committedStart.data(), userId, commandBinding);
    /** Provides committed run id behavior. */
    const committedRunId = committedStart.data()?.runId;
    if (typeof committedRunId !== "string")
        throw new https_1.HttpsError("internal", "Race start was not committed.");
    return resumeRaceRunForUser(userId, committedRunId, { db, nowMs, includeEvaluation: input.includeEvaluation });
}
/** Provides abandon race run for user behavior. */
async function abandonRaceRunForUser(userId, input, options = {}) {
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(options.db);
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    /** Provides response behavior. */
    const response = await (0, raceRunMutation_1.mutateRaceRun)(userId, { kind: "abandon", input }, nowMs, db, (run, acceptedAtMs) => {
        /** Provides abandoned behavior. */
        const abandoned = (0, raceEngine_1.abandonRaceRun)(run, acceptedAtMs);
        return {
            run: abandoned,
            response: {
                run: (0, raceEngine_1.toRaceRunView)(abandoned, acceptedAtMs),
                result: null,
            },
        };
    });
    return race_1.AbandonRaceRunResponseSchema.parse(response);
}
/** Submits race guess for user. */
async function submitRaceGuessForUser(userId, input, options = {}) {
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(options.db);
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    /** Provides response behavior. */
    const response = await (0, raceRunMutation_1.mutateRaceRun)(userId, { kind: "guess", input }, nowMs, db, (run, acceptedAtMs) => {
        /** Provides result behavior. */
        const result = (0, raceEngine_1.applyRaceGuess)(run, input, acceptedAtMs);
        return {
            run: result.run,
            response: {
                run: (0, raceEngine_1.toRaceRunView)(result.run, acceptedAtMs, input.includeEvaluation),
                feedback: result.feedback,
                isCorrect: result.isCorrect,
                autoSkipped: result.autoSkipped,
            },
        };
    });
    return race_1.SubmitRaceGuessResponseSchema.parse(response);
}
/** Requests race hint for user. */
async function requestRaceHintForUser(userId, input, options = {}) {
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(options.db);
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    /** Provides response behavior. */
    const response = await (0, raceRunMutation_1.mutateRaceRun)(userId, { kind: "hint", input }, nowMs, db, (run, acceptedAtMs) => {
        /** Provides result behavior. */
        const result = (0, raceEngine_1.applyRaceHint)(run, input, acceptedAtMs);
        return {
            run: result.run,
            response: {
                run: (0, raceEngine_1.toRaceRunView)(result.run, acceptedAtMs, input.includeEvaluation),
                revealedLetter: result.revealedLetter,
                index: result.index,
            },
        };
    }, { enforceRaceAccess: options.enforceAccess });
    return race_1.RequestRaceHintResponseSchema.parse(response);
}
/** Provides skip race riddle for user behavior. */
async function skipRaceRiddleForUser(userId, input, options = {}) {
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(options.db);
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    /** Provides response behavior. */
    const response = await (0, raceRunMutation_1.mutateRaceRun)(userId, { kind: "skip", input }, nowMs, db, (run, acceptedAtMs) => {
        /** Updates d. */
        const updated = (0, raceEngine_1.applyRaceSkip)(run, input, acceptedAtMs);
        return {
            run: updated,
            response: {
                run: (0, raceEngine_1.toRaceRunView)(updated, acceptedAtMs, input.includeEvaluation),
                penaltyAddedMs: race_1.RACE_RULES.skipPenaltyMs,
            },
        };
    });
    return race_1.SkipRaceRiddleResponseSchema.parse(response);
}
/** Provides resume race run for user behavior. */
async function resumeRaceRunForUser(userId, runId, options = {}) {
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(options.db);
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    /** Provides run ref behavior. */
    const runRef = db.collection("raceRuns").doc(runId);
    /** Provides run behavior. */
    return db.runTransaction(async (transaction) => {
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(runRef);
        if (!snapshot.exists)
            throw new https_1.HttpsError("not-found", "Race to 10 run not found.");
        /** Stores d. */
        const stored = (0, raceSetupService_1.parseRunRecord)(snapshot.data(), snapshot.id);
        if (stored.userId !== userId)
            throw new https_1.HttpsError("permission-denied", "This race run belongs to another player.");
        /** Provides privacy behavior. */
        const privacy = await (0, raceOpponentPrivacy_1.resolveRaceOpponentPrivacy)(transaction, db, stored);
        /** Provides refreshed behavior. */
        const refreshed = await (0, raceSettlement_1.settleRaceRun)(transaction, db, privacy.run, nowMs);
        /** A decoding failure aborts staged rewards, outboxes and terminal transitions. */
        const response = (0, raceRunResponse_1.projectRaceRunResponse)(refreshed, nowMs, options.includeEvaluation, options.includeGuessHistory);
        if (JSON.stringify(refreshed) !== JSON.stringify(stored)) {
            transaction.set(runRef, (0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(refreshed, privacy.scrubbed), { merge: true });
        }
        return response;
    });
}
/** Publishes race challenge for user. */
async function publishRaceChallengeForUser(userId, input, options = {}) {
    if (input.reservedChallengeId) {
        /** Hash binding a reserved invitation to the authenticated creator. */
        const ownerHash = (0, node_crypto_1.createHash)("sha256").update(userId).digest("hex");
        if (!input.reservedChallengeId.startsWith(`jest-invite-${ownerHash}-`)) {
            throw new https_1.HttpsError("permission-denied", "This invitation belongs to another player.");
        }
    }
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(options.db);
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    /** Provides run ref behavior. */
    const runRef = db.collection("raceRuns").doc(input.runId);
    /** Requests ref. */
    const requestRef = runRef.collection("requests").doc((0, raceSetupService_1.requestDocumentId)(userId, input.requestId));
    /** Publication shares the run's receipt namespace with scoring, so the operation is part of its binding. */
    const commandBinding = (0, raceRequestBinding_1.bindRaceRequest)({ kind: "publish", input });
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
        if (!runSnapshot.exists)
            throw new https_1.HttpsError("not-found", "Race to 10 run not found.");
        /** Stores d run. */
        const storedRun = (0, raceSetupService_1.parseRunRecord)(runSnapshot.data(), runSnapshot.id);
        if (storedRun.userId !== userId)
            throw new https_1.HttpsError("permission-denied", "This race run belongs to another player.");
        /** Provides privacy behavior. */
        const privacy = await (0, raceOpponentPrivacy_1.resolveRaceOpponentPrivacy)(transaction, db, storedRun);
        /** Provides run behavior. */
        const run = privacy.run;
        if (requestSnapshot.exists) {
            /** Original invitation scope can also be recovered from historical publication IDs. */
            const bound = (0, raceRequestBinding_1.assertRaceRequestReplay)(requestSnapshot.data(), userId, commandBinding);
            /** Cached publication must still refer to this run's committed challenge. */
            const cached = race_1.PublishRaceChallengeResponseSchema.safeParse(requestSnapshot.data()?.response);
            if (!cached.success) {
                if (bound)
                    throw new https_1.HttpsError("data-loss", "Stored race request is invalid.");
                (0, raceRequestBinding_1.rejectRaceRequestReuse)();
            }
            if (!bound && Boolean(input.reservedChallengeId) !== cached.data.challengeId.startsWith("jest-invite-"))
                (0, raceRequestBinding_1.rejectRaceRequestReuse)();
            if (input.reservedChallengeId && input.reservedChallengeId !== cached.data.challengeId)
                (0, raceRequestBinding_1.rejectRaceRequestReuse)();
            if (runSnapshot.data()?.publishedChallengeId !== cached.data.challengeId)
                throw new https_1.HttpsError("data-loss", "Stored race request is invalid.");
            if (privacy.scrubbed)
                transaction.set(runRef, (0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(run, true), { merge: true });
            return cached.data;
        }
        if (inviteLobbySnapshot?.exists) {
            /** Validated lobby state authorizing publication by its creator. */
            const lobby = (0, raceInvitationRecord_1.parseRaceInvitation)(inviteLobbySnapshot.data(), false, inviteLobbySnapshot.id);
            if (lobby.creatorId !== userId)
                throw new https_1.HttpsError("permission-denied", "This invite lobby belongs to another player.");
            (0, raceInvitationRecord_1.assertRaceInvitationOpen)(lobby, nowMs);
            if (lobby.locale !== run.locale)
                throw new https_1.HttpsError("failed-precondition", "RaceTo10.ERROR_LOCALE_MISMATCH");
        }
        /** Challenge already published for this run, if any. */
        const publishedChallengeId = runSnapshot.data()?.publishedChallengeId;
        if (typeof publishedChallengeId === "string" && publishedChallengeId.length > 0) {
            if (input.reservedChallengeId && input.reservedChallengeId !== publishedChallengeId) {
                throw new https_1.HttpsError("failed-precondition", "This run was already published to another invitation.");
            }
            /** Existing challenge returned for an idempotent publication replay. */
            const existingSnapshot = await transaction.get(db.collection("raceChallenges").doc(publishedChallengeId));
            if (!existingSnapshot.exists)
                throw new https_1.HttpsError("internal", "The published challenge is missing.");
            /** Validated existing challenge record. */
            const existingChallenge = (0, raceSetupService_1.parseChallengeRecord)(existingSnapshot.data(), existingSnapshot.id);
            /** A new request alias retains the first returned preview without repeating publication grants. */
            const replay = race_1.PublishRaceChallengeResponseSchema.parse({
                challengeId: publishedChallengeId,
                preview: (0, raceSetupService_1.challengePreview)(existingChallenge, nowMs),
            });
            transaction.create(requestRef, { userId, commandBinding, createdAtMs: nowMs, response: (0, raceSetupService_1.stripUndefined)(replay),
                expiresAt: (0, raceReceiptPrivacy_1.raceReceiptExpiresAt)(runSnapshot.data()?.expiresAt, existingChallenge.expiresAtMs) });
            return replay;
        }
        /** Provides outcome behavior. */
        if (inviteLobbyRef && !inviteLobbySnapshot?.exists) {
            throw new https_1.HttpsError("failed-precondition", "Race invite reservation is unavailable.");
        }
        /** Provides outcome behavior. */
        const outcome = (0, raceEngine_1.raceOutcome)(run, nowMs);
        if (!outcome.publishable) {
            throw new https_1.HttpsError("failed-precondition", "Only a verified completed creator run can be published.");
        }
        // Cached publications above retain their original receipt; only new publication must authorize this content.
        (0, raceDeckCompatibility_1.assertRaceDeckCompatible)(run.riddles, run.locale);
        /** Provides r. */
        const user = userSnapshot.data() ?? {};
        /** Provides display name behavior. */
        const displayName = String(user.displayName || user.username || "Riddle Quest player")
            .trim()
            .slice(0, 80);
        /** Provides avatar url behavior. */
        const avatarUrl = typeof user.avatarUrl === "string" ? user.avatarUrl : undefined;
        /** Provides expires at ms behavior. */
        const expiresAtMs = Math.min(nowMs + race_1.RACE_CHALLENGE_TTL_MS, inviteLobbySnapshot?.exists ? (0, raceInvitationRecord_1.parseRaceInvitation)(inviteLobbySnapshot.data(), false, inviteLobbySnapshot.id).expiresAtMs : Infinity);
        /** Provides deck snapshot behavior. */
        const deckSnapshot = await transaction.get(db.collection("raceDecks").doc(run.deckId));
        /** Provides deck behavior. */
        const deck = deckSnapshot.data();
        if (!deck)
            throw new https_1.HttpsError("internal", "The completed race deck is missing.");
        /** Provides challenge behavior. */
        const challenge = {
            recordVersion: 1,
            challengeId: challengeRef.id,
            creatorId: userId,
            creatorRunId: run.runId,
            scope: input.reservedChallengeId ? "invitation" : "public",
            rivalryChallengeId: run.rivalryChallengeId ?? run.challengeId,
            creatorSnapshot: { displayName, avatarUrl },
            categoryId: run.categoryId,
            locale: run.locale,
            deckId: run.deckId,
            canonicalRiddleIds: deck.canonicalRiddleIds,
            riddles: run.riddles.map((riddle) => ({ ...riddle })),
            snapshotVersion: 1,
            evaluationPolicy: run.evaluationPolicy ?? "preloaded",
            targetCorrect: race_1.RACE_TARGET_CORRECT,
            creatorWallFinishMs: outcome.wallFinishMs,
            creatorHintPenaltyMs: outcome.hintPenaltyMs,
            creatorSkipPenaltyMs: outcome.skipPenaltyMs,
            creatorTotalPenaltyMs: outcome.totalPenaltyMs,
            creatorAdjustedFinishMs: outcome.adjustedFinishMs,
            ghostEvents: run.events,
            rules: (0, raceEngine_1.raceRules)(run),
            contentVersion: (0, raceDeckSnapshot_1.raceDeckContentVersion)(run.riddles),
            recordingPerformanceMs: (0, raceMatchPerformance_1.raceDifficultyAdjustedMs)(outcome.adjustedFinishMs, run.riddles, run.correctCount),
            status: "active",
            createdAtMs: nowMs,
            expiresAtMs,
            expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(expiresAtMs),
        };
        /** Provides result behavior. */
        const result = race_1.PublishRaceChallengeResponseSchema.parse({
            challengeId: challengeRef.id,
            preview: (0, raceSetupService_1.challengePreview)(challenge, nowMs),
            ...(() => {
                if (!userSnapshot.exists)
                    return {};
                /** Provides update behavior. */
                const update = (0, raceSetupService_1.prepareRaceAchievementEvent)(userSnapshot.data() ?? {}, { kind: "challenge_published" }, nowMs);
                return {
                    newlyUnlockedAchievementIds: update.newlyUnlockedAchievementIds,
                    achievementCoinsAwarded: update.achievementCoinsAwarded,
                    newCoins: update.newCoins,
                };
            })(),
        });
        transaction.create(challengeRef, (0, raceSetupService_1.stripUndefined)(challenge));
        /** Provides candidate behavior. */
        const candidate = (0, raceMatchCandidates_1.projectRaceMatchCandidate)(challenge);
        if (candidate)
            transaction.create(db.doc(`raceMatchCandidates/${challenge.challengeId}`), candidate);
        if (inviteLobbyRef && inviteLobbySnapshot?.exists) {
            transaction.update(inviteLobbyRef, { status: "published", publicationState: "published", publishedAtMs: nowMs });
        }
        transaction.set(runRef, {
            ...(0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(run, privacy.scrubbed),
            publishedChallengeId: challengeRef.id,
        }, { merge: true });
        if (userSnapshot.exists) {
            (0, raceSetupService_1.persistRaceAchievementEvent)(transaction, db.collection("users").doc(userId), userSnapshot.data() ?? {}, { kind: "challenge_published" }, nowMs);
        }
        transaction.create(requestRef, {
            userId,
            commandBinding,
            createdAtMs: nowMs,
            response: (0, raceSetupService_1.stripUndefined)(result),
            expiresAt: (0, raceReceiptPrivacy_1.raceReceiptExpiresAt)(runSnapshot.data()?.expiresAt, expiresAtMs),
        });
        return result;
    });
    return race_1.PublishRaceChallengeResponseSchema.parse(response);
}
var raceReadService_1 = require("./raceReadService");
Object.defineProperty(exports, "getRaceChallengePreview", { enumerable: true, get: function () { return raceReadService_1.getRaceChallengePreview; } });
Object.defineProperty(exports, "getRaceOutcomeForUser", { enumerable: true, get: function () { return raceReadService_1.getRaceOutcomeForUser; } });
Object.defineProperty(exports, "listRaceInboxForUser", { enumerable: true, get: function () { return raceReadService_1.listRaceInboxForUser; } });
//# sourceMappingURL=raceService.js.map