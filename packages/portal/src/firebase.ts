import {initializeApp} from "firebase/app";
import {initializeAppCheck, ReCaptchaEnterpriseProvider} from "firebase/app-check";
import {getAuth} from "firebase/auth";
import {doc, getDoc, getFirestore} from "firebase/firestore/lite";
import {getFunctions, httpsCallable} from "firebase/functions";
import type {
  CompleteGameInput,
  CompleteGameOutput,
  SkipRiddleResponse,
  SpendCoinsRequest,
} from "@qwordly/core/validation";

const rawFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const firebaseConfig = {
  apiKey: rawFirebaseConfig.apiKey || "missing-api-key",
  appId: rawFirebaseConfig.appId || undefined,
  authDomain: rawFirebaseConfig.authDomain || "missing.firebaseapp.com",
  messagingSenderId: rawFirebaseConfig.messagingSenderId || "0",
  projectId: rawFirebaseConfig.projectId || "missing-project",
};

const app = initializeApp(firebaseConfig);
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
const isHarnessRoute = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("harness");

if (appCheckSiteKey && !isHarnessRoute) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
const firestore = getFirestore(app);
const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1");

export const getCurrentDailyChallenge = httpsCallable<object | undefined, CurrentRiddleResponse>(
  functions,
  "getCurrentDailyChallenge",
);

export const getCurrentClassicRiddle = httpsCallable<{classicIndex: number; locale?: string}, CurrentRiddleResponse>(
  functions,
  "getCurrentClassicRiddle",
);

export const completeGame = httpsCallable<CompleteGameInput, CompleteGameOutput>(functions, "completeGame");

export const getHint = httpsCallable<GetHintInput, GetHintOutput>(functions, "getHint");

export const spendCoins = httpsCallable<SpendCoinsRequest, SpendCoinsOutput>(functions, "spendCoins");

export const skipRiddle = httpsCallable<{riddleId: string; gameMode: "classic" | "challenge"}, SkipRiddleResponse>(
  functions,
  "skipRiddle",
);

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

export const updateUsername = httpsCallable<{username: string}, {success: boolean; message: string}>(
  functions,
  "updateUsername",
);

export const updateAvatar = httpsCallable<
  {imageDataUrl: string},
  {success: true; message: string; avatarUrl: string}
>(functions, "updateAvatar");

export const loadUserDocument = async (userId: string): Promise<Record<string, unknown> | null> => {
  const snapshot = await getDoc(doc(firestore, "users", userId));
  return snapshot.exists() ? snapshot.data() : null;
};

export type CurrentRiddleResponse = {
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
  currentQuestion?: number;
  hasCompletedToday?: boolean;
  questionsCompleted?: number;
  error?: string;
};

type SpendCoinsOutput = {
  newCoins: number;
};

type GetHintInput = {
  currentAttempt: string[];
  riddleId: string;
  gameMode: "classic" | "challenge";
};

type GetHintOutput = {
  revealedLetter: string;
  index: number;
  coinsCost: number;
  newCoins?: number;
  newlyUnlockedAchievementIds?: string[];
} | null;
