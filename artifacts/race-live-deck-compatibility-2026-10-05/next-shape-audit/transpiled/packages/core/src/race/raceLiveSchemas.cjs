"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveRaceChallengeSchema = exports.SendLiveRaceChallengeResponseSchema = exports.SendLiveRaceChallengeSchema = exports.GetLiveRaceChallengeSchema = exports.LiveRaceViewSchema = exports.LiveRacePlayerSchema = exports.UpdateLiveRaceSchema = exports.JoinLiveRaceSchema = exports.LiveRaceChallengeIdSchema = exports.LIVE_RACE_INVITE_MS = exports.LIVE_RACE_WIN_COINS = exports.LIVE_RACE_COUNTDOWN_MS = exports.LIVE_RACE_WAIT_MS = void 0;
const zod_1 = require("zod");
const raceTextSchemas_1 = require("./raceTextSchemas");
const raceDefinitionSchemas_1 = require("./raceDefinitionSchemas");
const raceSchemas_1 = require("./raceSchemas");
/** Server-owned lobby, countdown and victory constants. */
exports.LIVE_RACE_WAIT_MS = 60_000;
/** Defines the live race countdown ms value. */
exports.LIVE_RACE_COUNTDOWN_MS = 5_000;
/** Defines the live race win coins value. */
exports.LIVE_RACE_WIN_COINS = 50;
/** Private invitation lifetime while the creator waits for a friend. */
exports.LIVE_RACE_INVITE_MS = 15 * 60_000;
/** Opaque server invitation handle shared through the platform SDK. */
exports.LiveRaceChallengeIdSchema = zod_1.z.string().regex(/^live_[a-f0-9]{64}$/);
/** One authenticated, idempotent queue entry. */
exports.JoinLiveRaceSchema = zod_1.z.object({ locale: raceDefinitionSchemas_1.RaceLocaleSchema, categoryId: raceDefinitionSchemas_1.RaceCategoryIdSchema,
    requestId: zod_1.z.string().min(8).max(160), createChallenge: zod_1.z.boolean().optional(),
    challengeId: exports.LiveRaceChallengeIdSchema.optional(),
    /** Facebook adapter captures its synchronized SDK context; other providers must reject this selector. */
    facebookContextId: zod_1.z.string().min(1).max(256).regex(/^[A-Za-z0-9._:-]+$/).optional(),
    /** Caller-owned terminal ticket; the server resolves the original human opponent. */
    rematchOfTicketId: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict()
    .refine(input => !(input.createChallenge && input.challengeId))
    .refine(input => !input.rematchOfTicketId || !(input.createChallenge || input.challengeId));
/** Commands identify an owned seat and never supply scores or clock values. */
exports.UpdateLiveRaceSchema = zod_1.z.object({ ticketId: zod_1.z.string().regex(/^[a-f0-9]{64}$/),
    action: zod_1.z.enum(["poll", "guess", "hint", "skip", "leave"]), requestId: zod_1.z.string().min(8).max(160),
    riddleId: zod_1.z.string().min(1).max(160).optional(), guess: raceTextSchemas_1.RaceGuessTextSchema.optional() }).strict()
    .refine(input => input.action !== "guess" || Boolean(input.guess && input.riddleId))
    .refine(input => !["hint", "skip"].includes(input.action) || Boolean(input.riddleId));
/** Identity is projected from authenticated account data. */
exports.LiveRacePlayerSchema = zod_1.z.object({ displayName: zod_1.z.string().min(1).max(80),
    /** Account level used to display the earned avatar frame. */
    level: zod_1.z.number().int().positive().optional(),
    avatarUrl: zod_1.z.string().url().nullable(), bot: zod_1.z.boolean(), correctCount: zod_1.z.number().int().min(0).max(10) }).strict();
/** Answer-free, viewer-specific live state. */
exports.LiveRaceViewSchema = zod_1.z.object({ ticketId: zod_1.z.string().regex(/^[a-f0-9]{64}$/),
    phase: zod_1.z.enum(["searching", "countdown", "racing", "result", "cancelled"]),
    serverNowMs: zod_1.z.number().int().nonnegative(), searchEndsAtMs: zod_1.z.number().int().nonnegative(),
    startsAtMs: zod_1.z.number().int().nonnegative().nullable(), player: exports.LiveRacePlayerSchema,
    opponent: exports.LiveRacePlayerSchema.nullable(), run: raceSchemas_1.RaceRunViewSchema.nullable(),
    result: zod_1.z.enum(["win", "loss", "tie"]).nullable(), rewardCoins: zod_1.z.union([zod_1.z.literal(0), zod_1.z.literal(50)]),
    newCoins: zod_1.z.number().int().nonnegative().optional(),
    /** Only the authority selects when the player's next mutation is available. */
    actionAvailableAtMs: zod_1.z.number().int().nonnegative().optional(),
    challengeId: exports.LiveRaceChallengeIdSchema.optional() }).strict();
/** Server-validated incoming invitation; previewing does not occupy a seat. */
exports.GetLiveRaceChallengeSchema = zod_1.z.object({ challengeId: exports.LiveRaceChallengeIdSchema }).strict();
/** Direct invitations resolve an existing game username on the server. */
exports.SendLiveRaceChallengeSchema = zod_1.z.object({ challengeId: exports.LiveRaceChallengeIdSchema,
    recipientUsername: zod_1.z.string().trim().min(3).max(80) }).strict();
/** Queued means durable server work, never proof of provider delivery. */
exports.SendLiveRaceChallengeResponseSchema = zod_1.z.object({ status: zod_1.z.literal("queued") }).strict();
/** Safe invitation status and creator identity for the multiplayer intro. */
exports.LiveRaceChallengeSchema = zod_1.z.object({ challengeId: exports.LiveRaceChallengeIdSchema,
    locale: raceDefinitionSchemas_1.RaceLocaleSchema, categoryId: raceDefinitionSchemas_1.RaceCategoryIdSchema, creator: exports.LiveRacePlayerSchema,
    expiresAtMs: zod_1.z.number().int().nonnegative(),
    status: zod_1.z.enum(["available", "unavailable", "own", "accepted"]) }).strict();
