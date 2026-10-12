"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRaceChallengePreview = getRaceChallengePreview;
exports.getRaceOutcomeForUser = getRaceOutcomeForUser;
exports.listRaceInboxForUser = listRaceInboxForUser;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const callableValidation_1 = require("../validation/callableValidation");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceSettlement_1 = require("./raceSettlement");
const raceOpponentPrivacy_1 = require("./raceOpponentPrivacy");
const raceSetupService_1 = require("./raceSetupService");
/** Gets race challenge preview. */
async function getRaceChallengePreview(challengeId, locale, options = {}) {
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(options.db);
    /** Provides challenge ref behavior. */
    const challengeRef = db.collection("raceChallenges").doc(challengeId);
    return db.runTransaction(async (transaction) => {
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(challengeRef);
        if (!snapshot.exists)
            throw new https_1.HttpsError("not-found", "Race to 10 challenge not found.");
        /** Provides challenge behavior. */
        const challenge = (0, raceSetupService_1.parseChallengeRecord)(snapshot.data(), snapshot.id);
        if (challenge.locale !== locale) {
            throw new https_1.HttpsError("failed-precondition", "RaceTo10.ERROR_LOCALE_MISMATCH");
        }
        /** Provides deletion behavior. */
        const deletion = await transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, challenge.creatorId));
        if (!deletion.exists)
            return (0, raceSetupService_1.challengePreview)(challenge, options.nowMs ?? Date.now());
        /** Provides scrubbed behavior. */
        const scrubbed = { ...challenge, creatorSnapshot: { displayName: raceOpponentPrivacy_1.PRIVATE_RACE_PLAYER_NAME } };
        transaction.update(challengeRef, { creatorSnapshot: scrubbed.creatorSnapshot });
        return (0, raceSetupService_1.challengePreview)(scrubbed, options.nowMs ?? Date.now());
    });
}
/** Gets race outcome for user. */
async function getRaceOutcomeForUser(userId, runId, options = {}) {
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(options.db);
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    /** Provides run ref behavior. */
    const runRef = db.collection("raceRuns").doc(runId);
    /** Provides outcome behavior. */
    return db.runTransaction(async (transaction) => {
        /** Provides run snapshot behavior. */
        const runSnapshot = await transaction.get(runRef);
        if (!runSnapshot.exists)
            throw new https_1.HttpsError("not-found", "Race to 10 run not found.");
        /** Provides run behavior. */
        const run = (0, raceSetupService_1.parseRunRecord)(runSnapshot.data(), runSnapshot.id);
        if (run.userId !== userId)
            throw new https_1.HttpsError("permission-denied", "This race run belongs to another player.");
        /** Transport sanitization shares acceptance with settlement and reward presentation. */
        const outcome = await (0, raceSettlement_1.readSettledRaceOutcome)(transaction, db, run, nowMs);
        return (0, callableValidation_1.validateCallableResponse)(race_1.RaceOutcomeSchema, outcome, "getRaceOutcome");
    });
}
/** Provides encode inbox cursor behavior. */
const encodeInboxCursor = (createdAtMs, itemId) => Buffer.from(JSON.stringify({ createdAtMs, itemId }), "utf8").toString("base64url");
/** Provides decode inbox cursor behavior. */
const decodeInboxCursor = (cursor) => {
    try {
        /** Provides value behavior. */
        const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        if (typeof value.createdAtMs !== "number" || typeof value.itemId !== "string")
            throw new Error("invalid");
        return { createdAtMs: value.createdAtMs, itemId: value.itemId };
    }
    catch {
        throw new https_1.HttpsError("invalid-argument", "Race inbox cursor is invalid.");
    }
};
/** Projects a stored inbox record without leaking server-only or unlinked legacy identity fields. */
const projectRaceInboxItem = (value, subjectDeleted) => {
    /** Provides linked opponent identity behavior. */
    const linkedOpponentIdentity = !subjectDeleted && typeof value.opponentUserId === "string" && value.opponentUserId.length > 0;
    return race_1.RaceInboxItemSchema.parse({
        itemId: value.itemId,
        challengeId: value.challengeId,
        ...(linkedOpponentIdentity ? { opponentUserId: value.opponentUserId } : {}),
        opponentDisplayName: linkedOpponentIdentity ? value.opponentDisplayName : "Riddle Quest player",
        ...(linkedOpponentIdentity && value.opponentAvatarUrl !== undefined
            ? { opponentAvatarUrl: value.opponentAvatarUrl }
            : {}),
        ...(linkedOpponentIdentity && value.opponentLevel !== undefined ? { opponentLevel: value.opponentLevel } : {}),
        categoryId: value.categoryId,
        result: value.result,
        adjustedDeltaMs: value.adjustedDeltaMs,
        read: value.read,
        createdAtMs: value.createdAtMs,
    });
};
/** Lists race inbox for user. */
async function listRaceInboxForUser(userId, input, dbInput) {
    /** Provides db behavior. */
    const db = (0, raceSetupService_1.dbOrDefault)(dbInput);
    /** Provides query behavior. */
    let query = db
        .collection(`users/${userId}/raceInbox`)
        .orderBy("createdAtMs", "desc")
        .orderBy(firebaseAdmin_1.admin.firestore.FieldPath.documentId(), "desc")
        .limit(input.limit + 1);
    if (input.cursor) {
        /** Provides cursor behavior. */
        const cursor = decodeInboxCursor(input.cursor);
        query = query.startAfter(cursor.createdAtMs, cursor.itemId);
    }
    /** Provides snapshot behavior. */
    const snapshot = await query.get();
    /** Provides visible behavior. */
    const visible = snapshot.docs.slice(0, input.limit);
    /** Provides opponent ids behavior. */
    const opponentIds = [
        ...new Set(visible.flatMap((document) => {
            /** Provides opponent user id behavior. */
            const opponentUserId = document.data().opponentUserId;
            return typeof opponentUserId === "string" && opponentUserId.length > 0 ? [opponentUserId] : [];
        })),
    ];
    /** Provides deletion snapshots behavior. */
    const deletionSnapshots = opponentIds.length > 0
        ? await db.getAll(...opponentIds.map((opponentId) => (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, opponentId)))
        : [];
    /** Deletes d opponent ids. */
    const deletedOpponentIds = new Set(deletionSnapshots.filter((item) => item.exists).map((item) => item.id));
    /** Provides subject deleted behavior. */
    const subjectDeleted = (value) => typeof value.opponentUserId === "string" && deletedOpponentIds.has(value.opponentUserId);
    /** Provides items behavior. */
    const items = visible.map((document) => projectRaceInboxItem(document.data(), subjectDeleted(document.data())));
    /** Provides last behavior. */
    const last = visible.at(-1);
    /** Provides response behavior. */
    const response = race_1.ListRaceInboxResponseSchema.parse({
        items,
        nextCursor: snapshot.docs.length > input.limit && last
            ? encodeInboxCursor(Number(last.data().createdAtMs), last.id)
            : undefined,
    });
    /** Updates s. */
    const updates = visible.filter((document) => document.data().read !== true || subjectDeleted(document.data()));
    if (updates.length > 0) {
        /** Provides batch behavior. */
        const batch = db.batch();
        updates.forEach((document) => {
            /** Provides fields behavior. */
            const fields = {};
            if (document.data().read !== true)
                fields.read = true;
            if (subjectDeleted(document.data())) {
                fields.opponentDisplayName = raceOpponentPrivacy_1.PRIVATE_RACE_PLAYER_NAME;
                fields.opponentAvatarUrl = firebaseAdmin_1.admin.firestore.FieldValue.delete();
                fields.opponentLevel = firebaseAdmin_1.admin.firestore.FieldValue.delete();
            }
            batch.update(document.ref, fields);
        });
        await batch.commit();
    }
    return response;
}
//# sourceMappingURL=raceReadService.js.map