"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findRedditRaceMatch = findRedditRaceMatch;
const race_1 = require("@qwordly/core/race");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const raceMatchmaking_1 = require("../race/raceMatchmaking");
const redditSecurity_1 = require("./redditSecurity");
const redditSocialProfile_1 = require("./redditSocialProfile");
/** Authenticated Reddit adapter for the provider-neutral recorded-race selector. */
async function findRedditRaceMatch(userId, input, options = {}) {
    if (!(0, redditSecurity_1.isRedditFirebaseUid)(userId))
        throw new Error("reddit-matchmaking-identity-required");
    /** Provides request behavior. */
    const request = typeof input === "string" ? { locale: input } : input;
    /** Provides result behavior. */
    const result = await (0, raceMatchmaking_1.findRecordedRaceMatch)(userId, request, options);
    if (result.status !== "matched")
        return result;
    // Canonical provider-neutral previews expose only game-owned presentation.
    // Provider identity hydration stays entirely inside the Reddit adapter.
    /** Provides db behavior. */
    const db = options.db;
    /** Provides creator snapshot behavior. */
    const creatorSnapshot = await (db ?? firebaseAdmin_1.admin.firestore())
        .doc(`raceChallenges/${result.challenge.challengeId}`).get();
    /** Provides creator id behavior. */
    const creatorId = creatorSnapshot.data()?.creatorId;
    /** Provides profile behavior. */
    const profile = typeof creatorId === "string" ? await (options.socialProfile ?? redditSocialProfile_1.readRedditSocialProfile)(creatorId, options) : undefined;
    return race_1.RaceMatchResponseSchema.parse({ ...result, challenge: { ...result.challenge,
            creator: profile ?? { displayName: "Riddle Quest player" },
        } });
}
//# sourceMappingURL=redditMatchmaking.js.map