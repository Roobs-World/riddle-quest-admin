"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileRaceChallenge = reconcileRaceChallenge;
exports.migrateRaceArchitecturePage = migrateRaceArchitecturePage;
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceEngine_1 = require("./raceEngine");
const raceDeckSnapshot_1 = require("./raceDeckSnapshot");
const raceMatchCandidates_1 = require("./raceMatchCandidates");
const raceSetupService_1 = require("./raceSetupService");
/** Archives eligible legacy challenges and restores discovery without mutable catalog reads. */
async function reconcileRaceChallenge(transaction, db, ref, dryRun, nowMs) {
    /** Provides document behavior. */
    const [document, existing] = await Promise.all([transaction.get(ref), transaction.get(db.doc(`raceMatchCandidates/${ref.id}`))]);
    /** Corrupt/missing source records must never leave a discoverable projection behind. */
    const removeProjection = () => { if (existing.exists && !dryRun)
        transaction.delete(existing.ref); };
    if (!document.exists) {
        removeProjection();
        return existing.exists ? "changed" : "skipped";
    }
    /** Provides challenge behavior. */
    let challenge;
    try {
        challenge = (0, raceSetupService_1.parseChallengeRecord)(document.data(), document.id);
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            removeProjection();
            return "unavailable";
        }
        throw error;
    }
    if (challenge.challengeId !== document.id) {
        removeProjection();
        return "unavailable";
    }
    /** Provides [lobby, deletion, existing, original] behavior. */
    const [lobby, deletion, original] = await Promise.all([
        transaction.get(db.doc(`raceInviteLobbies/${document.id}`)),
        transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, challenge.creatorId)),
        challenge.riddles ? Promise.resolve(null) : transaction.get(db.doc(`raceRuns/${challenge.creatorRunId}`)),
    ]);
    /** Provides scope behavior. */
    const scope = lobby.exists || challenge.scope === "invitation" || document.id.startsWith("jest-invite-") ? "invitation" : "public";
    if (challenge.status !== "active" || challenge.expiresAtMs <= nowMs || deletion.exists) {
        if (existing.exists && !dryRun)
            transaction.delete(existing.ref);
        return existing.exists ? "changed" : "skipped";
    }
    /** Provides riddles behavior. */
    let riddles;
    try {
        if (!challenge.riddles && (!original?.exists || original.data()?.runId !== challenge.creatorRunId || original.data()?.userId !== challenge.creatorId || original.data()?.locale !== challenge.locale)) {
            removeProjection();
            return "unavailable";
        }
        if (!challenge.riddles)
            (0, raceDeckSnapshot_1.assertRaceCreatorArchiveLink)((0, raceSetupService_1.parseRunRecord)(original.data(), challenge.creatorRunId), challenge);
        riddles = (0, raceDeckSnapshot_1.validateRaceDeckSnapshot)(challenge.riddles ?? original?.data()?.riddles, challenge.canonicalRiddleIds, challenge.snapshotVersion === 1 ? challenge.contentVersion : undefined);
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            removeProjection();
            return "unavailable";
        }
        throw error;
    }
    /** Provides content version behavior. */
    const contentVersion = (0, raceDeckSnapshot_1.raceDeckContentVersion)(riddles);
    /** Provides candidate behavior. */
    const candidate = (0, raceMatchCandidates_1.projectRaceMatchCandidate)({ ...challenge, riddles, scope, snapshotVersion: 1, contentVersion });
    /** Provides current behavior. */
    const current = existing.data();
    /** Provides candidate changed behavior. */
    const candidateChanged = candidate ? !(0, raceMatchCandidates_1.raceMatchCandidateEquals)(current, candidate) : existing.exists;
    /** Provides archive changed behavior. */
    const archiveChanged = challenge.snapshotVersion !== 1 || challenge.scope !== scope || !challenge.riddles;
    if (!archiveChanged && !candidateChanged)
        return "skipped";
    if (!dryRun) {
        if (archiveChanged)
            transaction.update(ref, (0, raceSetupService_1.stripUndefined)({ riddles, scope, snapshotVersion: 1, contentVersion,
                rules: challenge.rules, evaluationPolicy: challenge.evaluationPolicy ?? "preloaded" }));
        if (candidateChanged && candidate)
            transaction.set(db.doc(`raceMatchCandidates/${document.id}`), candidate);
        else if (candidateChanged && existing.exists)
            transaction.delete(existing.ref);
    }
    return "changed";
}
/** Adds indexed deadlines and pinned supported rules to still-active legacy runs. */
async function migrateRun(transaction, ref, dryRun) {
    /** Provides document behavior. */
    const document = await transaction.get(ref);
    if (!document.exists || document.data()?.status !== "active")
        return "skipped";
    // Recovery metadata belongs to the deadline worker/admin replay seam. A
    // routine backfill must not bypass quarantine or a transient retry delay.
    if (document.data()?.deadlineQuarantinedAtMs !== undefined)
        return "unavailable";
    if (document.data()?.deadlineRecovery)
        return "skipped";
    /** Provides run behavior. */
    let run;
    try {
        run = (0, raceSetupService_1.parseRunRecord)(document.data(), document.id);
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            return "unavailable";
        throw error;
    }
    /** Provides deadline at ms behavior. */
    const deadlineAtMs = (0, raceEngine_1.raceDeadlineAtMs)(run);
    if (run.role !== "creator" && !Number.isFinite(deadlineAtMs))
        return "unavailable";
    if (run.deadlineAtMs === deadlineAtMs && run.rulesSnapshot)
        return "skipped";
    if (!dryRun)
        transaction.update(ref, (0, raceSetupService_1.stripUndefined)({ deadlineAtMs, rulesSnapshot: (0, raceEngine_1.raceRules)(run) }));
    return "changed";
}
/** Processes a bounded ID-ordered page; interrupted pages are safe to replay from their prior cursor. */
async function migrateRaceArchitecturePage(db, input, nowMs = Date.now()) {
    /** Provides limit behavior. */
    const limit = input.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new https_1.HttpsError("invalid-argument", "Migration page size must be between 1 and 100.");
    /** Provides collection behavior. */
    const collection = input.collection === "challenges" ? "raceChallenges" : "raceRuns";
    /** Provides query behavior. */
    let query = db.collection(collection).orderBy(firebaseAdmin_1.admin.firestore.FieldPath.documentId()).limit(limit);
    if (input.afterId)
        query = query.startAfter(input.afterId);
    /** Provides page behavior. */
    const page = await query.get();
    /** Provides report behavior. */
    const report = { scanned: page.size, changed: 0, unavailable: 0, skipped: 0,
        ...(page.size ? { nextAfterId: page.docs.at(-1).id } : {}), complete: page.size < limit };
    for (const document of page.docs) {
        /** Provides result behavior. */
        const result = await db.runTransaction((transaction) => input.collection === "challenges"
            ? reconcileRaceChallenge(transaction, db, document.ref, input.dryRun !== false, nowMs)
            : migrateRun(transaction, document.ref, input.dryRun !== false));
        report[result] += 1;
    }
    return report;
}
//# sourceMappingURL=raceArchitectureMigration.js.map