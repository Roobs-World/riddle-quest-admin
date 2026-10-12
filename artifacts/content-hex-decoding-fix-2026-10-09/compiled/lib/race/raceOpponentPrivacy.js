"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRIVATE_RACE_PLAYER_NAME = void 0;
exports.scrubRaceOpponent = scrubRaceOpponent;
exports.resolveRaceOpponentPrivacy = resolveRaceOpponentPrivacy;
exports.raceRunPrivacyWrite = raceRunPrivacyWrite;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceSetupService_1 = require("./raceSetupService");
/** Neutral identity used when a race opponent can no longer be linked safely. */
exports.PRIVATE_RACE_PLAYER_NAME = "Riddle Quest player";
/** Removes copied name/avatar linkage while preserving bounded ghost timing. */
function scrubRaceOpponent(run) {
    if (!run.opponent)
        return run;
    return {
        ...run,
        opponent: {
            ...run.opponent,
            displayName: exports.PRIVATE_RACE_PLAYER_NAME,
            avatarUrl: undefined,
            subjectUserId: undefined,
        },
    };
}
/** Resolves a run against the permanent opponent-deletion authority. */
async function resolveRaceOpponentPrivacy(transaction, db, run) {
    /** Provides subject user id behavior. */
    const subjectUserId = run.opponent?.subjectUserId;
    if (!run.opponent)
        return { run, scrubbed: false };
    if (run.opponent.kind === "bot")
        return { run, scrubbed: false };
    if (typeof subjectUserId !== "string" || subjectUserId.length === 0) {
        return { run: scrubRaceOpponent(run), scrubbed: true };
    }
    /** Provides deletion behavior. */
    const deletion = await transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, subjectUserId));
    return deletion.exists ? { run: scrubRaceOpponent(run), scrubbed: true } : { run, scrubbed: false };
}
/** Produces a merge-safe run write that physically removes scrubbed fields. */
function raceRunPrivacyWrite(run, scrubbed) {
    /** Stores d. */
    const stored = (0, raceSetupService_1.stripUndefined)(run);
    if (!scrubbed || !stored.opponent)
        return stored;
    return {
        ...stored,
        opponent: {
            ...stored.opponent,
            avatarUrl: firebaseAdmin_1.admin.firestore.FieldValue.delete(),
            subjectUserId: firebaseAdmin_1.admin.firestore.FieldValue.delete(),
        },
    };
}
//# sourceMappingURL=raceOpponentPrivacy.js.map