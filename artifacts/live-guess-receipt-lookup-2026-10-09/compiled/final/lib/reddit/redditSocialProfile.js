"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRedditSocialProfile = readRedditSocialProfile;
exports.hydrateRedditRaceSocialResult = hydrateRedditRaceSocialResult;
const race_1 = require("@qwordly/core/race");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const redditSecurity_1 = require("./redditSecurity");
const race_2 = require("@qwordly/core/race");
const raceSetupService_1 = require("../race/raceSetupService");
/** Provides timestamp millis behavior. */
const timestampMillis = (value) => {
    if (typeof value !== "object" ||
        value === null ||
        !("toMillis" in value) ||
        typeof value.toMillis !== "function")
        return undefined;
    try {
        /** Provides result behavior. */
        const result = value.toMillis();
        return Number.isSafeInteger(result) && result >= 0 ? result : undefined;
    }
    catch {
        return undefined;
    }
};
/** Reads a bounded, unexpired provider profile for a Reddit-only social surface. */
async function readRedditSocialProfile(uid, options = {}) {
    if (!(0, redditSecurity_1.isRedditFirebaseUid)(uid))
        return undefined;
    /** Provides snapshot behavior. */
    const snapshot = await (options.db ?? firebaseAdmin_1.admin.firestore())
        .collection("providerIdentities")
        .where("provider", "==", "reddit")
        .where("uid", "==", uid)
        .limit(2)
        .get();
    if (snapshot.size !== 1)
        return undefined;
    /** Provides provider behavior. */
    const provider = snapshot.docs[0].data();
    /** Provides profile behavior. */
    const profile = provider.redditProfile;
    if (provider.status !== "active" ||
        typeof profile !== "object" ||
        profile === null ||
        !/^[A-Za-z0-9_-]{3,20}$/.test(profile.username) ||
        timestampMillis(profile.expiresAt) === undefined ||
        timestampMillis(profile.expiresAt) <= (options.nowMs ?? Date.now())) {
        return undefined;
    }
    /** Provides avatar url behavior. */
    const avatarUrl = profile.avatarUrl;
    return {
        displayName: profile.username,
        ...(typeof avatarUrl === "string" &&
            /^https:\/\/(?:styles\.redditmedia\.com|www\.redditstatic\.com)\//.test(avatarUrl)
            ? { avatarUrl }
            : {}),
    };
}
/** Provides identity behavior. */
const identity = async (uid, db, nowMs) => (await readRedditSocialProfile(uid, { db, nowMs })) ?? { displayName: "Riddle Quest player" };
/** Rehydrates provider identity only into Reddit race presentation responses. */
async function hydrateRedditRaceSocialResult(operation, payload, result, options = {}) {
    /** Provides db behavior. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore();
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    if (operation === "gameplay.race.entry") {
        /** Typed lifecycle reads hydrate identity only when a challenge is ready. */
        const entry = race_1.RaceEntryResponseSchema.parse(result);
        if (entry.status !== "ready")
            return entry;
        /** Preserve provider-owned identity on the established preview seam. */
        const challenge = await hydrateRedditRaceSocialResult("gameplay.race.challenge", payload, entry.challenge, { db, nowMs });
        return race_1.RaceEntryResponseSchema.parse({ ...entry, challenge });
    }
    if (operation === "gameplay.race.challenge") {
        /** Provides preview behavior. */
        const preview = race_2.RaceChallengePreviewSchema.parse(result);
        /** Provides input behavior. */
        const input = payload;
        if (typeof input?.challengeId !== "string")
            return preview;
        /** Provides snapshot behavior. */
        const snapshot = await db.collection("raceChallenges").doc(input.challengeId).get();
        if (!snapshot.exists)
            return { ...preview, creator: { displayName: "Riddle Quest player" } };
        /** Provides challenge behavior. */
        const challenge = (0, raceSetupService_1.parseChallengeRecord)(snapshot.data());
        return race_2.RaceChallengePreviewSchema.parse({ ...preview, creator: await identity(challenge.creatorId, db, nowMs) });
    }
    if (operation === "gameplay.race.publish") {
        /** Provides response behavior. */
        const response = race_2.PublishRaceChallengeResponseSchema.parse(result);
        /** Provides snapshot behavior. */
        const snapshot = await db.collection("raceChallenges").doc(response.challengeId).get();
        /** Provides creator id behavior. */
        const creatorId = snapshot.exists ? (0, raceSetupService_1.parseChallengeRecord)(snapshot.data()).creatorId : undefined;
        return race_2.PublishRaceChallengeResponseSchema.parse({
            ...response,
            preview: {
                ...response.preview,
                creator: creatorId ? await identity(creatorId, db, nowMs) : { displayName: "Riddle Quest player" },
            },
        });
    }
    if (operation === "gameplay.race.inbox") {
        /** Provides response behavior. */
        const response = race_2.ListRaceInboxResponseSchema.parse(result);
        return race_2.ListRaceInboxResponseSchema.parse({
            ...response,
            items: await Promise.all(response.items.map(async (item) => {
                if (!item.opponentUserId || !(0, redditSecurity_1.isRedditFirebaseUid)(item.opponentUserId))
                    return {
                        ...item,
                        opponentDisplayName: "Riddle Quest player",
                        opponentAvatarUrl: undefined,
                        opponentLevel: undefined,
                    };
                /** Provides profile behavior. */
                const profile = await identity(item.opponentUserId, db, nowMs);
                return {
                    ...item,
                    opponentDisplayName: profile.displayName,
                    ...(profile.avatarUrl ? { opponentAvatarUrl: profile.avatarUrl } : { opponentAvatarUrl: undefined }),
                };
            })),
        });
    }
    /** Provides run schemas behavior. */
    const runSchemas = {
        "gameplay.race.start": race_2.RaceRunResponseSchema,
        "gameplay.race.ready": race_2.RaceRunResponseSchema,
        "gameplay.race.resume": race_2.RaceRunResponseSchema,
        "gameplay.race.guess": race_2.SubmitRaceGuessResponseSchema,
        "gameplay.race.hint": race_2.RequestRaceHintResponseSchema,
        "gameplay.race.skip": race_2.SkipRaceRiddleResponseSchema,
        "gameplay.race.abandon": race_2.AbandonRaceRunResponseSchema,
    };
    /** Provides schema behavior. */
    const schema = runSchemas[operation];
    if (!schema)
        return result;
    /** Provides response behavior. */
    const response = schema.parse(result);
    if (!response.run.opponent)
        return response;
    /** Provides snapshot behavior. */
    const snapshot = await db.collection("raceRuns").doc(response.run.runId).get();
    /** Provides opponent id behavior. */
    const opponentId = snapshot.exists ? (0, raceSetupService_1.parseRunRecord)(snapshot.data()).opponent?.subjectUserId : undefined;
    /** Provides profile behavior. */
    const profile = opponentId && (0, redditSecurity_1.isRedditFirebaseUid)(opponentId)
        ? await identity(opponentId, db, nowMs)
        : { displayName: "Riddle Quest player" };
    return schema.parse({
        ...response,
        run: {
            ...response.run,
            opponent: {
                ...response.run.opponent,
                displayName: profile.displayName,
                ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : { avatarUrl: undefined }),
            },
        },
    });
}
//# sourceMappingURL=redditSocialProfile.js.map