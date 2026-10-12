"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readyRaceRunForUser = readyRaceRunForUser;
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceEngine_1 = require("./raceEngine");
const raceRunResponse_1 = require("./raceRunResponse");
const raceRunMutation_1 = require("./raceRunMutation");
const raceTransactionReads_1 = require("./raceTransactionReads");
const raceOpponentPrivacy_1 = require("./raceOpponentPrivacy");
const raceDeckSnapshot_1 = require("./raceDeckSnapshot");
const raceEligibility_1 = require("./raceEligibility");
const raceSetupService_1 = require("./raceSetupService");
const raceMatchOffer_1 = require("./raceMatchOffer");
/** Schedules one prepared attempt; its first accepted readiness permanently fixes the scored start. */
async function readyRaceRunForUser(userId, input, options = {}) {
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(options.db);
    /** Provides ref behavior. */
    const ref = db.doc(`raceRuns/${input.runId}`);
    /** Provides run behavior. */
    return db.runTransaction(async (attempt) => {
        /** Eligibility repeats guard reads within this same locked snapshot. */
        const transaction = (0, raceTransactionReads_1.withRaceTransactionReads)(attempt);
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists)
            throw new https_1.HttpsError("not-found", "Race to 10 run not found.");
        /** Provides stored behavior. */
        const stored = (0, raceSetupService_1.parseRunRecord)(snapshot.data(), snapshot.id);
        if (stored.userId !== userId)
            throw new https_1.HttpsError("permission-denied", "This race run belongs to another player.");
        (0, jestAccountDeletion_1.assertJestAccountActive)(await transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId)));
        /** Provides privacy behavior. */
        const privacy = await (0, raceOpponentPrivacy_1.resolveRaceOpponentPrivacy)(transaction, db, stored);
        await (0, raceRunMutation_1.assertRaceInteractionAllowed)(transaction, db, userId, privacy.run.opponent?.subjectUserId);
        if (stored.status !== "prepared") {
            /** Replay projects fresh clocks without changing the first accepted readiness. */
            const response = (0, raceRunResponse_1.projectRaceRunResponse)(privacy.run, options.nowMs ?? Date.now(), input.includeEvaluation);
            if (privacy.scrubbed)
                transaction.set(ref, (0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(privacy.run, true), { merge: true });
            return response;
        }
        /** Provides offer behavior. */
        const offer = await (0, raceMatchOffer_1.readRaceMatchOffer)(transaction, db, stored);
        /** Owned expiry cleanup does not depend on the continued availability of its publication source. */
        const abandonExpired = (nowMs) => {
            /** No countdown or scored action was accepted during preparation. */
            const expired = { ...privacy.run, status: "abandoned", result: null, wallFinishMs: 0, finishedAtMs: nowMs };
            /** Validate the terminal response before releasing the offer in this transaction. */
            const response = (0, raceRunResponse_1.projectRaceRunResponse)(expired, nowMs, input.includeEvaluation);
            transaction.set(ref, (0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(expired, privacy.scrubbed), { merge: true });
            (0, raceMatchOffer_1.recordRaceMatchTerminal)(transaction, offer, expired, nowMs);
            return response;
        };
        /** Expired preparation cannot start, so mutable archive eligibility is no longer required. */
        const preflightAtMs = options.nowMs ?? Date.now();
        if (!Number.isFinite(stored.preparationExpiresAtMs) || preflightAtMs >= stored.preparationExpiresAtMs)
            return abandonExpired(preflightAtMs);
        if (stored.challengeId) {
            /** Provides challenge snapshot behavior. */
            const challengeSnapshot = await transaction.get(db.doc(`raceChallenges/${stored.challengeId}`));
            if (!challengeSnapshot.exists)
                throw new https_1.HttpsError("failed-precondition", "Race challenge is unavailable.");
            /** Provides challenge behavior. */
            const challenge = (0, raceSetupService_1.parseChallengeRecord)(challengeSnapshot.data(), challengeSnapshot.id);
            /** Readiness rechecks authorization and immutable recording content transactionally. */
            const inspection = await (0, raceEligibility_1.inspectRaceChallengeEligibility)(transaction, db, userId, challenge, stored.locale, options.nowMs ?? Date.now(), stored.runId);
            (0, raceEligibility_1.assertRaceChallengeEligible)(inspection.reason);
            (0, raceDeckSnapshot_1.assertRacePreparedRecording)(stored, challenge, inspection.riddles);
        }
        // Sample after reads so database preparation does not consume the lead-in.
        /** Provides now ms behavior. */
        const nowMs = options.nowMs ?? Date.now();
        if (nowMs >= stored.preparationExpiresAtMs)
            return abandonExpired(nowMs);
        /** Provides scheduled behavior. */
        const scheduled = { ...privacy.run, status: "scheduled", readinessAcceptedAtMs: nowMs,
            startedAtMs: nowMs + raceEngine_1.RACE_START_LEAD_MS };
        scheduled.deadlineAtMs = (0, raceEngine_1.raceDeadlineAtMs)(scheduled);
        /** The countdown and its response share one accepted clock and commit. */
        const response = (0, raceRunResponse_1.projectRaceRunResponse)(scheduled, nowMs, input.includeEvaluation);
        transaction.set(ref, { ...(0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(scheduled, privacy.scrubbed),
            deadlineAtMs: scheduled.deadlineAtMs ?? firebaseAdmin_1.admin.firestore.FieldValue.delete() }, { merge: true });
        if (offer)
            transaction.update(offer.ref, { startsAtMs: scheduled.startedAtMs, readinessAcceptedAtMs: nowMs });
        return response;
    });
}
//# sourceMappingURL=raceRunLifecycle.js.map