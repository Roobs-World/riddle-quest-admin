import {z} from "zod";
import {RaceCategoryIdSchema, RaceLocaleSchema} from "./raceDefinitionSchemas";
import {RaceRunViewSchema} from "./raceSchemas";

/** Server-owned lobby, countdown and victory constants. */
export const LIVE_RACE_WAIT_MS = 60_000;
/** Defines the live race countdown ms value. */
export const LIVE_RACE_COUNTDOWN_MS = 5_000;
/** Defines the live race win coins value. */
export const LIVE_RACE_WIN_COINS = 50;
/** One authenticated, idempotent queue entry. */
export const JoinLiveRaceSchema = z.object({locale: RaceLocaleSchema, categoryId: RaceCategoryIdSchema,
  requestId: z.string().min(8).max(160)}).strict();
/** Commands identify an owned seat and never supply scores or clock values. */
export const UpdateLiveRaceSchema = z.object({ticketId: z.string().regex(/^[a-f0-9]{64}$/),
  action: z.enum(["poll", "guess", "hint", "skip", "leave"]), requestId: z.string().min(8).max(160),
  riddleId: z.string().min(1).max(160).optional(), guess: z.string().trim().min(1).max(128).optional()}).strict()
  .refine(input => input.action !== "guess" || Boolean(input.guess && input.riddleId))
  .refine(input => !["hint", "skip"].includes(input.action) || Boolean(input.riddleId));
/** Identity is projected from authenticated account data. */
export const LiveRacePlayerSchema = z.object({displayName: z.string().min(1).max(80),
  avatarUrl: z.string().url().nullable(), bot: z.boolean(), correctCount: z.number().int().min(0).max(10)}).strict();
/** Answer-free, viewer-specific live state. */
export const LiveRaceViewSchema = z.object({ticketId: z.string().regex(/^[a-f0-9]{64}$/),
  phase: z.enum(["searching", "countdown", "racing", "result", "cancelled"]),
  serverNowMs: z.number().int().nonnegative(), searchEndsAtMs: z.number().int().nonnegative(),
  startsAtMs: z.number().int().nonnegative().nullable(), player: LiveRacePlayerSchema,
  opponent: LiveRacePlayerSchema.nullable(), run: RaceRunViewSchema.nullable(),
  result: z.enum(["win", "loss", "tie"]).nullable(), rewardCoins: z.union([z.literal(0), z.literal(50)]),
  newCoins: z.number().int().nonnegative().optional()}).strict();
/** Target-neutral live transport inputs and answer-free output. */
export type JoinLiveRace = z.infer<typeof JoinLiveRaceSchema>;
/** Target-neutral live action. */
export type UpdateLiveRace = z.infer<typeof UpdateLiveRaceSchema>;
/** Viewer-specific lobby and gameplay snapshot. */
export type LiveRaceView = z.infer<typeof LiveRaceViewSchema>;
/** Platform adapter owns the authenticated transport. */
export type LiveRaceCapability = {
  /** Enters or recovers the player's current lobby. */
  join(input: JoinLiveRace): Promise<LiveRaceView>;
  /** Reads live progress or submits an idempotent action. */
  update(input: UpdateLiveRace): Promise<LiveRaceView>;
};
