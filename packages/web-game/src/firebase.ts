import {initializeApp} from "firebase/app";
import {getAuth, initializeAuth, inMemoryPersistence} from "firebase/auth";
import {doc, getDoc, getFirestore} from "firebase/firestore/lite";
import {getFunctions} from "firebase/functions";
import {createGameFunctionsClient} from "@riddle-quest/hosted/gameFunctions";
import {firebaseEnvironment} from "./firebaseEnvironment";
import {DEFAULT_GAMEPLAY_REGION} from "./platform/startupWarmup";
export type {CurrentRiddleResponse, GetHintInput, GetHintOutput, SpendCoinsOutput} from "@riddle-quest/hosted/gameFunctions";

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

/** Typed callable surface shared with every Firebase-backed host, bound to this target's regions. */
export const gameFunctions = createGameFunctionsClient({account: functions, gameplay: gameplayFunctions, race: raceFunctions});

/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const createYahooStripeCheckout = gameFunctions.createYahooStripeCheckout;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const confirmYahooStripeCheckout = gameFunctions.confirmYahooStripeCheckout;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const getCurrentDailyChallenge = gameFunctions.getCurrentDailyChallenge;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const getCurrentClassicRiddle = gameFunctions.getCurrentClassicRiddle;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const getClassicRiddleBuffer = gameFunctions.getClassicRiddleBuffer;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const completeGame = gameFunctions.completeGame;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const submitSinglePlayerGuess = gameFunctions.submitSinglePlayerGuess;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const getHint = gameFunctions.getHint;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const spendCoins = gameFunctions.spendCoins;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const skipRiddle = gameFunctions.skipRiddle;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const getLeaderboard = gameFunctions.getLeaderboard;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const updateUsername = gameFunctions.updateUsername;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const updateAvatar = gameFunctions.updateAvatar;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const syncJestAvatar = gameFunctions.syncJestAvatar;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const deleteAccount = gameFunctions.deleteAccount;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const setPresenceConsent = gameFunctions.setPresenceConsent;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const listRaceCategories = gameFunctions.listRaceCategories;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const startRaceRun = gameFunctions.startRaceRun;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const readyRaceRun = gameFunctions.readyRaceRun;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const findRaceMatch = gameFunctions.findRaceMatch;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const submitRaceGuess = gameFunctions.submitRaceGuess;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const requestRaceHint = gameFunctions.requestRaceHint;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const skipRaceRiddle = gameFunctions.skipRaceRiddle;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const resumeRaceRun = gameFunctions.resumeRaceRun;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const abandonRaceRun = gameFunctions.abandonRaceRun;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const publishRaceChallenge = gameFunctions.publishRaceChallenge;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const reserveRaceInvite = gameFunctions.reserveRaceInvite;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const getRaceChallenge = gameFunctions.getRaceChallenge;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const getRaceOutcome = gameFunctions.getRaceOutcome;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const listRaceInbox = gameFunctions.listRaceInbox;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const blockRival = gameFunctions.blockRival;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const reportRival = gameFunctions.reportRival;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const getRaceAccess = gameFunctions.getRaceAccess;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const recordRaceAnalytics = gameFunctions.recordRaceAnalytics;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const getRaceEntry = gameFunctions.getRaceEntry;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const cancelRaceInvite = gameFunctions.cancelRaceInvite;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const joinLiveRace = gameFunctions.joinLiveRace;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const retireLiveRaceJoin = gameFunctions.retireLiveRaceJoin;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const confirmLiveGuessReceipt = gameFunctions.confirmLiveGuessReceipt;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const getLiveRaceChallenge = gameFunctions.getLiveRaceChallenge;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const sendLiveRaceChallenge = gameFunctions.sendLiveRaceChallenge;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const listLiveRaceChallenges = gameFunctions.listLiveRaceChallenges;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const listLiveRaceHistory = gameFunctions.listLiveRaceHistory;
/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const setLiveRacePushSubscription = gameFunctions.setLiveRacePushSubscription;

/** Shared callable bound to this target's Firebase regions; see `@riddle-quest/hosted`. */
export const updateLiveRace = gameFunctions.updateLiveRace;

/** Loads user document. */
export const loadUserDocument = async (userId: string): Promise<Record<string, unknown> | null> => {
  /** Provides snapshot behavior. */
  const snapshot = await getDoc(doc(firebaseFirestore, "users", userId));
  return snapshot.exists() ? snapshot.data() : null;
};
