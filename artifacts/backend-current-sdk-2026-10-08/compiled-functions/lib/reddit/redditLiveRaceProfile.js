"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hydrateRedditLiveRaceProfile = hydrateRedditLiveRaceProfile;
const race_1 = require("@qwordly/core/race");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const redditSocialProfile_1 = require("./redditSocialProfile");
/** Projects temporary Reddit identity into a live lobby without exposing provider account ids. */
async function hydrateRedditLiveRaceProfile(value, db, nowMs) {
    /** Exact answer-free response returned by the trusted match service. */
    const view = race_1.LiveRaceViewSchema.parse(value);
    /** Owner is recovered from its private seat, never from browser identity fields. */
    const ticket = (await db.doc(`liveRaceTickets/${view.ticketId}`).get()).data();
    if (!ticket)
        return view;
    /** Fresh owner profile respects the established provider cache expiry. */
    const own = await (0, redditSocialProfile_1.readRedditSocialProfile)(ticket.userId, { db, nowMs });
    if (own)
        view.player = { ...view.player, displayName: own.displayName, avatarUrl: own.avatarUrl ?? null };
    if (!ticket.matchId || !view.opponent || view.opponent.bot)
        return view;
    /** Only the match's authenticated rival may supply the lower lobby identity. */
    const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data();
    if (!match)
        return view;
    /** Opposite seat belongs to the same private matched document. */
    const rivalId = match.runs[match.tickets[0] === view.ticketId ? 1 : 0].userId;
    /** Blocking and deletion suppress native identity even on a recovered join. */
    const checks = await db.getAll(db.doc(`users/${ticket.userId}/blockedRivals/${rivalId}`), db.doc(`users/${rivalId}/blockedRivals/${ticket.userId}`), (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, rivalId));
    /** Native profile stays out of storage and is rechecked against its bounded cache. */
    const rival = checks.some(check => check.exists) ? undefined : await (0, redditSocialProfile_1.readRedditSocialProfile)(rivalId, { db, nowMs });
    view.opponent = { ...view.opponent, displayName: rival?.displayName ?? "Riddle Quest player", avatarUrl: rival?.avatarUrl ?? null };
    if (view.run?.opponent)
        view.run.opponent = { ...view.run.opponent,
            displayName: view.opponent.displayName, avatarUrl: view.opponent.avatarUrl };
    return race_1.LiveRaceViewSchema.parse(view);
}
//# sourceMappingURL=redditLiveRaceProfile.js.map