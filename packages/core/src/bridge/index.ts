import {z} from "zod";
import {BRIDGE_PROTOCOL_VERSION} from "./constants";
import {
  ListRaceCategoriesRequestSchema,
  ListRaceInboxRequestSchema,
  PublishRaceChallengeRequestSchema,
  RaceChallengeIdRequestSchema,
  RaceAnalyticsEventRequestSchema,
  RaceRunIdRequestSchema,
  RequestRaceHintRequestSchema,
  SkipRaceRiddleRequestSchema,
  StartRaceRunRequestSchema,
  SubmitRaceGuessRequestSchema,
} from "../race";

export {BRIDGE_PROTOCOL_VERSION} from "./constants";

const EmptyPayloadSchema = z.object({}).strict();
const MetadataSchema = z.object({
  requestId: z.string().min(1).optional(),
  sentAt: z.number().int().nonnegative().optional(),
});

const GameModeSchema = z.enum(["classic", "challenge"]);
const OperationSchema = z.enum([
  "auth",
  "loadRiddle",
  "completeGame",
  "hint",
  "spendCoins",
  "purchase",
  "skip",
  "profile",
  "avatar",
  "leaderboard",
  "raceCategories",
  "raceStart",
  "raceGuess",
  "raceHint",
  "raceSkip",
  "raceResume",
  "racePublish",
  "raceChallenge",
  "raceOutcome",
  "raceInbox",
]);

export const BridgeUserSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  photoURL: z.string().url().optional(),
  isAnonymous: z.boolean(),
  platformRegistered: z.boolean().optional(),
});
export type BridgeUser = z.infer<typeof BridgeUserSchema>;

export const BridgeProfileSchema = z.object({
  username: z.string().min(1),
  coins: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  winStreak: z.number().int().nonnegative(),
  gamesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  achievements: z.array(z.string()).default([]),
  classicIndex: z.number().int().nonnegative(),
  avatarUrl: z.string().url().optional(),
  dailyChallengeIndex: z.number().int().nonnegative().optional(),
  dailyChallengeCurrentQuestion: z.number().int().nonnegative().optional(),
  dailyPuzzlesCompleted: z.number().int().nonnegative().optional(),
  bestStreak: z.number().int().nonnegative().optional(),
  totalWordsGuessed: z.number().int().nonnegative().optional(),
  winRate: z.number().nonnegative().optional(),
  averageGuesses: z.number().nonnegative().optional(),
  totalScore: z.number().int().nonnegative().optional(),
  highestLevelClassic: z.number().int().nonnegative().optional(),
  challengeWins: z.number().int().nonnegative().optional(),
  totalWins: z.number().int().nonnegative().optional(),
  totalGuessesInWins: z.number().int().nonnegative().optional(),
  totalHintsUsed: z.number().int().nonnegative().optional(),
  hasPurchasedApp: z.boolean().optional(),
});
export type BridgeProfile = z.infer<typeof BridgeProfileSchema>;

export const BridgeRiddleSchema = z.object({
  riddleId: z.string().min(1),
  text: z.string().min(1),
  answer: z.string().min(1),
  answerLength: z.number().int().positive(),
  gameMode: GameModeSchema,
  index: z.number().int().nonnegative().optional(),
});
export type BridgeRiddle = z.infer<typeof BridgeRiddleSchema>;

export const BridgeLeaderboardEntrySchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  totalWins: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
});
export type BridgeLeaderboardEntry = z.infer<typeof BridgeLeaderboardEntrySchema>;

const envelope = <Type extends string, Payload extends z.ZodTypeAny>(type: Type, payload: Payload) =>
  MetadataSchema.extend({
    type: z.literal(type),
    payload,
  });

export const GameReadyMessageSchema = envelope(
  "game:ready",
  z.object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    surface: z.literal("html5").default("html5"),
  }),
);

export const GameResizeMessageSchema = envelope(
  "game:resize",
  z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
);

export const GameLoadRiddleMessageSchema = envelope(
  "game:loadRiddle",
  z.object({
    gameMode: GameModeSchema,
    locale: z.string().min(2),
    classicIndex: z.number().int().nonnegative().optional(),
  }),
);

export const GameCompleteGameMessageSchema = envelope(
  "game:completeGame",
  z.object({
    riddleId: z.string().min(1),
    gameMode: GameModeSchema,
    attempts: z.number().int().positive(),
    isCorrect: z.boolean(),
  }),
);

export const GameRequestHintMessageSchema = envelope(
  "game:requestHint",
  z.object({
    riddleId: z.string().min(1),
    gameMode: GameModeSchema,
    currentAttempt: z.array(z.string()),
  }),
);

export const GameSpendCoinsMessageSchema = envelope(
  "game:spendCoins",
  z.object({
    reason: z.enum(["hint", "skip", "continue"]),
    gameMode: GameModeSchema.optional(),
    riddleId: z.string().min(1).optional(),
    amount: z.number().int().positive().optional(),
  }),
);

export const GameRequestPurchaseMessageSchema = envelope(
  "game:requestPurchase",
  z.object({
    productId: z.string().min(1),
  }),
);

export const GameLoadLeaderboardMessageSchema = envelope(
  "game:loadLeaderboard",
  z.object({
    leaderboardType: z.enum(["xp", "totalWins", "bestStreak"]),
  }),
);

export const GameUpdateUsernameMessageSchema = envelope(
  "game:updateUsername",
  z.object({
    username: z.string().trim().min(3).max(24),
  }),
);

export const GameUpdateAvatarMessageSchema = envelope(
  "game:updateAvatar",
  z.object({
    imageDataUrl: z
      .string()
      .max(700_000)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
  }),
);

export const GameListRaceCategoriesMessageSchema = envelope("game:listRaceCategories", ListRaceCategoriesRequestSchema);
export const GameStartRaceMessageSchema = envelope("game:startRace", StartRaceRunRequestSchema);
export const GameSubmitRaceGuessMessageSchema = envelope("game:submitRaceGuess", SubmitRaceGuessRequestSchema);
export const GameRequestRaceHintMessageSchema = envelope("game:requestRaceHint", RequestRaceHintRequestSchema);
export const GameSkipRaceRiddleMessageSchema = envelope("game:skipRaceRiddle", SkipRaceRiddleRequestSchema);
export const GameResumeRaceMessageSchema = envelope("game:resumeRace", RaceRunIdRequestSchema);
export const GamePublishRaceMessageSchema = envelope("game:publishRace", PublishRaceChallengeRequestSchema);
export const GameGetRaceChallengeMessageSchema = envelope("game:getRaceChallenge", RaceChallengeIdRequestSchema);
export const GameGetRaceOutcomeMessageSchema = envelope("game:getRaceOutcome", RaceRunIdRequestSchema);
export const GameListRaceInboxMessageSchema = envelope("game:listRaceInbox", ListRaceInboxRequestSchema);

export const GameAnalyticsMessageSchema = envelope(
  "game:analytics",
  RaceAnalyticsEventRequestSchema.omit({eventId: true}),
);

export const GameErrorMessageSchema = envelope(
  "game:error",
  z.object({
    message: z.string().min(1),
    stack: z.string().optional(),
  }),
);

export const GameToHostMessageSchema = z.discriminatedUnion("type", [
  GameReadyMessageSchema,
  GameResizeMessageSchema,
  GameLoadRiddleMessageSchema,
  GameCompleteGameMessageSchema,
  GameRequestHintMessageSchema,
  GameSpendCoinsMessageSchema,
  GameRequestPurchaseMessageSchema,
  GameLoadLeaderboardMessageSchema,
  GameUpdateUsernameMessageSchema,
  GameUpdateAvatarMessageSchema,
  GameListRaceCategoriesMessageSchema,
  GameStartRaceMessageSchema,
  GameSubmitRaceGuessMessageSchema,
  GameRequestRaceHintMessageSchema,
  GameSkipRaceRiddleMessageSchema,
  GameResumeRaceMessageSchema,
  GamePublishRaceMessageSchema,
  GameGetRaceChallengeMessageSchema,
  GameGetRaceOutcomeMessageSchema,
  GameListRaceInboxMessageSchema,
  GameAnalyticsMessageSchema,
  GameErrorMessageSchema,
]);
export type GameToHostMessage = z.infer<typeof GameToHostMessageSchema>;

export const HostInitMessageSchema = envelope(
  "host:init",
  z.object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    sessionId: z.string().min(1),
    locale: z.string().min(2),
    user: BridgeUserSchema.nullable(),
    profile: BridgeProfileSchema.nullable(),
    gameMode: GameModeSchema,
    products: z
      .array(
        z.object({
          productId: z.string().min(1),
          productType: z.enum(["consumable", "subscription"]).optional(),
          name: z.string().min(1),
          description: z.string(),
          coins: z.number().int().nonnegative(),
          displayPrice: z.string().min(1),
          featuredBadge: z.string().optional(),
          billingPeriod: z.enum(["weekly", "monthly", "yearly"]).optional(),
          subscriptionStatus: z.enum(["active", "inactive"]).optional(),
          trialEligible: z.boolean().optional(),
        }),
      )
      .default([]),
  }),
);

export const HostAuthStateMessageSchema = envelope(
  "host:authState",
  z.object({
    user: BridgeUserSchema.nullable(),
    profile: BridgeProfileSchema.nullable(),
  }),
);

export const HostRiddleLoadedMessageSchema = envelope(
  "host:riddleLoaded",
  z.object({
    riddle: BridgeRiddleSchema,
    profile: BridgeProfileSchema.nullable().optional(),
  }),
);

export const HostOperationResultMessageSchema = envelope(
  "host:operationResult",
  z.object({
    operation: OperationSchema,
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
  }),
);

export const HostPauseMessageSchema = envelope("host:pause", EmptyPayloadSchema);
export const HostResumeMessageSchema = envelope("host:resume", EmptyPayloadSchema);

export const HostToGameMessageSchema = z.discriminatedUnion("type", [
  HostInitMessageSchema,
  HostAuthStateMessageSchema,
  HostRiddleLoadedMessageSchema,
  HostOperationResultMessageSchema,
  HostPauseMessageSchema,
  HostResumeMessageSchema,
]);
export type HostToGameMessage = z.infer<typeof HostToGameMessageSchema>;

export type BridgeMessage = GameToHostMessage | HostToGameMessage;

export const parseGameToHostMessage = (value: unknown): GameToHostMessage => {
  return GameToHostMessageSchema.parse(value);
};

export const parseHostToGameMessage = (value: unknown): HostToGameMessage => {
  return HostToGameMessageSchema.parse(value);
};

export const isGameToHostMessage = (value: unknown): value is GameToHostMessage => {
  return GameToHostMessageSchema.safeParse(value).success;
};

export const isHostToGameMessage = (value: unknown): value is HostToGameMessage => {
  return HostToGameMessageSchema.safeParse(value).success;
};
