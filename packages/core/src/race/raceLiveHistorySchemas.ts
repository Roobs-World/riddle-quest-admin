import {z} from "zod";
import {RaceCategoryIdSchema, RaceLocaleSchema} from "./raceDefinitionSchemas";
import {LiveRacePlayerSchema} from "./raceLiveSchemas";

/** Logical history window does not depend on asynchronous physical TTL cleanup. */
export const LIVE_RACE_HISTORY_MS = 7 * 86_400_000;
/** An authenticated owner selects only language and a bounded display count. */
export const ListLiveRaceHistoryRequestSchema = z.object({locale: RaceLocaleSchema,
  limit: z.number().int().min(1).max(20).default(20)}).strict();
/** Terminal match projection excludes private identities, decks, guesses and opponent tickets. */
export const LiveRaceHistoryEntrySchema = z.object({ticketId: z.string().regex(/^[a-f0-9]{64}$/),
  categoryId: RaceCategoryIdSchema, createdAtMs: z.number().int().nonnegative().max(8_640_000_000_000_000),
  result: z.enum(["win", "loss", "tie"]), correctCount: z.number().int().min(0).max(10),
  opponent: LiveRacePlayerSchema, opponentAvailable: z.boolean(),
  rewardCoins: z.union([z.literal(0), z.literal(50)])}).strict()
  .refine(value => value.result === "win" || value.rewardCoins === 0)
  .refine(value => !value.opponent.bot || !value.opponentAvailable);
/** Reads reject reordered, duplicate, future or logically expired entries before presentation. */
export const ListLiveRaceHistoryResponseSchema = z.object({locale: RaceLocaleSchema,
  serverNowMs: z.number().int().nonnegative().max(8_640_000_000_000_000),
  entries: z.array(LiveRaceHistoryEntrySchema).max(20)}).strict().superRefine((value, ctx) => {
  /** One visible row belongs to each opaque owned seat. */
  const seen = new Set<string>();
  /** Creation-order projection remains stable even if a finished match is polled again. */
  let previous = Infinity;
  value.entries.forEach((entry, index) => {
    if (seen.has(entry.ticketId) || entry.createdAtMs > previous || entry.createdAtMs > value.serverNowMs ||
      entry.createdAtMs < value.serverNowMs - LIVE_RACE_HISTORY_MS)
      ctx.addIssue({code: "custom", path: ["entries", index], message: "Invalid retained live history"});
    seen.add(entry.ticketId); previous = entry.createdAtMs;
  });
});
/** Private request carries no user identifier. */
export type ListLiveRaceHistoryRequest = z.infer<typeof ListLiveRaceHistoryRequestSchema>;
/** Validated recent match row. */
export type LiveRaceHistoryEntry = z.infer<typeof LiveRaceHistoryEntrySchema>;
/** Locale-bound recent match response. */
export type ListLiveRaceHistoryResponse = z.infer<typeof ListLiveRaceHistoryResponseSchema>;
