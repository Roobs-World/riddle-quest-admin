import {readProtectedContent} from "@qwordly/core/contentProtection";
import type {RaceEntryResponse, CancelRaceInviteRequest, RaceLocale} from "@qwordly/core/race";
import {httpsCallable as rawHttpsCallable, type Functions} from "firebase/functions";
import type {
  ClassicRiddleBufferResponse,
  CompleteGameInput,
  CompleteGameOutput,
  SkipRiddleResponse,
  SpendCoinsRequest,
  SubmitSinglePlayerGuessInput,
  SubmitSinglePlayerGuessOutput,
} from "@qwordly/core/validation";
import type {
  AbandonRaceRunRequest,
  AbandonRaceRunResponse,
  ListRaceCategoriesRequest,
  ListRaceCategoriesResponse,
  ListRaceInboxRequest,
  ListRaceInboxResponse,
  PublishRaceChallengeRequest,
  PublishRaceChallengeResponse,
  ReserveRaceInviteRequest,
  ReserveRaceInviteResponse,
  RaceAccessRequest,
  RaceAccessResponse,
  RaceAnalyticsEventRequest,
  RaceAnalyticsEventResponse,
  RaceChallengePreview,
  RaceOutcome,
  RaceRunResponse,
  RaceMatchRequest,
  RaceMatchResponse,
  RequestRaceHintRequest,
  RequestRaceHintResponse,
  SkipRaceRiddleRequest,
  SkipRaceRiddleResponse,
  StartRaceRunRequest,
  ReadyRaceRunRequest,
  SubmitRaceGuessRequest,
  SubmitRaceGuessResponse,
} from "@qwordly/core/race";

/** Region that hosts solo gameplay and multiplayer callables beside eur3. */
export const DEFAULT_GAMEPLAY_REGION = "europe-west1";
/** Region that hosts account, profile, and provider callables unless a target overrides it. */
export const DEFAULT_ACCOUNT_REGION = "us-central1";

/** Answer and hint delivery opts into encryption; older backend responses remain readable. */
const protectedEndpoints = new Set(["getCurrentDailyChallenge", "getCurrentClassicRiddle", "getClassicRiddleBuffer",
  "getHint", "skipRiddle", "startRaceRun", "readyRaceRun", "submitRaceGuess", "requestRaceHint", "skipRaceRiddle", "resumeRaceRun"]);
/** Host choices for how the client talks to the backend. */
export type GameFunctionsOptions = Readonly<{
  /**
   * Whether answer-bearing responses are requested as AES-GCM envelopes decoded with Web Crypto.
   * Browser hosts keep this on to deter casual inspection; a native app whose bundle already
   * holds the decoding key turns it off, which also avoids requiring `crypto.subtle` at runtime.
   */
  contentProtection?: boolean;
}>;
/** Builds the callable wrapper for one host's protection choice. */
function createCallableFactory(options: GameFunctionsOptions) {
  /** Whether protected endpoints negotiate encrypted transport. */
  const protect = options.contentProtection ?? true;
  /** Keeps the SDK result contract while decoding only opted-in gameplay transports. */
  return function httpsCallable<Input = unknown, Output = unknown>(functions: Parameters<typeof rawHttpsCallable>[0], name: string) {
    /** SDK operation bound to its target region. */
    const call = rawHttpsCallable<Input, Output>(functions, name);
    if (!protect || !protectedEndpoints.has(name)) return call;
    return async (input?: Input) => {
      /** Encrypted response from a supporting backend, or a legacy plaintext response. */
      const result = await call({...input, contentProtection: 1} as Input);
      return {...result, data: await readProtectedContent(result.data) as Output};
    };
  };
}

/** Region-bound Functions handles a host prepares before creating the client. */
export type GameFunctionRegions = Readonly<{
  /** Account, profile, social, and provider callables. */
  account: Functions;
  /** Solo gameplay callables. */
  gameplay: Functions;
  /** Multiplayer callables. */
  race: Functions;
}>;

/** Describes current riddle response. */
export type CurrentRiddleResponse = {
  /** Canonical Classic position of the issued question after terminal recovery. */
  classicIndex?: number;
  /** Stores challenge. */
  challenge?: {
    /** Stores date. */
    date?: string;
    /** Stores questions. */
    questions: Array<{
      /** Stores riddle id. */
      riddleId: string;
      /** Stores text. */
      text: string;
      /** Stores answer length. */
      answerLength: number;
      /** Canonical scoring data used only for immediate presentation. */
      evaluation?: {
        /** Answer supplied with this issued single-player riddle. */
        answer: string;
        /** Canonical content locale, including fallback language. */
        locale: string;
      };
      /** Stores session token. */
      sessionToken: string;
      /** Stores question number. */
      questionNumber: number;
      /** Letters previously purchased in the issued session. */
      revealedHints?: {
        /** Zero-based answer slot must stay within the issued grapheme shape. */
        index: number;
        /** One answer grapheme occupies its original positional slot. */
        letter: string}[];
      /** Complete accepted feedback history is optional for legacy sessions. */
      acceptedGuesses?: {
        /** Accepted attempt number orders recovered feedback rows. */
        attempt: number;
        /** Positional scoring colors accompany the accepted submitted graphemes. */
        feedback: {
        /** One answer grapheme occupies its original positional slot. */
        letter: string;
        /** Accepted positional color is green, yellow or red. */
        status: "green" | "yellow" | "red"}[]}[];
      /** Stores attempts used. */
      attemptsUsed: number;
      /** Stores has used continue. */
      hasUsedContinue: boolean;
      /** Stores awaiting continue. */
      awaitingContinue: boolean;
    }>;
    /** Stores total questions. */
    totalQuestions: number;
  };
  /** Stores current question. */
  currentQuestion?: number;
  /** Stores has completed today. */
  hasCompletedToday?: boolean;
  /** Stores questions completed. */
  questionsCompleted?: number;
  /** Stores error. */
  error?: string;
};
/** Describes spend coins output. */
export type SpendCoinsOutput = {
  /** Stores new coins. */
  newCoins: number;
};
/** Describes get hint input. */
export type GetHintInput = {
  /** Stores current attempt. */
  currentAttempt: string[];
  /** Stores riddle id. */
  riddleId: string;
  /** Stores opaque authoritative session token. */
  sessionToken: string;
  /** Stores the replay-safe request identity. */
  requestId: string;
  /** Stores game mode. */
  gameMode: "classic" | "challenge";
};
/** Describes get hint output. */
export type GetHintOutput = {
  /** Stores revealed letter. */
  revealedLetter: string;
  /** Stores index. */
  index: number;
  /** Stores coins cost. */
  coinsCost: number;
  /** Stores new coins. */
  newCoins?: number;
  /** Stores newly unlocked achievement ids. */
  newlyUnlockedAchievementIds?: string[];
} | null;

/** Response of `provisionAndroidAccount`. */
export type ProvisionAndroidAccountOutput = {
  /** Firebase uid owning the Global Game Account. */
  uid: string;
  /** Whether the call created the account. */
  created: boolean;
  /** Confirmed coin balance. */
  coins: number;
};

/**
 * Creates the typed callable surface shared by every Firebase-backed host.
 *
 * @remarks
 * Hosts own Firebase app initialization, auth persistence, App Check, and emulator
 * wiring; this factory only binds callables to the regions a host prepared.
 */
export function createGameFunctionsClient(regions: GameFunctionRegions, options: GameFunctionsOptions = {}) {
  /** Callable wrapper honouring the host's protection choice. */
  const httpsCallable = createCallableFactory(options);
  /** Creates a server-authorized Stripe Checkout Session for Yahoo. */
  const createYahooStripeCheckout = httpsCallable<
    {
      /** Stores product id. */
      productId: string;
      /** Stores checkout attempt id. */
      checkoutAttemptId: string;
    },
    {
      /** Stores checkout url. */
      checkoutUrl: string;
    }
  >(regions.account, "createYahooStripeCheckout");
  /** Confirms and idempotently grants a paid Yahoo Stripe Checkout Session. */
  const confirmYahooStripeCheckout = httpsCallable<
    {
      /** Stores session id. */
      sessionId: string;
    },
    {
      /** Stores coins. */
      coins: number;
    }
  >(regions.account, "confirmYahooStripeCheckout");
  /** Gets current daily challenge. */
  const getCurrentDailyChallenge = httpsCallable<
    | {
        /** Stores locale. */
        locale?: string;
        /** Stores session token. */
        sessionToken?: string;
        /** Stores riddle id. */
        riddleId?: string;
        /** Requests presentation-only scoring data for immediate feedback. */
        includeEvaluation?: boolean;
        /** Requests authoritative purchased hint recovery. */
        includeHintRecovery?: boolean;
        /** Opts in to authoritative accepted guess recovery. */
        includeGuessRecovery?: boolean;
      }
    | undefined,
    CurrentRiddleResponse
  >(regions.gameplay, "getCurrentDailyChallenge");
  /** Gets current classic riddle. */
  const getCurrentClassicRiddle = httpsCallable<
    {
      /** Stores classic index. */
      classicIndex: number;
      /** Opts in to the issued question's server-confirmed Classic position. */
      includeClassicIndex?: boolean;
      /** Stores locale. */
      locale?: string;
      /** Stores session token. */
      sessionToken?: string;
      /** Stores riddle id. */
      riddleId?: string;
      /** Requests presentation-only scoring data for immediate feedback. */
      includeEvaluation?: boolean;
      /** Requests authoritative purchased hint recovery. */
      includeHintRecovery?: boolean;
      /** Opts in to authoritative accepted guess recovery. */
      includeGuessRecovery?: boolean;
    },
    CurrentRiddleResponse
  >(regions.gameplay, "getCurrentClassicRiddle");
  /** Issues the current Classic question and up to three future questions. */
  const getClassicRiddleBuffer = httpsCallable<
    {
      /** Requested content locale. */
      locale: string;
      /** Requests authoritative purchased hint recovery. */
      includeHintRecovery?: boolean;
      /** Opts in to authoritative accepted guess recovery. */
      includeGuessRecovery?: boolean;
    },
    ClassicRiddleBufferResponse
  >(regions.gameplay, "getClassicRiddleBuffer");
  /** Completes game. */
  const completeGame = httpsCallable<CompleteGameInput, CompleteGameOutput>(regions.gameplay, "completeGame");
  /** Submits one server-authoritative single-player guess. */
  const submitSinglePlayerGuess = httpsCallable<SubmitSinglePlayerGuessInput, SubmitSinglePlayerGuessOutput>(
    regions.gameplay,
    "submitSinglePlayerGuess",
  );
  /** Gets hint. */
  const getHint = httpsCallable<GetHintInput, GetHintOutput>(regions.gameplay, "getHint");
  /** Provides spend coins behavior. */
  const spendCoins = httpsCallable<SpendCoinsRequest, SpendCoinsOutput>(regions.gameplay, "spendCoins");
  /** Provides skip riddle behavior. */
  const skipRiddle = httpsCallable<
    {
      /** Stores riddle id. */
      riddleId: string;
      /** Stores game mode. */
      gameMode: "classic" | "challenge";
      /** Stores session token. */
      sessionToken: string;
      /** Stores request id. */
      requestId: string;
    },
    SkipRiddleResponse
  >(regions.gameplay, "skipRiddle");
  /** Gets leaderboard. */
  const getLeaderboard = httpsCallable<
    {
      /** Stores type. */
      type: "xp" | "totalWins" | "bestStreak" | "multiplayerWins";
      /** Stores limit. */
      /** Stores limit. */
      limit?: number;
    },
    {
      /** Stores entries. */
      entries: Array<{
        /** Stores user id. */
        userId: string;
        /** Stores username. */
        username: string;
        /** Stores avatar url. */
        avatarUrl?: string;
        /** Stores level. */
        level: number;
        /** Stores xp. */
        xp: number;
        /** Stores total wins. */
        totalWins: number;
        /** Server-confirmed multiplayer victories. */
        multiplayerWins?: number;
        /** Stores best streak. */
        bestStreak: number;
      }>;
      /** Stores requesting user id. */
      requestingUserId: string;
    }
  >(regions.account, "getLeaderboard");
  /** Updates username. */
  const updateUsername = httpsCallable<
    {
      /** Stores username. */
      username: string;
    },
    {
      /** Stores success. */
      success: boolean;
      /** Stores message. */
      /** Stores message. */
      message: string;
    }
  >(regions.account, "updateUsername");
  /** Updates avatar. */
  const updateAvatar = httpsCallable<
    {
      /** Stores image data url. */
      imageDataUrl: string;
    },
    {
      /** Stores success. */
      success: true;
      /** Stores message. */
      /** Stores message. */
      message: string;
      /** Stores avatar url. */
      /** Stores avatar url. */
      avatarUrl: string;
    }
  >(regions.account, "updateAvatar");
  /** Fills an empty Jest game profile avatar from the platform profile. */
  const syncJestAvatar = httpsCallable<
    {
      /** Stores avatar url. */
      avatarUrl: string;
    },
    {
      /** Stores avatar url. */
      avatarUrl: string;
    }
  >(regions.account, "syncJestAvatar");
  /** Deletes account. */
  const deleteAccount = httpsCallable<
    Record<string, never>,
    {
      /** Stores success. */
      success: true;
    }
  >(regions.account, "deleteAccount");
  /** Changes server-owned presence consent for the current authenticated account. */
  const setPresenceConsent = httpsCallable<
    {
      /** Stores enabled. */
      enabled: boolean;
    },
    {
      /** Stores success. */
      success: true;
      /** Stores enabled. */
      /** Stores enabled. */
      enabled: boolean;
    }
  >(regions.account, "setPresenceConsent");
  /** Lists race categories. */
  const listRaceCategories = httpsCallable<ListRaceCategoriesRequest, ListRaceCategoriesResponse>(
    regions.race,
    "listRaceCategories",
  );
  /** Starts race run. */
  const startRaceRun = httpsCallable<StartRaceRunRequest, RaceRunResponse>(regions.race, "startRaceRun");
  /** Schedules an owned prepared run with a server-controlled countdown. */
  const readyRaceRun = httpsCallable<ReadyRaceRunRequest, RaceRunResponse>(regions.race, "readyRaceRun");
  /** Provider scope comes from authenticated Firebase identity, never from matchmaking preferences. */
  const findRaceMatch = httpsCallable<RaceMatchRequest, RaceMatchResponse>(regions.race, "findRaceMatch");
  /** Submits race guess. */
  const submitRaceGuess = httpsCallable<SubmitRaceGuessRequest, SubmitRaceGuessResponse>(
    regions.race,
    "submitRaceGuess",
  );
  /** Requests race hint. */
  const requestRaceHint = httpsCallable<RequestRaceHintRequest, RequestRaceHintResponse>(
    regions.race,
    "requestRaceHint",
  );
  /** Provides skip race riddle behavior. */
  const skipRaceRiddle = httpsCallable<SkipRaceRiddleRequest, SkipRaceRiddleResponse>(regions.race, "skipRaceRiddle");
  /** Provides resume race run behavior. */
  const resumeRaceRun = httpsCallable<
    {
      /** Stores run id. */
      runId: string;
      /** Requests current-question local scoring data. */
      includeEvaluation?: boolean;
      /** Requests bounded confirmed presentation rows after reload. */
      includeGuessHistory?: boolean;
    },
    RaceRunResponse
  >(regions.race, "resumeRaceRun");
  /** Provides abandon race run behavior. */
  const abandonRaceRun = httpsCallable<AbandonRaceRunRequest, AbandonRaceRunResponse>(regions.race, "abandonRaceRun");
  /** Publishes race challenge. */
  const publishRaceChallenge = httpsCallable<PublishRaceChallengeRequest, PublishRaceChallengeResponse>(
    regions.race,
    "publishRaceChallenge",
  );
  /** Reserves a server-owned two-player lobby before opening a Jest invite. */
  const reserveRaceInvite = httpsCallable<ReserveRaceInviteRequest, ReserveRaceInviteResponse>(
    regions.race,
    "reserveRaceInvite",
  );
  /** Gets race challenge. */
  const getRaceChallenge = httpsCallable<
    {
      /** Stores challenge id. */
      challengeId: string;
      /** Stores locale. */
      locale: import("@qwordly/core/race").RaceLocale;
    },
    RaceChallengePreview
  >(regions.race, "getRaceChallenge");
  /** Gets race outcome. */
  const getRaceOutcome = httpsCallable<
    {
      /** Stores run id. */
      runId: string;
    },
    RaceOutcome
  >(regions.race, "getRaceOutcome");
  /** Lists race inbox. */
  const listRaceInbox = httpsCallable<ListRaceInboxRequest | undefined, ListRaceInboxResponse>(
    regions.race,
    "listRaceInbox",
  );
  /** Immediately blocks an established social rival. */
  const blockRival = httpsCallable<import("@qwordly/core/race").BlockSocialRivalRequest, {
    /** Confirmed block status. */
    blocked: true;
  }>(regions.account, "blockRival");
  /** Queues a categorized known-rival or private live-opponent report. */
  const reportRival = httpsCallable<import("@qwordly/core/race").ReportSocialRivalRequest,
    {
      /** Opaque server queue receipt. */
      reportId: string;
      /** Queue acknowledgement. */
      queued: true;
    }>(regions.account, "reportRival");
  /** Gets race access. */
  const getRaceAccess = httpsCallable<RaceAccessRequest | undefined, RaceAccessResponse>(
    regions.race,
    "getRaceAccess",
  );
  /** Records race analytics. */
  const recordRaceAnalytics = httpsCallable<RaceAnalyticsEventRequest, RaceAnalyticsEventResponse>(
    regions.race,
    "recordRaceAnalytics",
  );
  /** Reads lifecycle-aware readiness for public recordings and private reservations. */
  const getRaceEntry = httpsCallable<{
      /** Incoming challenge. */ challengeId: string;
      /** Content language. */ locale: RaceLocale;
      /** Negotiates the viewer role without changing legacy responses. */ includeViewerRole?: boolean;
      /** Requests the authenticated recipient's previously accepted run pointer for recovery. */
      includeExistingAttempt?: boolean}, RaceEntryResponse>(regions.race, "getRaceEntry");
  /** Cancels only a creator-owned reservation, preserving reusable public challenges. */
  const cancelRaceInvite = httpsCallable<CancelRaceInviteRequest, RaceEntryResponse>(regions.race, "cancelRaceInvite");
  /** Authenticated live matchmaking and input transports. */
  const joinLiveRace = httpsCallable<import("@qwordly/core/race").JoinLiveRace, import("@qwordly/core/race").LiveRaceView>(regions.race, "joinLiveRace");
  /** Retires a stable account-owned join without cancelling a newer recovered seat. */
  const retireLiveRaceJoin = httpsCallable<import("@qwordly/core/race").RetireLiveRaceJoin, import("@qwordly/core/race").RetireLiveRaceJoinResponse>(regions.race, "retireLiveRaceJoin");
  /** Optional private receipt observation leaves existing command transports unchanged. */
  const confirmLiveGuessReceipt = httpsCallable<import("@qwordly/core/race").LiveGuessReceiptQuery, import("@qwordly/core/race").LiveGuessReceiptResult>(regions.race, "confirmLiveGuessReceipt");
  /** Reads live progress and commits idempotent commands. */
  const updateLiveRace = rawHttpsCallable<import("@qwordly/core/race").UpdateLiveRace, import("@qwordly/core/race").LiveRaceView, {
    /** Private wake-up notification received through the same authenticated endpoint. */
    revision: string | null;
  }>(regions.race, "updateLiveRace");
  /** Reads a server-validated private PvP invitation from platform entry data. */
  const getLiveRaceChallenge = httpsCallable<{
    /** Server invitation handle. */
    challengeId: string;
  }, import("@qwordly/core/race").LiveRaceChallenge>(regions.race, "getLiveRaceChallenge");
  /** Addresses an existing player and queues a server-owned offline notification. */
  const sendLiveRaceChallenge = httpsCallable<{
    /** Creator-owned private lobby. */ challengeId: string;
    /** Server-resolved existing game username. */ recipientUsername: string;
  }, {/** Durable work receipt, not provider delivery. */ /** Stores status. */
  /** Stores status. */
  status: "queued"}>(regions.race, "sendLiveRaceChallenge");
  /** Reads direct challenge notices without accepting their lobby. */
  const listLiveRaceChallenges = httpsCallable<Record<string, never>, import("@qwordly/core/race").LiveRaceChallenge[]>(regions.race, "listLiveRaceChallenges");
  /** Locale-bound retained results never include another account or answer-bearing run. */
  const listLiveRaceHistory = httpsCallable<import("@qwordly/core/race").ListLiveRaceHistoryRequest, import("@qwordly/core/race").ListLiveRaceHistoryResponse>(regions.race, "listLiveRaceHistory");
  /** Stores explicit browser-push consent on the authenticated registered Jest account. */
  const setLiveRacePushSubscription = httpsCallable<{
    /** False revokes the current subscription. */ enabled: boolean;
    /** Opaque browser instance token; never a recipient identity. */ token?: string;
  }, {/** Committed preference. */ /** Stores enabled. */
  /** Stores enabled. */
  enabled: boolean}>(regions.race, "setLiveRacePushSubscription");
  return {
    createYahooStripeCheckout,
    confirmYahooStripeCheckout,
    getCurrentDailyChallenge,
    getCurrentClassicRiddle,
    getClassicRiddleBuffer,
    completeGame,
    submitSinglePlayerGuess,
    getHint,
    spendCoins,
    skipRiddle,
    getLeaderboard,
    updateUsername,
    updateAvatar,
    syncJestAvatar,
    deleteAccount,
    setPresenceConsent,
    listRaceCategories,
    startRaceRun,
    readyRaceRun,
    findRaceMatch,
    submitRaceGuess,
    requestRaceHint,
    skipRaceRiddle,
    resumeRaceRun,
    abandonRaceRun,
    publishRaceChallenge,
    reserveRaceInvite,
    getRaceChallenge,
    getRaceOutcome,
    listRaceInbox,
    blockRival,
    reportRival,
    getRaceAccess,
    recordRaceAnalytics,
    getRaceEntry,
    cancelRaceInvite,
    joinLiveRace,
    retireLiveRaceJoin,
    confirmLiveGuessReceipt,
    getLiveRaceChallenge,
    sendLiveRaceChallenge,
    listLiveRaceChallenges,
    listLiveRaceHistory,
    setLiveRacePushSubscription,
    updateLiveRace,
  };
}
/** Typed callable surface returned by {@link createGameFunctionsClient}. */
export type GameFunctionsClient = ReturnType<typeof createGameFunctionsClient>;

/** Callables only the Android app binds; web targets never declare them. */
export function createAndroidAccountFunctions(gameplay: Functions) {
  /** Android never negotiates encrypted transport. */
  const httpsCallable = createCallableFactory({contentProtection: false});
  /** Creates the Global Game Account for an Android Firebase identity. */
  const provisionAndroidAccount = httpsCallable<Record<string, never> | undefined, ProvisionAndroidAccountOutput>(
    gameplay,
    "provisionAndroidAccount",
  );
  return {provisionAndroidAccount};
}
/** Android-only callable surface returned by {@link createAndroidAccountFunctions}. */
export type AndroidAccountFunctions = ReturnType<typeof createAndroidAccountFunctions>;
