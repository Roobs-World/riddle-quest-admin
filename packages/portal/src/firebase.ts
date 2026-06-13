import {initializeApp} from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {getFunctions, httpsCallable} from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const requiredConfig = ["apiKey", "appId", "authDomain", "projectId"] as const;
const missingConfig = requiredConfig.filter((key) => !firebaseConfig[key]);

export const firebaseConfigurationError =
  missingConfig.length > 0 ? `Missing Firebase configuration: ${missingConfig.join(", ")}` : null;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1");

export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);
export const signOutPortal = () => signOut(auth);

export const getPortalOverview = httpsCallable<
  {userLimit?: number; riddleLimit?: number},
  PortalOverview
>(functions, "getAdminPortalOverview");

export const adjustUserCoins = httpsCallable<
  {userId: string; delta: number; reason: string},
  {success: true; newBalance: number}
>(functions, "adjustAdminUserCoins");

export const generateTodaysChallenge = httpsCallable<
  {forceGenerate: boolean},
  {success: boolean; message: string}
>(functions, "generateAdminDailyChallenge");

export const seedLocalizedRiddles = httpsCallable<
  {classicCount: number; forceGenerateDaily: boolean},
  {success: boolean; message: string}
>(functions, "seedLocalizedRiddles");

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

export type PortalOverview = {
  generatedAt: number;
  metrics: {
    userCount: number;
    classicCount: number;
    localizedRiddleCount: number;
    healthyDailyLocales: number;
    localeCount: number;
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
};
