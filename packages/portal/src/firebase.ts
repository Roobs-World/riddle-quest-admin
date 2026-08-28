import {initializeApp} from "firebase/app";
import {getAuth} from "firebase/auth";
import {doc, getDoc, getFirestore} from "firebase/firestore/lite";
import {getFunctions, httpsCallable} from "firebase/functions";
import type {
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
  RaceAccessRequest,
  RaceAccessResponse,
  RaceAnalyticsEventRequest,
  RaceAnalyticsEventResponse,
  RaceChallengePreview,
  RaceOutcome,
  RaceRunResponse,
  RequestRaceHintRequest,
  RequestRaceHintResponse,
  SkipRaceRiddleRequest,
  SkipRaceRiddleResponse,
  StartRaceRunRequest,
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
/** Shared Functions instance used by target-specific lazy adapters. */
export const firebaseFunctions = functions;

/** Gets current daily challenge. */
export const getCurrentDailyChallenge = httpsCallable<
  | {
      /** Stores locale. */
      locale?: string;
      /** Stores session token. */
      sessionToken?: string;
      /** Stores riddle id. */
      riddleId?: string;
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
  },
  CurrentRiddleResponse
>(functions, "getCurrentClassicRiddle");

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
    type: "xp" | "totalWins" | "bestStreak"; /** Stores limit. */
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
    success: boolean; /** Stores message. */
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
    success: true; /** Stores message. */
    /** Stores message. */
    message: string; /** Stores avatar url. */
    /** Stores avatar url. */
    avatarUrl: string;
  }
>(functions, "updateAvatar");
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
    success: true; /** Stores enabled. */
    /** Stores enabled. */
    enabled: boolean;
  }
>(functions, "setPresenceConsent");

/** Lists race categories. */
export const listRaceCategories = httpsCallable<ListRaceCategoriesRequest, ListRaceCategoriesResponse>(
  functions,
  "listRaceCategories",
);
/** Starts race run. */
export const startRaceRun = httpsCallable<StartRaceRunRequest, RaceRunResponse>(functions, "startRaceRun");
/** Submits race guess. */
export const submitRaceGuess = httpsCallable<SubmitRaceGuessRequest, SubmitRaceGuessResponse>(
  functions,
  "submitRaceGuess",
);
/** Requests race hint. */
export const requestRaceHint = httpsCallable<RequestRaceHintRequest, RequestRaceHintResponse>(
  functions,
  "requestRaceHint",
);
/** Provides skip race riddle behavior. */
export const skipRaceRiddle = httpsCallable<SkipRaceRiddleRequest, SkipRaceRiddleResponse>(functions, "skipRaceRiddle");
/** Provides resume race run behavior. */
export const resumeRaceRun = httpsCallable<
  {
    /** Stores run id. */
    runId: string;
  },
  RaceRunResponse
>(functions, "resumeRaceRun");
/** Provides abandon race run behavior. */
export const abandonRaceRun = httpsCallable<AbandonRaceRunRequest, AbandonRaceRunResponse>(functions, "abandonRaceRun");
/** Publishes race challenge. */
export const publishRaceChallenge = httpsCallable<PublishRaceChallengeRequest, PublishRaceChallengeResponse>(
  functions,
  "publishRaceChallenge",
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
>(functions, "getRaceChallenge");
/** Gets race outcome. */
export const getRaceOutcome = httpsCallable<
  {
    /** Stores run id. */
    runId: string;
  },
  RaceOutcome
>(functions, "getRaceOutcome");
/** Lists race inbox. */
export const listRaceInbox = httpsCallable<ListRaceInboxRequest | undefined, ListRaceInboxResponse>(
  functions,
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
    targetUserId: string; /** Stores category. */
    /** Stores category. */
    category: import("@qwordly/core/race").SocialReportCategory; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  },
  {
    /** Stores report id. */
    reportId: string; /** Stores queued. */
    /** Stores queued. */
    queued: true;
  }
>(functions, "reportRival");
/** Gets race access. */
export const getRaceAccess = httpsCallable<RaceAccessRequest | undefined, RaceAccessResponse>(
  functions,
  "getRaceAccess",
);
/** Records race analytics. */
export const recordRaceAnalytics = httpsCallable<RaceAnalyticsEventRequest, RaceAnalyticsEventResponse>(
  functions,
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
