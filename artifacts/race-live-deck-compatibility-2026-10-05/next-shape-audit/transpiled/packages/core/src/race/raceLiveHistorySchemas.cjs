"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListLiveRaceHistoryResponseSchema = exports.LiveRaceHistoryEntrySchema = exports.ListLiveRaceHistoryRequestSchema = exports.LIVE_RACE_HISTORY_MS = void 0;
const zod_1 = require("zod");
const raceDefinitionSchemas_1 = require("./raceDefinitionSchemas");
const raceLiveSchemas_1 = require("./raceLiveSchemas");
/** Logical history window does not depend on asynchronous physical TTL cleanup. */
exports.LIVE_RACE_HISTORY_MS = 7 * 86_400_000;
/** An authenticated owner selects only language and a bounded display count. */
exports.ListLiveRaceHistoryRequestSchema = zod_1.z.object({ locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    limit: zod_1.z.number().int().min(1).max(20).default(20) }).strict();
/** Terminal match projection excludes private identities, decks, guesses and opponent tickets. */
exports.LiveRaceHistoryEntrySchema = zod_1.z.object({ ticketId: zod_1.z.string().regex(/^[a-f0-9]{64}$/),
    categoryId: raceDefinitionSchemas_1.RaceCategoryIdSchema, createdAtMs: zod_1.z.number().int().nonnegative().max(8_640_000_000_000_000),
    result: zod_1.z.enum(["win", "loss", "tie"]), correctCount: zod_1.z.number().int().min(0).max(10),
    opponent: raceLiveSchemas_1.LiveRacePlayerSchema, opponentAvailable: zod_1.z.boolean(),
    rewardCoins: zod_1.z.union([zod_1.z.literal(0), zod_1.z.literal(50)]) }).strict()
    .refine(value => value.result === "win" || value.rewardCoins === 0)
    .refine(value => !value.opponent.bot || !value.opponentAvailable);
/** Reads reject reordered, duplicate, future or logically expired entries before presentation. */
exports.ListLiveRaceHistoryResponseSchema = zod_1.z.object({ locale: raceDefinitionSchemas_1.RaceLocaleSchema,
    serverNowMs: zod_1.z.number().int().nonnegative().max(8_640_000_000_000_000),
    entries: zod_1.z.array(exports.LiveRaceHistoryEntrySchema).max(20) }).strict().superRefine((value, ctx) => {
    /** One visible row belongs to each opaque owned seat. */
    const seen = new Set();
    /** Creation-order projection remains stable even if a finished match is polled again. */
    let previous = Infinity;
    value.entries.forEach((entry, index) => {
        if (seen.has(entry.ticketId) || entry.createdAtMs > previous || entry.createdAtMs > value.serverNowMs ||
            entry.createdAtMs < value.serverNowMs - exports.LIVE_RACE_HISTORY_MS)
            ctx.addIssue({ code: "custom", path: ["entries", index], message: "Invalid retained live history" });
        seen.add(entry.ticketId);
        previous = entry.createdAtMs;
    });
});
