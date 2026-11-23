import {z} from "zod";
import {RACE_DECK_SIZE, RACE_HINT_PENALTY_MS, RACE_SKIP_PENALTY_MS, RACE_TARGET_CORRECT} from "./raceDefinitionSchemas";

/** Validates a non-negative millisecond duration. */
const MillisecondsSchema = z.number().int().nonnegative();

/** Schema for events recorded in an opponent ghost timeline. */
export const RaceEventTypeSchema = z.enum(["correct", "hint", "skip"]);
/** Event recorded in an opponent ghost timeline. */
export type RaceEventType = z.infer<typeof RaceEventTypeSchema>;

/** Schema for one internally consistent authoritative ghost event. */
export const RaceGhostEventSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    type: RaceEventTypeSchema,
    riddlePosition: z
      .number()
      .int()
      .nonnegative()
      .max(RACE_DECK_SIZE - 1),
    wallElapsedMs: MillisecondsSchema,
    penaltyAddedMs: z.union([z.literal(0), z.literal(RACE_HINT_PENALTY_MS), z.literal(RACE_SKIP_PENALTY_MS)]),
    totalPenaltyMs: MillisecondsSchema,
    adjustedElapsedMs: MillisecondsSchema,
    correctCount: z.number().int().nonnegative().max(RACE_TARGET_CORRECT),
  })
  .strict()
  .check((context) => {
    /** Provides event behavior. */
    const event = context.value;
    /** Provides expected penalty behavior. */
    const expectedPenalty =
      event.type === "hint" ? RACE_HINT_PENALTY_MS : event.type === "skip" ? RACE_SKIP_PENALTY_MS : 0;
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
      context.issues.push({code: "custom", message: "Cumulative penalty must include this event's charge",
        path: ["totalPenaltyMs"], input: event});
    }
  });
/** One authoritative event in a multiplayer ghost timeline. */
export type RaceGhostEvent = z.infer<typeof RaceGhostEventSchema>;
