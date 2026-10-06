import {readProtectedContent} from "@qwordly/core/contentProtection";
import type {RaceEntryResponse, CancelRaceInviteRequest, RaceLocale} from "@qwordly/core/race";
import {initializeApp} from "firebase/app";
import {getAuth, initializeAuth, inMemoryPersistence} from "firebase/auth";
import {doc, getDoc, getFirestore} from "firebase/firestore/lite";
import {getFunctions, httpsCallable as rawHttpsCallable} from "firebase/functions";
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
import {firebaseEnvironment} from "./firebaseEnvironment";
import {DEFAULT_GAMEPLAY_REGION} from "./platform/startupWarmup";

/** Answer and hint delivery opts into encryption; older backend responses remain readable. */
const protectedEndpoints = new Set(["getCurrentDailyChallenge", "getCurrentClassicRiddle", "getClassicRiddleBuffer",
  "getHint", "skipRiddle", "startRaceRun", "readyRaceRun", "submitRaceGuess", "requestRaceHint", "skipRaceRiddle", "resumeRaceRun"]);
/** Keeps the SDK result contract while decoding only opted-in gameplay transports. */
function httpsCallable<Input = unknown, Output = unknown>(functions: Parameters<typeof rawHttpsCallable>[0], name: string) {
  /** SDK operation bound to its target region. */
  const call = rawHttpsCallable<Input, Output>(functions, name);
  if (!protectedEndpoints.has(name)) return call;
  return async (input?: Input) => {
    /** Encrypted response from a supporting backend, or a legacy plaintext response. */
    const result = await call({...input, contentProtection: 1} as Input);
    return {...result, data: await readProtectedContent(result.data) as Output};
  };
}

/** Provides raw firebase config behavior. */
const rawFirebaseConfig = {
  apiKey: firebaseEnvironment.apiKey,
  appId: firebaseEnvironment.appId,
  authDomain: firebaseEnvironment.authDomain,
  messagingSenderId: firebaseEnvironment.messagingSenderId,
  projectId: firebaseEnvironment.projectId,
  databaseURL: firebaseEnvironment.databaseUrl || undefined,
  measurementId: firebaseEnvironment.measurementId,
};

/** Provides firebase config behavior. */
const firebaseConfig = {
  apiKey: rawFirebaseConfig.apiKey || "missing-api-key",
  appId: rawFirebaseConfig.appId || undefined,
  authDomain: rawFirebaseConfig.authDomain || "missing.firebaseapp.com",
  messagingSenderId: rawFirebaseConfig.messagingSenderId || "0",
  projectId: rawFirebaseConfig.projectId || "missing-project",
  measurementId: rawFirebaseConfig.measurementId || undefined,
};

/** Provides firebase app behavior. */
export const firebaseApp = initializeApp(firebaseConfig);

/** Provides auth behavior. */
// Jest signs each SDK player into Firebase on every launch. Keep that identity
// inside its frame so another tab cannot replace its authority or saved profile.
export const auth = firebaseEnvironment.platformTarget === "jest"
  ? initializeAuth(firebaseApp, {persistence: inMemoryPersistence})
  : getAuth(firebaseApp);
/** Provides firestore behavior. */
export const firebaseFirestore = getFirestore(firebaseApp);
/** Provides functions behavior. */
const functions = getFunctions(firebaseApp, firebaseEnvironment.functionsRegion || "us-central1");
/** Multiplayer on every target runs beside eur3; other capabilities retain their configured region. */
const raceFunctions = getFunctions(firebaseApp, DEFAULT_GAMEPLAY_REGION);
/** Solo on every target runs beside eur3; the explicit region override permits rollback. */
const gameplayFunctions = getFunctions(firebaseApp, firebaseEnvironment.gameplayRegion || DEFAULT_GAMEPLAY_REGION);
/** Shared Functions instance used by target-specific lazy adapters. */
export const firebaseFunctions = functions;

/** Creates a server-authorized Stripe Checkout Session for Yahoo. */
export const createYahooStripeCheckout = httpsCallable<
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
>(functions, "createYahooStripeCheckout");

/** Confirms and idempotently grants a paid Yahoo Stripe Checkout Session. */
export const confirmYahooStripeCheckout = httpsCallable<
  {
    /** Stores session id. */
    sessionId: string;
  },
  {
    /** Stores coins. */
    coins: number;
  }
>(functions, "confirmYahooStripeCheckout");

/** Gets current daily challenge. */
export const getCurrentDailyChallenge = httpsCallable<
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
>(gameplayFunctions, "getCurrentDailyChallenge");

/** Gets current classic riddle. */
export const getCurrentClassicRiddle = httpsCallable<
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
>(gameplayFunctions, "getCurrentClassicRiddle");

/** Issues the current Classic question and up to three future questions. */
export const getClassicRiddleBuffer = httpsCallable<
  {
    /** Requested content locale. */
    locale: string;
    /** Requests authoritative purchased hint recovery. */
    includeHintRecovery?: boolean;
    /** Opts in to authoritative accepted guess recovery. */
    includeGuessRecovery?: boolean;
  },
  ClassicRiddleBufferResponse
>(gameplayFunctions, "getClassicRiddleBuffer");

/** Completes game. */
export const completeGame = httpsCallable<CompleteGameInput, CompleteGameOutput>(gameplayFunctions, "completeGame");

/** Submits one server-authoritative single-player guess. */
export const submitSinglePlayerGuess = httpsCallable<SubmitSinglePlayerGuessInput, SubmitSinglePlayerGuessOutput>(
  gameplayFunctions,
  "submitSinglePlayerGuess",
);

/** Gets hint. */
export const getHint = httpsCallable<GetHintInput, GetHintOutput>(gameplayFunctions, "getHint");

/** Provides spend coins behavior. */
export const spendCoins = httpsCallable<SpendCoinsRequest, SpendCoinsOutput>(gameplayFunctions, "spendCoins");

/** Provides skip riddle behavior. */
export const skipRiddle = httpsCallable<
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
>(gameplayFunctions, "skipRiddle");

/** Gets leaderboard. */
export const getLeaderboard = httpsCallable<
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
>(functions, "getLeaderboard");

/** Updates username. */
export const updateUsername = httpsCallable<
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
>(functions, "updateUsername");

/** Updates avatar. */
export const updateAvatar = httpsCallable<
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
>(functions, "updateAvatar");
/** Fills an empty Jest game profile avatar from the platform profile. */
export const syncJestAvatar = httpsCallable<
  {
    /** Stores avatar url. */
    avatarUrl: string;
  },
  {
    /** Stores avatar url. */
    avatarUrl: string;
  }
>(functions, "syncJestAvatar");
/** Deletes account. */
export const deleteAccount = httpsCallable<
  Record<string, never>,
  {
    /** Stores success. */
    success: true;
  }
>(functions, "deleteAccount");
/** Changes server-owned presence consent for the current authenticated account. */
export const setPresenceConsent = httpsCallable<
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
>(functions, "setPresenceConsent");

/** Lists race categories. */
export const listRaceCategories = httpsCallable<ListRaceCategoriesRequest, ListRaceCategoriesResponse>(
  raceFunctions,
  "listRaceCategories",
);
/** Starts race run. */
export const startRaceRun = httpsCallable<StartRaceRunRequest, RaceRunResponse>(raceFunctions, "startRaceRun");
/** Schedules an owned prepared run with a server-controlled countdown. */
export const readyRaceRun = httpsCallable<ReadyRaceRunRequest, RaceRunResponse>(raceFunctions, "readyRaceRun");
/** Provider scope comes from authenticated Firebase identity, never from matchmaking preferences. */
export const findRaceMatch = httpsCallable<RaceMatchRequest, RaceMatchResponse>(raceFunctions, "findRaceMatch");
/** Submits race guess. */
export const submitRaceGuess = httpsCallable<SubmitRaceGuessRequest, SubmitRaceGuessResponse>(
  raceFunctions,
  "submitRaceGuess",
);
/** Requests race hint. */
export const requestRaceHint = httpsCallable<RequestRaceHintRequest, RequestRaceHintResponse>(
  raceFunctions,
  "requestRaceHint",
);
/** Provides skip race riddle behavior. */
export const skipRaceRiddle = httpsCallable<SkipRaceRiddleRequest, SkipRaceRiddleResponse>(raceFunctions, "skipRaceRiddle");
/** Provides resume race run behavior. */
export const resumeRaceRun = httpsCallable<
  {
    /** Stores run id. */
    runId: string;
    /** Requests current-question local scoring data. */
    includeEvaluation?: boolean;
    /** Requests bounded confirmed presentation rows after reload. */
    includeGuessHistory?: boolean;
  },
  RaceRunResponse
>(raceFunctions, "resumeRaceRun");
/** Provides abandon race run behavior. */
export const abandonRaceRun = httpsCallable<AbandonRaceRunRequest, AbandonRaceRunResponse>(raceFunctions, "abandonRaceRun");
/** Publishes race challenge. */
export const publishRaceChallenge = httpsCallable<PublishRaceChallengeRequest, PublishRaceChallengeResponse>(
  raceFunctions,
  "publishRaceChallenge",
);
/** Reserves a server-owned two-player lobby before opening a Jest invite. */
export const reserveRaceInvite = httpsCallable<ReserveRaceInviteRequest, ReserveRaceInviteResponse>(
  raceFunctions,
  "reserveRaceInvite",
);
/** Gets race challenge. */
export const getRaceChallenge = httpsCallable<
  {
    /** Stores challenge id. */
    challengeId: string;
    /** Stores locale. */
    locale: import("@qwordly/core/race").RaceLocale;
  },
  RaceChallengePreview
>(raceFunctions, "getRaceChallenge");
/** Gets race outcome. */
export const getRaceOutcome = httpsCallable<
  {
    /** Stores run id. */
    runId: string;
  },
  RaceOutcome
>(raceFunctions, "getRaceOutcome");
/** Lists race inbox. */
export const listRaceInbox = httpsCallable<ListRaceInboxRequest | undefined, ListRaceInboxResponse>(
  raceFunctions,
  "listRaceInbox",
);
/** Immediately blocks an established social rival. */
export const blockRival = httpsCallable<import("@qwordly/core/race").BlockSocialRivalRequest, {
  /** Confirmed block status. */
  blocked: true;
}>(functions, "blockRival");
/** Queues a categorized known-rival or private live-opponent report. */
export const reportRival = httpsCallable<import("@qwordly/core/race").ReportSocialRivalRequest,
  {
    /** Opaque server queue receipt. */
    reportId: string;
    /** Queue acknowledgement. */
    queued: true;
  }>(functions, "reportRival");
/** Gets race access. */
export const getRaceAccess = httpsCallable<RaceAccessRequest | undefined, RaceAccessResponse>(
  raceFunctions,
  "getRaceAccess",
);
/** Records race analytics. */
export const recordRaceAnalytics = httpsCallable<RaceAnalyticsEventRequest, RaceAnalyticsEventResponse>(
  raceFunctions,
  "recordRaceAnalytics",
);

/** Loads user document. */
export const loadUserDocument = async (userId: string): Promise<Record<string, unknown> | null> => {
  /** Provides snapshot behavior. */
  const snapshot = await getDoc(doc(firebaseFirestore, "users", userId));
  return snapshot.exists() ? snapshot.data() : null;
};

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
type SpendCoinsOutput = {
  /** Stores new coins. */
  newCoins: number;
};

/** Describes get hint input. */
type GetHintInput = {
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
type GetHintOutput = {
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

/** Reads lifecycle-aware readiness for public recordings and private reservations. */
export const getRaceEntry = httpsCallable<{
    /** Incoming challenge. */ challengeId: string;
    /** Content language. */ locale: RaceLocale;
    /** Negotiates the viewer role without changing legacy responses. */ includeViewerRole?: boolean;
    /** Requests the authenticated recipient's previously accepted run pointer for recovery. */
    includeExistingAttempt?: boolean}, RaceEntryResponse>(raceFunctions, "getRaceEntry");
/** Cancels only a creator-owned reservation, preserving reusable public challenges. */
export const cancelRaceInvite = httpsCallable<CancelRaceInviteRequest, RaceEntryResponse>(raceFunctions, "cancelRaceInvite");

/** Authenticated live matchmaking and input transports. */
export const joinLiveRace = httpsCallable<import("@qwordly/core/race").JoinLiveRace, import("@qwordly/core/race").LiveRaceView>(raceFunctions, "joinLiveRace");
/** Retires a stable account-owned join without cancelling a newer recovered seat. */
export const retireLiveRaceJoin = httpsCallable<import("@qwordly/core/race").RetireLiveRaceJoin, import("@qwordly/core/race").RetireLiveRaceJoinResponse>(raceFunctions, "retireLiveRaceJoin");
/** Reads live progress and commits idempotent commands. */
export const updateLiveRace = rawHttpsCallable<import("@qwordly/core/race").UpdateLiveRace, import("@qwordly/core/race").LiveRaceView, {
  /** Private wake-up notification received through the same authenticated endpoint. */
  revision: string | null;
}>(raceFunctions, "updateLiveRace");

/** Reads a server-validated private PvP invitation from platform entry data. */
export const getLiveRaceChallenge = httpsCallable<{
  /** Server invitation handle. */
  challengeId: string;
}, import("@qwordly/core/race").LiveRaceChallenge>(raceFunctions, "getLiveRaceChallenge");

/** Addresses an existing player and queues a server-owned offline notification. */
export const sendLiveRaceChallenge = httpsCallable<{
  /** Creator-owned private lobby. */ challengeId: string;
  /** Server-resolved existing game username. */ recipientUsername: string;
}, {/** Durable work receipt, not provider delivery. */ /** Stores status. */
/** Stores status. */
status: "queued"}>(raceFunctions, "sendLiveRaceChallenge");
/** Reads direct challenge notices without accepting their lobby. */
export const listLiveRaceChallenges = httpsCallable<Record<string, never>, import("@qwordly/core/race").LiveRaceChallenge[]>(raceFunctions, "listLiveRaceChallenges");
/** Locale-bound retained results never include another account or answer-bearing run. */
export const listLiveRaceHistory = httpsCallable<import("@qwordly/core/race").ListLiveRaceHistoryRequest, import("@qwordly/core/race").ListLiveRaceHistoryResponse>(raceFunctions, "listLiveRaceHistory");
/** Stores explicit browser-push consent on the authenticated registered Jest account. */
export const setLiveRacePushSubscription = httpsCallable<{
  /** False revokes the current subscription. */ enabled: boolean;
  /** Opaque browser instance token; never a recipient identity. */ token?: string;
}, {/** Committed preference. */ /** Stores enabled. */
/** Stores enabled. */
enabled: boolean}>(raceFunctions, "setLiveRacePushSubscription");
