import {initializeApp} from "firebase/app";
import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  setTokenAutoRefreshEnabled,
  type AppCheck,
} from "firebase/app-check";
import {getAuth} from "firebase/auth";
import {doc, getDoc, getFirestore} from "firebase/firestore/lite";
import {getFunctions, httpsCallable} from "firebase/functions";
import type {
  CompleteGameInput,
  CompleteGameOutput,
  SkipRiddleResponse,
  SpendCoinsRequest,
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
import {parseNotificationCopyDocument, type NotificationCopy} from "./jest/notifications/copy";
import {firebaseEnvironment} from "./firebaseEnvironment";

/** Provides raw firebase config behavior. */
const rawFirebaseConfig = {
  apiKey: firebaseEnvironment.apiKey,
  appId: firebaseEnvironment.appId,
  authDomain: firebaseEnvironment.authDomain,
  messagingSenderId: firebaseEnvironment.messagingSenderId,
  projectId: firebaseEnvironment.projectId,
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
/** Provides app check site key behavior. */
const appCheckSiteKey = firebaseEnvironment.appCheckSiteKey;
/** Indicates whether is harness route. */
const isHarnessRoute = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("harness");
/** Provides app check behavior. */
let appCheck: AppCheck | null = null;

if (appCheckSiteKey && !isHarnessRoute) {
  appCheck = initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: false,
  });
}

/**
 * Waits for browser attestation before protected Firebase resources are used.
 *
 * Firebase Functions reject requests without App Check in production, so Jest
 * startup must not expose the playable game until an attestation token exists.
 */
export async function ensureFirebaseAppCheckReady(): Promise<void> {
  if (!appCheck) {
    if (firebaseEnvironment.production && firebaseEnvironment.jestRuntime === "1" && !isHarnessRoute) {
      throw new Error("Firebase App Check is not configured for the Jest build.");
    }
    return;
  }
  await getToken(appCheck);
  setTokenAutoRefreshEnabled(appCheck, true);
}

/** Provides auth behavior. */
export const auth = getAuth(firebaseApp);
/** Provides firestore behavior. */
const firestore = getFirestore(firebaseApp);
/** Provides functions behavior. */
const functions = getFunctions(firebaseApp, firebaseEnvironment.functionsRegion || "us-central1");

/** Gets current daily challenge. */
export const getCurrentDailyChallenge = httpsCallable<object | undefined, CurrentRiddleResponse>(
  functions,
  "getCurrentDailyChallenge",
);

/** Gets current classic riddle. */
export const getCurrentClassicRiddle = httpsCallable<{classicIndex: number; locale?: string}, CurrentRiddleResponse>(
  functions,
  "getCurrentClassicRiddle",
);

/** Completes game. */
export const completeGame = httpsCallable<CompleteGameInput, CompleteGameOutput>(functions, "completeGame");

/** Gets hint. */
export const getHint = httpsCallable<GetHintInput, GetHintOutput>(functions, "getHint");

/** Provides spend coins behavior. */
export const spendCoins = httpsCallable<SpendCoinsRequest, SpendCoinsOutput>(functions, "spendCoins");

/** Provides skip riddle behavior. */
export const skipRiddle = httpsCallable<{riddleId: string; gameMode: "classic" | "challenge"}, SkipRiddleResponse>(
  functions,
  "skipRiddle",
);

/** Gets leaderboard. */
export const getLeaderboard = httpsCallable<
  {type: "xp" | "totalWins" | "bestStreak"; limit?: number},
  {
    entries: Array<{
      userId: string;
      username: string;
      avatarUrl?: string;
      level: number;
      xp: number;
      totalWins: number;
      bestStreak: number;
    }>;
    requestingUserId: string;
  }
>(functions, "getLeaderboard");

/** Updates username. */
export const updateUsername = httpsCallable<{username: string}, {success: boolean; message: string}>(
  functions,
  "updateUsername",
);

/** Updates avatar. */
export const updateAvatar = httpsCallable<{imageDataUrl: string}, {success: true; message: string; avatarUrl: string}>(
  functions,
  "updateAvatar",
);
/** Deletes account. */
export const deleteAccount = httpsCallable<Record<string, never>, {success: true}>(functions, "deleteAccount");

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
export const resumeRaceRun = httpsCallable<{runId: string}, RaceRunResponse>(functions, "resumeRaceRun");
/** Provides abandon race run behavior. */
export const abandonRaceRun = httpsCallable<AbandonRaceRunRequest, AbandonRaceRunResponse>(functions, "abandonRaceRun");
/** Publishes race challenge. */
export const publishRaceChallenge = httpsCallable<PublishRaceChallengeRequest, PublishRaceChallengeResponse>(
  functions,
  "publishRaceChallenge",
);
/** Gets race challenge. */
export const getRaceChallenge = httpsCallable<{challengeId: string}, RaceChallengePreview>(
  functions,
  "getRaceChallenge",
);
/** Gets race outcome. */
export const getRaceOutcome = httpsCallable<{runId: string}, RaceOutcome>(functions, "getRaceOutcome");
/** Lists race inbox. */
export const listRaceInbox = httpsCallable<ListRaceInboxRequest | undefined, ListRaceInboxResponse>(
  functions,
  "listRaceInbox",
);
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
  const snapshot = await getDoc(doc(firestore, "users", userId));
  return snapshot.exists() ? snapshot.data() : null;
};

/** Loads notification copy. */
export const loadNotificationCopy = async (locale: string): Promise<NotificationCopy> => {
  const snapshot = await getDoc(doc(firestore, "config", "notifications"));
  if (!snapshot.exists()) throw new Error("Firestore notification copy is not configured.");
  return parseNotificationCopyDocument(snapshot.data(), locale);
};

/** Describes current riddle response. */
export type CurrentRiddleResponse = {
  /** Stores challenge. */
  challenge?: {
    date?: string;
    questions: Array<{
      riddleId: string;
      text: string;
      answer: string;
      questionNumber: number;
    }>;
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
  /** Stores game mode. */
  gameMode: "classic" | "challenge";
};

/** Describes get hint output. */
type GetHintOutput = {
  revealedLetter: string;
  index: number;
  coinsCost: number;
  newCoins?: number;
  newlyUnlockedAchievementIds?: string[];
} | null;
