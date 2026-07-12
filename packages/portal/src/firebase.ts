import {initializeApp} from "firebase/app";
import {initializeAppCheck, ReCaptchaEnterpriseProvider} from "firebase/app-check";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {doc, getDoc, getFirestore} from "firebase/firestore/lite";
import {getFunctions, httpsCallable} from "firebase/functions";
import type {
  AwardedAdCallbackResponse,
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
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const requiredConfig = ["apiKey", "authDomain", "projectId"] as const;
const missingConfig = requiredConfig.filter((key) => !rawFirebaseConfig[key]);

export const firebaseConfigurationError =
  missingConfig.length > 0 ? `Missing Firebase configuration: ${missingConfig.join(", ")}` : null;

const firebaseConfig = {
  apiKey: rawFirebaseConfig.apiKey || "missing-api-key",
  appId: rawFirebaseConfig.appId || undefined,
  authDomain: rawFirebaseConfig.authDomain || "missing.firebaseapp.com",
  messagingSenderId: rawFirebaseConfig.messagingSenderId || "0",
  projectId: rawFirebaseConfig.projectId || "missing-project",
  storageBucket: rawFirebaseConfig.storageBucket || "missing-project.appspot.com",
};

export const app = initializeApp(firebaseConfig);
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
const isHarnessRoute =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("harness");

if (appCheckSiteKey && !isHarnessRoute) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1");

export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signInWithFacebook = () => signInWithPopup(auth, new FacebookAuthProvider());
export const signInAsGuest = () => signInAnonymously(auth);
export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);
export const signOutPortal = () => signOut(auth);
export const subscribeToPortalAuth = (listener: (user: import("firebase/auth").User | null) => void) =>
  onAuthStateChanged(auth, listener);

export type AdminCallableAuth = {
  clerkToken?: string;
};

export const getPortalOverview = httpsCallable<
  AdminCallableAuth & {userLimit?: number; riddleLimit?: number; auditLimit?: number; leaderboardLimit?: number},
  PortalOverview
>(functions, "getAdminPortalOverview");

export const adjustUserCoins = httpsCallable<
  AdminCallableAuth & {userId: string; delta: number; reason: string},
  {success: true; newBalance: number}
>(functions, "adjustAdminUserCoins");

export const generateTodaysChallenge = httpsCallable<
  AdminCallableAuth & {forceGenerate: boolean},
  {success: boolean; message: string}
>(functions, "generateAdminDailyChallenge");

export const seedLocalizedRiddles = httpsCallable<
  AdminCallableAuth & {classicCount: number; forceGenerateDaily: boolean},
  {success: boolean; message: string}
>(functions, "seedLocalizedRiddles");

export const getCurrentDailyChallenge = httpsCallable<
  object | undefined,
  CurrentRiddleResponse
>(functions, "getCurrentDailyChallenge");

export const getCurrentClassicRiddle = httpsCallable<
  {classicIndex: number; locale?: string},
  CurrentRiddleResponse
>(functions, "getCurrentClassicRiddle");

export const completeGame = httpsCallable<CompleteGameInput, CompleteGameOutput>(functions, "completeGame");

export const getHint = httpsCallable<GetHintInput, GetHintOutput>(functions, "getHint");

export const spendCoins = httpsCallable<SpendCoinsRequest, SpendCoinsOutput>(functions, "spendCoins");

export const skipRiddle = httpsCallable<
  {riddleId: string; gameMode: "classic" | "challenge"},
  SkipRiddleResponse
>(functions, "skipRiddle");

export const getLeaderboard = httpsCallable<
  {type: "xp" | "totalWins" | "bestStreak"; limit?: number},
  {
    entries: Array<{
      userId: string;
      username: string;
      level: number;
      xp: number;
      totalWins: number;
      bestStreak: number;
    }>;
    requestingUserId: string;
  }
>(functions, "getLeaderboard");

export const updateUsername = httpsCallable<
  {username: string},
  {success: boolean; message: string}
>(functions, "updateUsername");

export const awardedAdCallback = httpsCallable<
  {userId: string; placement: "loss_continue" | "coin_shop"; callbackId: string; provider: string},
  AwardedAdCallbackResponse
>(functions, "awardedAdCallback");

export const loadUserDocument = async (userId: string): Promise<Record<string, unknown> | null> => {
  const snapshot = await getDoc(doc(firestore, "users", userId));
  return snapshot.exists() ? snapshot.data() : null;
};

export type PortalUser = {
  userId: string;
  username: string;
  email: string;
  coins: number;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  classicIndex: number;
  preferredLanguage: string;
  lastLogin: number | null;
};

export type PortalRiddle = {
  riddleId: string;
  text: string;
  answer: string;
  locale: string;
  category: string;
  index: number | null;
  challengeKey: string | null;
};

export type PortalLeaderboardEntry = {
  userId: string;
  username: string;
  level: number;
  xp: number;
  totalWins: number;
  bestStreak: number;
  updatedAt: number | null;
};

export type PortalAuditEvent = {
  auditId: string;
  action: string;
  adminUserId: string;
  targetUserId: string;
  delta: number | null;
  previousBalance: number | null;
  newBalance: number | null;
  reason: string;
  createdAt: number | null;
};

export type PortalOverview = {
  generatedAt: number;
  metrics: {
    userCount: number;
    classicCount: number;
    localizedRiddleCount: number;
    healthyDailyLocales: number;
    localeCount: number;
    activeUsersLoaded?: number;
    totalCoinsLoaded?: number;
    auditEventsLoaded?: number;
  };
  users: PortalUser[];
  riddles: PortalRiddle[];
  localizedCounts: Array<{locale: string; count: number}>;
  dailyByLocale: Array<{
    locale: string;
    available: boolean;
    challengeKey: string | null;
    text: string | null;
  }>;
  auditLog?: PortalAuditEvent[];
  leaderboard?: Record<"xp" | "totalWins" | "bestStreak", PortalLeaderboardEntry[]>;
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
