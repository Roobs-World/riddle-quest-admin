import {z} from "zod";
import {BRIDGE_PROTOCOL_VERSION} from "./constants";
import {UsernameSchema} from "../validation/requestSchemas";
import {
  AbandonRaceRunRequestSchema,
  ListRaceCategoriesRequestSchema,
  ListRaceInboxRequestSchema,
  PublishRaceChallengeRequestSchema,
  RaceChallengeIdRequestSchema,
  RaceAnalyticsEventRequestSchema,
  RaceRunIdRequestSchema,
  SocialReportCategorySchema,
  RequestRaceHintRequestSchema,
  SkipRaceRiddleRequestSchema,
  StartRaceRunRequestSchema,
  SubmitRaceGuessRequestSchema,
} from "../race";

export {BRIDGE_PROTOCOL_VERSION} from "./constants";

/** Validates the empty payload data shape. */
const EmptyPayloadSchema = z.object({}).strict();
/** Validates the metadata data shape. */
const MetadataSchema = z.object({
  requestId: z.string().min(1).optional(),
  sentAt: z.number().int().nonnegative().optional(),
});

/** Validates the game mode data shape. */
const GameModeSchema = z.enum(["classic", "challenge"]);
/** Bounds canonical riddle identifiers crossing the iframe bridge. */
const RiddleIdSchema = z.string().min(1).max(160);
/** Validates the operation data shape. */
const OperationSchema = z.enum([
  "auth",
  "loadRiddle",
  "guess",
  "completeGame",
  "hint",
  "spendCoins",
  "purchase",
  "skip",
  "profile",
  "avatar",
  "accountDeletion",
  "leaderboard",
  "raceCategories",
  "raceStart",
  "raceGuess",
  "raceHint",
  "raceSkip",
  "raceResume",
  "raceAbandon",
  "racePublish",
  "raceChallenge",
  "raceOutcome",
  "raceInbox",
  "raceBlock",
  "raceReport",
]);

/** Validates the bridge user data shape. */
export const BridgeUserSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  photoURL: z.string().url().optional(),
  isAnonymous: z.boolean(),
  platformRegistered: z.boolean().optional(),
});
/** Describes bridge user. */
export type BridgeUser = z.infer<typeof BridgeUserSchema>;

/** Validates the bridge profile data shape. */
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
  multiplayerGamesPlayed: z.number().int().nonnegative().optional(),
  multiplayerWins: z.number().int().nonnegative().optional(),
  multiplayerChallengesCreated: z.number().int().nonnegative().optional(),
  hasPurchasedApp: z.boolean().optional(),
});
/** Describes bridge profile. */
export type BridgeProfile = z.infer<typeof BridgeProfileSchema>;

/** Validates the bridge riddle data shape. */
export const BridgeRiddleSchema = z.object({
  riddleId: RiddleIdSchema,
  text: z.string().min(1),
  answerLength: z.number().int().positive(),
  sessionToken: z.string().min(20).max(128),
  gameMode: GameModeSchema,
  index: z.number().int().nonnegative().optional(),
  attemptsUsed: z.number().int().nonnegative().max(6),
  hasUsedContinue: z.boolean(),
  awaitingContinue: z.boolean(),
}).strict().superRefine((riddle, context) => {
  const expectedAwaiting = riddle.attemptsUsed === 5 && !riddle.hasUsedContinue;
  if (riddle.awaitingContinue !== expectedAwaiting) {
    context.addIssue({code: z.ZodIssueCode.custom, message: "Continue recovery state is inconsistent."});
  }
  if (riddle.hasUsedContinue && riddle.attemptsUsed < 5) {
    context.addIssue({code: z.ZodIssueCode.custom, message: "Continue cannot precede the base attempt cap."});
  }
  if (riddle.attemptsUsed > 5 + (riddle.hasUsedContinue ? 1 : 0)) {
    context.addIssue({code: z.ZodIssueCode.custom, message: "Attempt count exceeds the available limit."});
  }
});
/** Describes bridge riddle. */
export type BridgeRiddle = z.infer<typeof BridgeRiddleSchema>;

/** Validates the bridge leaderboard entry data shape. */
export const BridgeLeaderboardEntrySchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  totalWins: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
});
/** Describes bridge leaderboard entry. */
export type BridgeLeaderboardEntry = z.infer<typeof BridgeLeaderboardEntrySchema>;

/** Provides envelope behavior. */
const envelope = <Type extends string, Payload extends z.ZodTypeAny>(type: Type, payload: Payload) =>
  MetadataSchema.extend({
    type: z.literal(type),
    payload,
  });

/** Validates the game ready message data shape. */
export const GameReadyMessageSchema = envelope(
  "game:ready",
  z.object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    surface: z.literal("html5").default("html5"),
  }),
);

/** Validates the game resize message data shape. */
export const GameResizeMessageSchema = envelope(
  "game:resize",
  z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
);

/** Validates the game load riddle message data shape. */
export const GameLoadRiddleMessageSchema = envelope(
  "game:loadRiddle",
  z.object({
    gameMode: GameModeSchema,
    locale: z.string().min(2),
    classicIndex: z.number().int().nonnegative().optional(),
    sessionToken: z.string().min(20).max(128).optional(),
    riddleId: RiddleIdSchema.optional(),
  }),
);

/** Validates the game complete game message data shape. */
export const GameCompleteGameMessageSchema = envelope(
  "game:completeGame",
  z.object({
    riddleId: RiddleIdSchema,
    gameMode: GameModeSchema,
    sessionToken: z.string().min(20).max(128),
  }).strict(),
);

/** Validates a server-authoritative single-player guess message. */
export const GameSubmitGuessMessageSchema = envelope(
  "game:submitGuess",
  z.object({
    riddleId: RiddleIdSchema,
    gameMode: GameModeSchema,
    sessionToken: z.string().min(20).max(128),
    guess: z.string().min(1).max(7).regex(/^[a-z]+$/i),
    requestId: z.string().min(8).max(128),
  }).strict(),
);

/** Validates the game request hint message data shape. */
export const GameRequestHintMessageSchema = envelope(
  "game:requestHint",
  z.object({
    riddleId: RiddleIdSchema,
    gameMode: GameModeSchema,
    sessionToken: z.string().min(20).max(128),
    requestId: z.string().min(8).max(128),
    currentAttempt: z.array(z.string().max(1).regex(/^[a-z]?$/i)).max(7),
  }),
);

/** Validates the game spend coins message data shape. */
export const GameSpendCoinsMessageSchema = envelope(
  "game:spendCoins",
  z.object({
    reason: z.literal("continue"),
    gameMode: GameModeSchema,
    riddleId: RiddleIdSchema,
    sessionToken: z.string().min(20).max(128),
    amount: z.number().int().positive().optional(),
  }).strict(),
);

/** Validates a dedicated authoritative Classic skip message. */
export const GameSkipRiddleMessageSchema = envelope(
  "game:skipRiddle",
  z.object({
    gameMode: z.literal("classic"),
    riddleId: RiddleIdSchema,
    sessionToken: z.string().min(20).max(128),
  }).strict(),
);

/** Validates the game request purchase message data shape. */
export const GameRequestPurchaseMessageSchema = envelope(
  "game:requestPurchase",
  z.object({
    productId: z.string().min(1),
  }),
);

/** Validates the game load leaderboard message data shape. */
export const GameLoadLeaderboardMessageSchema = envelope(
  "game:loadLeaderboard",
  z.object({
    leaderboardType: z.enum(["xp", "totalWins", "bestStreak"]),
  }),
);

/** Validates the game update username message data shape. */
export const GameUpdateUsernameMessageSchema = envelope(
  "game:updateUsername",
  z.object({
    username: UsernameSchema,
  }),
);

/** Validates the game update avatar message data shape. */
export const GameUpdateAvatarMessageSchema = envelope(
  "game:updateAvatar",
  z.object({
    imageDataUrl: z
      .string()
      .max(700_000)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
  }),
);

/** Validates the game delete account message data shape. */
export const GameDeleteAccountMessageSchema = envelope("game:deleteAccount", EmptyPayloadSchema);

/** Validates the game list race categories message data shape. */
export const GameListRaceCategoriesMessageSchema = envelope("game:listRaceCategories", ListRaceCategoriesRequestSchema);
/** Validates the game start race message data shape. */
export const GameStartRaceMessageSchema = envelope("game:startRace", StartRaceRunRequestSchema);
/** Validates the game submit race guess message data shape. */
export const GameSubmitRaceGuessMessageSchema = envelope("game:submitRaceGuess", SubmitRaceGuessRequestSchema);
/** Validates the game request race hint message data shape. */
export const GameRequestRaceHintMessageSchema = envelope("game:requestRaceHint", RequestRaceHintRequestSchema);
/** Validates the game skip race riddle message data shape. */
export const GameSkipRaceRiddleMessageSchema = envelope("game:skipRaceRiddle", SkipRaceRiddleRequestSchema);
/** Validates the game resume race message data shape. */
export const GameResumeRaceMessageSchema = envelope("game:resumeRace", RaceRunIdRequestSchema);
/** Validates the game abandon race message data shape. */
export const GameAbandonRaceMessageSchema = envelope("game:abandonRace", AbandonRaceRunRequestSchema);
/** Validates the game publish race message data shape. */
export const GamePublishRaceMessageSchema = envelope("game:publishRace", PublishRaceChallengeRequestSchema);
/** Validates the game get race challenge message data shape. */
export const GameGetRaceChallengeMessageSchema = envelope("game:getRaceChallenge", RaceChallengeIdRequestSchema);
/** Validates the game get race outcome message data shape. */
export const GameGetRaceOutcomeMessageSchema = envelope("game:getRaceOutcome", RaceRunIdRequestSchema);
/** Validates the game list race inbox message data shape. */
export const GameListRaceInboxMessageSchema = envelope("game:listRaceInbox", ListRaceInboxRequestSchema);
/** Validates an immediate known-rival block request. */
export const GameBlockRivalMessageSchema = envelope(
  "game:blockRival",
  z.object({targetUserId: z.string().trim().min(1).max(128)}).strict(),
);
/** Validates a categorized known-rival report request. */
export const GameReportRivalMessageSchema = envelope(
  "game:reportRival",
  z.object({
    targetUserId: z.string().trim().min(1).max(128),
    category: SocialReportCategorySchema,
  }).strict(),
);

/** Validates the game analytics message data shape. */
export const GameAnalyticsMessageSchema = envelope(
  "game:analytics",
  RaceAnalyticsEventRequestSchema.omit({eventId: true}),
);

/** Validates the game error message data shape. */
export const GameErrorMessageSchema = envelope(
  "game:error",
  z.object({
    message: z.string().min(1),
    stack: z.string().optional(),
  }),
);

/** Validates the game to host message data shape. */
export const GameToHostMessageSchema = z.discriminatedUnion("type", [
  GameReadyMessageSchema,
  GameResizeMessageSchema,
  GameLoadRiddleMessageSchema,
  GameSubmitGuessMessageSchema,
  GameCompleteGameMessageSchema,
  GameRequestHintMessageSchema,
  GameSpendCoinsMessageSchema,
  GameSkipRiddleMessageSchema,
  GameRequestPurchaseMessageSchema,
  GameLoadLeaderboardMessageSchema,
  GameUpdateUsernameMessageSchema,
  GameUpdateAvatarMessageSchema,
  GameDeleteAccountMessageSchema,
  GameListRaceCategoriesMessageSchema,
  GameStartRaceMessageSchema,
  GameSubmitRaceGuessMessageSchema,
  GameRequestRaceHintMessageSchema,
  GameSkipRaceRiddleMessageSchema,
  GameResumeRaceMessageSchema,
  GameAbandonRaceMessageSchema,
  GamePublishRaceMessageSchema,
  GameGetRaceChallengeMessageSchema,
  GameGetRaceOutcomeMessageSchema,
  GameListRaceInboxMessageSchema,
  GameBlockRivalMessageSchema,
  GameReportRivalMessageSchema,
  GameAnalyticsMessageSchema,
  GameErrorMessageSchema,
]);
/** Describes game to host message. */
export type GameToHostMessage = z.infer<typeof GameToHostMessageSchema>;

/** Validates the host init message data shape. */
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

/** Validates the host auth state message data shape. */
export const HostAuthStateMessageSchema = envelope(
  "host:authState",
  z.object({
    user: BridgeUserSchema.nullable(),
    profile: BridgeProfileSchema.nullable(),
  }),
);

/** Validates the host riddle loaded message data shape. */
export const HostRiddleLoadedMessageSchema = envelope(
  "host:riddleLoaded",
  z.object({
    riddle: BridgeRiddleSchema,
    profile: BridgeProfileSchema.nullable().optional(),
  }),
);

/** Validates the host operation result message data shape. */
export const HostOperationResultMessageSchema = envelope(
  "host:operationResult",
  z.object({
    operation: OperationSchema,
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
  }),
);

/** Validates the host pause message data shape. */
export const HostPauseMessageSchema = envelope("host:pause", EmptyPayloadSchema);
/** Validates the host resume message data shape. */
export const HostResumeMessageSchema = envelope("host:resume", EmptyPayloadSchema);

/** Validates the host to game message data shape. */
export const HostToGameMessageSchema = z.discriminatedUnion("type", [
  HostInitMessageSchema,
  HostAuthStateMessageSchema,
  HostRiddleLoadedMessageSchema,
  HostOperationResultMessageSchema,
  HostPauseMessageSchema,
  HostResumeMessageSchema,
]);
/** Describes host to game message. */
export type HostToGameMessage = z.infer<typeof HostToGameMessageSchema>;

/** Describes bridge message. */
export type BridgeMessage = GameToHostMessage | HostToGameMessage;

/** Parses game to host message. */
export const parseGameToHostMessage = (value: unknown): GameToHostMessage => {
  return GameToHostMessageSchema.parse(value);
};

/** Parses host to game message. */
export const parseHostToGameMessage = (value: unknown): HostToGameMessage => {
  return HostToGameMessageSchema.parse(value);
};

/** Indicates whether is game to host message. */
export const isGameToHostMessage = (value: unknown): value is GameToHostMessage => {
  return GameToHostMessageSchema.safeParse(value).success;
};

/** Indicates whether is host to game message. */
export const isHostToGameMessage = (value: unknown): value is HostToGameMessage => {
  return HostToGameMessageSchema.safeParse(value).success;
};
