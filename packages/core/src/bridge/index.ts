/**
 * Runtime-validated messages exchanged between the game iframe and its host.
 * @remarks Treat every value as untrusted. Exported schemas define the wire
 * contract; `parse*` helpers throw on invalid messages, while `is*` helpers
 * support non-throwing routing by the `type` discriminant.
 * @packageDocumentation
 */
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
/** Rejects any property on a message whose payload is intentionally empty. */
const EmptyPayloadSchema = z.object({}).strict();
/** Validates optional correlation metadata shared by every bridge envelope. */
const MetadataSchema = z.object({
  requestId: z.string().min(1).optional(),
  sentAt: z.number().int().nonnegative().optional(),
});

/** Restricts bridge game modes to the two modes implemented by the host. */
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

/**
 * Validates the bounded identity projection that the host may expose to the game.
 * @remarks Provider credentials and signed identity assertions must never be
 * sent through this client-facing shape.
 */
export const BridgeUserSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  photoURL: z.string().url().optional(),
  isAnonymous: z.boolean(),
  platformRegistered: z.boolean().optional(),
});
/** A validated, provider-neutral player identity visible inside the game iframe. */
export type BridgeUser = z.infer<typeof BridgeUserSchema>;

/** Validates the player profile and aggregate progress snapshot sent by the host. */
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
/** The normalized profile shape consumed by game presentation code. */
export type BridgeProfile = z.infer<typeof BridgeProfileSchema>;

/**
 * Validates a server-issued riddle session before the game restores it.
 * @remarks Enforces the five-attempt base limit, one-attempt continue, and the
 * corresponding `awaitingContinue` state. This strict object rejects unknown
 * fields rather than reinterpreting authoritative session state.
 */
export const BridgeRiddleSchema = z
  .object({
    riddleId: RiddleIdSchema,
    text: z.string().min(1),
    answerLength: z.number().int().positive(),
    sessionToken: z.string().min(20).max(128),
    gameMode: GameModeSchema,
    index: z.number().int().nonnegative().optional(),
    attemptsUsed: z.number().int().nonnegative().max(6),
    hasUsedContinue: z.boolean(),
    awaitingContinue: z.boolean(),
  })
  .strict()
  .superRefine((riddle, context) => {
    /** Provides expected awaiting behavior. */
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
/** A validated authoritative riddle-session snapshot delivered to the game. */
export type BridgeRiddle = z.infer<typeof BridgeRiddleSchema>;

/** Validates the display-safe subset of a server-authoritative leaderboard row. */
export const BridgeLeaderboardEntrySchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  totalWins: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
});
/** A normalized leaderboard row suitable for rendering in the game iframe. */
export type BridgeLeaderboardEntry = z.infer<typeof BridgeLeaderboardEntrySchema>;

/**
 * Adds a literal message discriminant and optional correlation metadata to a payload schema.
 * @param type - Stable wire-level message name.
 * @param payload - Zod schema used to validate the message payload.
 * @returns A schema for the complete bridge envelope.
 */
const envelope = <Type extends string, Payload extends z.ZodTypeAny>(type: Type, payload: Payload) =>
  MetadataSchema.extend({
    type: z.literal(type),
    payload,
  });

/** Validates the game's protocol-version handshake after the iframe is ready. */
export const GameReadyMessageSchema = envelope(
  "game:ready",
  z.object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    surface: z.literal("html5").default("html5"),
  }),
);

/** Validates positive pixel dimensions reported by the embedded game surface. */
export const GameResizeMessageSchema = envelope(
  "game:resize",
  z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
);

/** Validates an initial riddle request or a resume with optional session identifiers. */
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

/** Validates the identifiers required to complete a server-owned game session. */
export const GameCompleteGameMessageSchema = envelope(
  "game:completeGame",
  z
    .object({
      riddleId: RiddleIdSchema,
      gameMode: GameModeSchema,
      sessionToken: z.string().min(20).max(128),
    })
    .strict(),
);

/** Validates an authoritative guess bound to a session and replay-safe `requestId`. */
export const GameSubmitGuessMessageSchema = envelope(
  "game:submitGuess",
  z
    .object({
      riddleId: RiddleIdSchema,
      gameMode: GameModeSchema,
      sessionToken: z.string().min(20).max(128),
      guess: z
        .string()
        .min(1)
        .max(7)
        .regex(/^[a-z]+$/i),
      requestId: z.string().min(8).max(128),
    })
    .strict(),
);

/**
 * Validates a replay-safe hint request and the player's current partial attempt.
 * The backend owns coin spending and revealed positions.
 */
export const GameRequestHintMessageSchema = envelope(
  "game:requestHint",
  z.object({
    riddleId: RiddleIdSchema,
    gameMode: GameModeSchema,
    sessionToken: z.string().min(20).max(128),
    requestId: z.string().min(8).max(128),
    currentAttempt: z
      .array(
        z
          .string()
          .max(1)
          .regex(/^[a-z]?$/i),
      )
      .max(7),
  }),
);

/** Validates the dedicated continue purchase for an authoritative game session. */
export const GameSpendCoinsMessageSchema = envelope(
  "game:spendCoins",
  z
    .object({
      reason: z.literal("continue"),
      gameMode: GameModeSchema,
      riddleId: RiddleIdSchema,
      sessionToken: z.string().min(20).max(128),
      amount: z.number().int().positive().optional(),
    })
    .strict(),
);

/** Validates a dedicated authoritative Classic skip message. */
export const GameSkipRiddleMessageSchema = envelope(
  "game:skipRiddle",
  z
    .object({
      gameMode: z.literal("classic"),
      riddleId: RiddleIdSchema,
      sessionToken: z.string().min(20).max(128),
    })
    .strict(),
);

/** Validates a request to begin a provider purchase for a catalog product. */
export const GameRequestPurchaseMessageSchema = envelope(
  "game:requestPurchase",
  z.object({
    productId: z.string().min(1),
  }),
);

/** Restricts leaderboard requests to the three supported ranking projections. */
export const GameLoadLeaderboardMessageSchema = envelope(
  "game:loadLeaderboard",
  z.object({
    leaderboardType: z.enum(["xp", "totalWins", "bestStreak"]),
  }),
);

/** Validates a username update using the shared normalization and length policy. */
export const GameUpdateUsernameMessageSchema = envelope(
  "game:updateUsername",
  z.object({
    username: UsernameSchema,
  }),
);

/** Validates a JPEG, PNG, or WebP data URL capped at 700,000 characters. */
export const GameUpdateAvatarMessageSchema = envelope(
  "game:updateAvatar",
  z.object({
    imageDataUrl: z
      .string()
      .max(700_000)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
  }),
);

/** Validates an account-deletion request with no client-controlled payload. */
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
  z
    .object({
      targetUserId: z.string().trim().min(1).max(128),
      category: SocialReportCategorySchema,
    })
    .strict(),
);

/** Validates a bounded race analytics event; the host assigns its durable event identifier. */
export const GameAnalyticsMessageSchema = envelope(
  "game:analytics",
  RaceAnalyticsEventRequestSchema.omit({eventId: true}),
);

/** Validates a client error report forwarded to the host's observability adapter. */
export const GameErrorMessageSchema = envelope(
  "game:error",
  z.object({
    message: z.string().min(1),
    stack: z.string().optional(),
  }),
);

/** Validates every game-to-host message using its `type` discriminant. */
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
/** A game-to-host message after runtime validation by {@link GameToHostMessageSchema}. */
export type GameToHostMessage = z.infer<typeof GameToHostMessageSchema>;

/** Validates initial host state and requires the literal bridge protocol version. */
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

/** Validates a later provider-neutral identity/profile transition from the host. */
export const HostAuthStateMessageSchema = envelope(
  "host:authState",
  z.object({
    user: BridgeUserSchema.nullable(),
    profile: BridgeProfileSchema.nullable(),
  }),
);

/** Validates an authoritative riddle load result and optional refreshed profile. */
export const HostRiddleLoadedMessageSchema = envelope(
  "host:riddleLoaded",
  z.object({
    riddle: BridgeRiddleSchema,
    profile: BridgeProfileSchema.nullable().optional(),
  }),
);

/** Validates operation status; operation-specific consumers must validate `data`. */
export const HostOperationResultMessageSchema = envelope(
  "host:operationResult",
  z.object({
    operation: OperationSchema,
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
  }),
);

/** Validates a host lifecycle pause signal with an empty payload. */
export const HostPauseMessageSchema = envelope("host:pause", EmptyPayloadSchema);
/** Validates a host lifecycle resume signal with an empty payload. */
export const HostResumeMessageSchema = envelope("host:resume", EmptyPayloadSchema);

/** Validates every lifecycle, identity, content, and operation message sent by the host. */
export const HostToGameMessageSchema = z.discriminatedUnion("type", [
  HostInitMessageSchema,
  HostAuthStateMessageSchema,
  HostRiddleLoadedMessageSchema,
  HostOperationResultMessageSchema,
  HostPauseMessageSchema,
  HostResumeMessageSchema,
]);
/** A host-to-game message after runtime validation by {@link HostToGameMessageSchema}. */
export type HostToGameMessage = z.infer<typeof HostToGameMessageSchema>;

/** Any validated message traveling in either direction across the iframe bridge. */
export type BridgeMessage = GameToHostMessage | HostToGameMessage;

/**
 * Parses an untrusted value received from the game iframe.
 * @param value - Candidate bridge value, commonly a `MessageEvent.data` payload.
 * @returns The parsed game-to-host message with schema defaults applied.
 * @throws {@link z.ZodError} when the envelope, discriminant, metadata, or payload is invalid.
 */
export const parseGameToHostMessage = (value: unknown): GameToHostMessage => {
  return GameToHostMessageSchema.parse(value);
};

/**
 * Parses an untrusted value received from the host page.
 * @param value - Candidate bridge value, commonly a `MessageEvent.data` payload.
 * @returns The parsed host-to-game message with schema defaults applied.
 * @throws {@link z.ZodError} when the envelope, discriminant, metadata, or payload is invalid.
 */
export const parseHostToGameMessage = (value: unknown): HostToGameMessage => {
  return HostToGameMessageSchema.parse(value);
};

/**
 * Tests a candidate game-to-host value without throwing or returning parsed defaults.
 * @param value - Value to validate.
 * @returns Whether the complete game-to-host schema accepts the value.
 */
export const isGameToHostMessage = (value: unknown): value is GameToHostMessage => {
  return GameToHostMessageSchema.safeParse(value).success;
};

/**
 * Tests a candidate host-to-game value without throwing or returning parsed defaults.
 * @param value - Value to validate.
 * @returns Whether the complete host-to-game schema accepts the value.
 */
export const isHostToGameMessage = (value: unknown): value is HostToGameMessage => {
  return HostToGameMessageSchema.safeParse(value).success;
};
