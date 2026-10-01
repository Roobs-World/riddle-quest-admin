import type {RaceEntryResponse, CancelRaceInviteRequest, RaceLocale} from "@qwordly/core/race";
import {initializeApp} from "firebase/app";
import {getAuth} from "firebase/auth";
import {doc, getDoc, getFirestore} from "firebase/firestore/lite";
import {getFunctions, httpsCallable} from "firebase/functions";
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
export const auth = getAuth(firebaseApp);
/** Provides firestore behavior. */
export const firebaseFirestore = getFirestore(firebaseApp);
/** Provides functions behavior. */
const functions = getFunctions(firebaseApp, firebaseEnvironment.functionsRegion || "us-central1");
/** Jest multiplayer runs beside eur3; other capabilities retain their configured region. */
const raceFunctions = firebaseEnvironment.platformTarget === "jest"
  ? getFunctions(firebaseApp, "europe-west1") : functions;
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
    }
  | undefined,
  CurrentRiddleResponse
>(functions, "getCurrentDailyChallenge");

/** Gets current classic riddle. */
export const getCurrentClassicRiddle = httpsCallable<
  {
    /** Stores classic index. */
    classicIndex: number;
    /** Stores locale. */
    locale?: string;
    /** Stores session token. */
    sessionToken?: string;
    /** Stores riddle id. */
    riddleId?: string;
    /** Requests presentation-only scoring data for immediate feedback. */
    includeEvaluation?: boolean;
  },
  CurrentRiddleResponse
>(functions, "getCurrentClassicRiddle");

/** Issues the current Classic question and up to two future questions. */
export const getClassicRiddleBuffer = httpsCallable<
  {
    /** Requested content locale. */
    locale: string;
  },
  ClassicRiddleBufferResponse
>(functions, "getClassicRiddleBuffer");

/** Completes game. */
export const completeGame = httpsCallable<CompleteGameInput, CompleteGameOutput>(functions, "completeGame");

/** Submits one server-authoritative single-player guess. */
export const submitSinglePlayerGuess = httpsCallable<SubmitSinglePlayerGuessInput, SubmitSinglePlayerGuessOutput>(
  functions,
  "submitSinglePlayerGuess",
);

/** Gets hint. */
export const getHint = httpsCallable<GetHintInput, GetHintOutput>(functions, "getHint");

/** Provides spend coins behavior. */
export const spendCoins = httpsCallable<SpendCoinsRequest, SpendCoinsOutput>(functions, "spendCoins");

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
>(functions, "skipRiddle");

/** Gets leaderboard. */
export const getLeaderboard = httpsCallable<
  {
    /** Stores type. */
    type: "xp" | "totalWins" | "bestStreak";
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
export const blockRival = httpsCallable<
  {
    /** Stores target user id. */
    targetUserId: string;
  },
  {
    /** Stores blocked. */
    blocked: true;
  }
>(functions, "blockRival");
/** Queues an idempotent categorized report for an established social rival. */
export const reportRival = httpsCallable<
  {
    /** Stores target user id. */
    targetUserId: string;
    /** Stores category. */
    /** Stores category. */
    category: import("@qwordly/core/race").SocialReportCategory;
    /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  },
  {
    /** Stores report id. */
    reportId: string;
    /** Stores queued. */
    /** Stores queued. */
    queued: true;
  }
>(functions, "reportRival");
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
    /** Content language. */ locale: RaceLocale}, RaceEntryResponse>(raceFunctions, "getRaceEntry");
/** Cancels only a creator-owned reservation, preserving reusable public challenges. */
export const cancelRaceInvite = httpsCallable<CancelRaceInviteRequest, RaceEntryResponse>(raceFunctions, "cancelRaceInvite");
