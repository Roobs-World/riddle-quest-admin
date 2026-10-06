"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaceGhostEventSchema = exports.RaceEventTypeSchema = void 0;
const zod_1 = require("zod");
const raceDefinitionSchemas_1 = require("./raceDefinitionSchemas");
/** Validates a non-negative millisecond duration. */
const MillisecondsSchema = zod_1.z.number().int().nonnegative();
/** Schema for events recorded in an opponent ghost timeline. */
exports.RaceEventTypeSchema = zod_1.z.enum(["correct", "hint", "skip"]);
/** Schema for one internally consistent authoritative ghost event. */
exports.RaceGhostEventSchema = zod_1.z
    .object({
    sequence: zod_1.z.number().int().nonnegative(),
    type: exports.RaceEventTypeSchema,
    riddlePosition: zod_1.z
        .number()
        .int()
        .nonnegative()
        .max(raceDefinitionSchemas_1.RACE_DECK_SIZE - 1),
    wallElapsedMs: MillisecondsSchema,
    penaltyAddedMs: zod_1.z.union([zod_1.z.literal(0), zod_1.z.literal(raceDefinitionSchemas_1.RACE_HINT_PENALTY_MS), zod_1.z.literal(raceDefinitionSchemas_1.RACE_SKIP_PENALTY_MS)]),
    totalPenaltyMs: MillisecondsSchema,
    adjustedElapsedMs: MillisecondsSchema,
    correctCount: zod_1.z.number().int().nonnegative().max(raceDefinitionSchemas_1.RACE_TARGET_CORRECT),
})
    .strict()
    .check((context) => {
    /** Provides event behavior. */
    const event = context.value;
    /** Provides expected penalty behavior. */
    const expectedPenalty = event.type === "hint" ? raceDefinitionSchemas_1.RACE_HINT_PENALTY_MS : event.type === "skip" ? raceDefinitionSchemas_1.RACE_SKIP_PENALTY_MS : 0;
    if (event.penaltyAddedMs !== expectedPenalty) {
        context.issues.push({
            code: "custom",
            message: `${event.type} events require a ${expectedPenalty}ms penalty`,
            path: ["penaltyAddedMs"],
            input: event,
        });
    }
    if (event.adjustedElapsedMs !== event.wallElapsedMs + event.totalPenaltyMs) {
        context.issues.push({
            code: "custom",
            message: "adjustedElapsedMs must equal wallElapsedMs + totalPenaltyMs",
            path: ["adjustedElapsedMs"],
            input: event,
        });
    }
    if (event.totalPenaltyMs < event.penaltyAddedMs) {
        context.issues.push({ code: "custom", message: "Cumulative penalty must include this event's charge",
            path: ["totalPenaltyMs"], input: event });
    }
});
