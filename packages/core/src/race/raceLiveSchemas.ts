import {z} from "zod";
import {RaceCategoryIdSchema, RaceLocaleSchema} from "./raceDefinitionSchemas";
import {RaceRunViewSchema} from "./raceSchemas";

/** Server-owned lobby, countdown and victory constants. */
export const LIVE_RACE_WAIT_MS = 60_000;
/** Defines the live race countdown ms value. */
export const LIVE_RACE_COUNTDOWN_MS = 5_000;
/** Defines the live race win coins value. */
export const LIVE_RACE_WIN_COINS = 50;
/** Private invitation lifetime while the creator waits for a friend. */
export const LIVE_RACE_INVITE_MS = 15 * 60_000;
/** Opaque server invitation handle shared through the platform SDK. */
export const LiveRaceChallengeIdSchema = z.string().regex(/^live_[a-f0-9]{64}$/);
/** One authenticated, idempotent queue entry. */
export const JoinLiveRaceSchema = z.object({locale: RaceLocaleSchema, categoryId: RaceCategoryIdSchema,
  requestId: z.string().min(8).max(160), createChallenge: z.boolean().optional(),
  challengeId: LiveRaceChallengeIdSchema.optional()}).strict()
  .refine(input => !(input.createChallenge && input.challengeId));
/** Commands identify an owned seat and never supply scores or clock values. */
export const UpdateLiveRaceSchema = z.object({ticketId: z.string().regex(/^[a-f0-9]{64}$/),
  action: z.enum(["poll", "guess", "hint", "skip", "leave"]), requestId: z.string().min(8).max(160),
  riddleId: z.string().min(1).max(160).optional(), guess: z.string().trim().min(1).max(128).optional()}).strict()
  .refine(input => input.action !== "guess" || Boolean(input.guess && input.riddleId))
  .refine(input => !["hint", "skip"].includes(input.action) || Boolean(input.riddleId));
/** Identity is projected from authenticated account data. */
export const LiveRacePlayerSchema = z.object({displayName: z.string().min(1).max(80),
  /** Account level used to display the earned avatar frame. */
  level: z.number().int().positive().optional(),
  avatarUrl: z.string().url().nullable(), bot: z.boolean(), correctCount: z.number().int().min(0).max(10)}).strict();
/** Answer-free, viewer-specific live state. */
export const LiveRaceViewSchema = z.object({ticketId: z.string().regex(/^[a-f0-9]{64}$/),
  phase: z.enum(["searching", "countdown", "racing", "result", "cancelled"]),
  serverNowMs: z.number().int().nonnegative(), searchEndsAtMs: z.number().int().nonnegative(),
  startsAtMs: z.number().int().nonnegative().nullable(), player: LiveRacePlayerSchema,
  opponent: LiveRacePlayerSchema.nullable(), run: RaceRunViewSchema.nullable(),
  result: z.enum(["win", "loss", "tie"]).nullable(), rewardCoins: z.union([z.literal(0), z.literal(50)]),
  newCoins: z.number().int().nonnegative().optional(),
  /** Only the authority selects when the player's next mutation is available. */
  actionAvailableAtMs: z.number().int().nonnegative().optional(),
  challengeId: LiveRaceChallengeIdSchema.optional()}).strict();
/** Server-validated incoming invitation; previewing does not occupy a seat. */
export const GetLiveRaceChallengeSchema = z.object({challengeId: LiveRaceChallengeIdSchema}).strict();
/** Direct invitations resolve an existing game username on the server. */
export const SendLiveRaceChallengeSchema = z.object({challengeId: LiveRaceChallengeIdSchema,
  recipientUsername: z.string().trim().min(3).max(80)}).strict();
/** Queued means durable server work, never proof of provider delivery. */
export const SendLiveRaceChallengeResponseSchema = z.object({status: z.literal("queued")}).strict();
/** Safe invitation status and creator identity for the multiplayer intro. */
export const LiveRaceChallengeSchema = z.object({challengeId: LiveRaceChallengeIdSchema,
  locale: RaceLocaleSchema, categoryId: RaceCategoryIdSchema, creator: LiveRacePlayerSchema,
  expiresAtMs: z.number().int().nonnegative(),
  status: z.enum(["available", "unavailable", "own", "accepted"])}).strict();
/** Validated incoming PvP challenge. */
export type LiveRaceChallenge = z.infer<typeof LiveRaceChallengeSchema>;
/** Target-neutral live transport inputs and answer-free output. */
export type JoinLiveRace = z.infer<typeof JoinLiveRaceSchema>;
/** Target-neutral live action. */
export type UpdateLiveRace = z.infer<typeof UpdateLiveRaceSchema>;
/** Viewer-specific lobby and gameplay snapshot. */
export type LiveRaceView = z.infer<typeof LiveRaceViewSchema>;
/** Platform adapter owns the authenticated transport. */
export type LiveRaceCapability = {
  /** Opens the target's native friend invitation for an existing private lobby. */
  shareChallenge?(input: {
    /** Opaque existing server lobby. */
    challengeId: string;
  }): Promise<"success" | "cancelled" | "error">;
  /** Enters or recovers the player's current lobby. */
  join(input: JoinLiveRace): Promise<LiveRaceView>;
  /** Reads an invitation without joining, when supported by the target. */
  challenge?(input: z.infer<typeof GetLiveRaceChallengeSchema>): Promise<LiveRaceChallenge>;
  /** Notifies a known game player and persists their invitation inbox entry. */
  sendChallenge?(input: z.infer<typeof SendLiveRaceChallengeSchema>): Promise<z.infer<typeof SendLiveRaceChallengeResponseSchema>>;
  /** Reads pending direct invitations without accepting a seat. */
  inbox?(): Promise<LiveRaceChallenge[]>;
  /** Reads live progress or submits an idempotent action. */
  update(input: UpdateLiveRace): Promise<LiveRaceView>;
};
