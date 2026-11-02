import AsyncStorage from "@react-native-async-storage/async-storage";
import {initializeApp, type FirebaseApp} from "firebase/app";
import {
  connectAuthEmulator,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import {connectFirestoreEmulator, doc, getDoc, getFirestore, type Firestore} from "firebase/firestore/lite";
import {connectFunctionsEmulator, getFunctions, type Functions} from "firebase/functions";
import {createAndroidAccountFunctions, createGameFunctionsClient, type GameFunctionsClient} from "@riddle-quest/hosted";
import type {AndroidPurchaseBackend} from "../billing/androidCommerce";
import {enableAndroidAppCheck} from "./appCheck";
import type {HostedConfig} from "./hostedConfig";
/** Response of the backend `provisionAndroidAccount` callable. */
export type ProvisionedAccount = Readonly<{
  /** Firebase uid owning the Global Game Account. */
  uid: string;
  /** Whether this call created the account. */
  created: boolean;
  /** Confirmed coin balance. */
  coins: number;
}>;
/** Minimal Firebase surface the hosted screens depend on, so tests can substitute it. */
export type HostedFirebaseClient = Readonly<{
  /** Public project id, shown on the account screen. */
  projectId: string;
  /** Whether calls go to local emulators. */
  usingEmulators: boolean;
  /** Typed game backend callables bound to this client's regions. */
  functions: GameFunctionsClient;
  /** Current Firebase user or `null`. */
  currentUser(): User | null;
  /** Subscribes to sign-in changes. */
  onUserChanged(listener: (user: User | null) => void): () => void;
  /** Signs in anonymously, reusing the persisted session when one exists. */
  signInAnonymously(): Promise<User>;
  /** Signs the device out. */
  signOut(): Promise<void>;
  /** Reads the authoritative account document, or `null` when absent. */
  loadUserDocument(userId: string): Promise<Record<string, unknown> | null>;
  /** Creates or confirms the Global Game Account for the signed-in user. */
  provisionAccount(): Promise<ProvisionedAccount>;
  /** Server-authoritative Google Play purchase callables. */
  purchases: AndroidPurchaseBackend;
}>;
/** Whether a provisioning response has the expected shape. */
const isProvisionedAccount = (value: unknown): value is ProvisionedAccount =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ProvisionedAccount).uid === "string" &&
  typeof (value as ProvisionedAccount).created === "boolean" &&
  typeof (value as ProvisionedAccount).coins === "number";
/**
 * Creates the Firebase client for hosted play.
 *
 * @remarks
 * The same Firebase project and callables serve the Jest Web Target; this
 * client differs only in auth persistence (AsyncStorage) and in optionally
 * targeting the local emulators. Outside the emulators App Check attests the
 * device with Play Integrity (`appCheck.ts`).
 */
export function createHostedFirebaseClient(config: HostedConfig, storage = AsyncStorage): HostedFirebaseClient {
  /** Firebase app bound to the public project config. */
  const app: FirebaseApp = initializeApp({
    apiKey: config.firebase.apiKey,
    appId: config.firebase.appId,
    authDomain: config.firebase.authDomain,
    messagingSenderId: config.firebase.messagingSenderId,
    projectId: config.firebase.projectId,
  });
  // Production callables enforce App Check; attest with Play Integrity before the first call.
  enableAndroidAppCheck(app, config);
  /** Auth with the device-private persisted session. */
  const auth: Auth = initializeAuth(app, {persistence: getReactNativePersistence(storage)});
  /** Account callables. */
  const accountFunctions: Functions = getFunctions(app, config.firebase.functionsRegion);
  /** Solo gameplay callables, kept separate so the region can differ. */
  const gameplayFunctions: Functions = getFunctions(app, config.firebase.gameplayRegion);
  /** Account document reads use the lightweight REST Firestore client. */
  const firestore: Firestore = getFirestore(app);
  if (config.emulators) {
    connectAuthEmulator(auth, `http://${config.emulators.host}:${config.emulators.authPort}`, {disableWarnings: true});
    connectFunctionsEmulator(accountFunctions, config.emulators.host, config.emulators.functionsPort);
    connectFunctionsEmulator(gameplayFunctions, config.emulators.host, config.emulators.functionsPort);
    connectFirestoreEmulator(firestore, config.emulators.host, config.emulators.firestorePort);
  }
  /** Shared typed callable surface; multiplayer runs beside solo gameplay. */
  const gameFunctions = createGameFunctionsClient(
    {account: accountFunctions, gameplay: gameplayFunctions, race: gameplayFunctions},
    {contentProtection: false},
  );
  /** Android-only account provisioning. */
  const androidFunctions = createAndroidAccountFunctions(gameplayFunctions);
  return {
    projectId: config.firebase.projectId,
    usingEmulators: config.emulators !== null,
    functions: gameFunctions,
    currentUser: () => auth.currentUser,
    onUserChanged: (listener) => onAuthStateChanged(auth, listener),
    /** Reuses the persisted anonymous session before creating a new one. */
    async signInAnonymously() {
      if (auth.currentUser) return auth.currentUser;
      return (await signInAnonymously(auth)).user;
    },
    /** Signs out through the SDK; the next launch provisions a fresh anonymous account. */
    signOut: () => firebaseSignOut(auth),
    /** Reads the account document the backend maintains. */
    async loadUserDocument(userId) {
      /** Document snapshot. */
      const snapshot = await getDoc(doc(firestore, "users", userId));
      return snapshot.exists() ? snapshot.data() : null;
    },
    /** Provisions the account and validates the response shape. */
    async provisionAccount() {
      /** Raw callable response. */
      const {data} = await androidFunctions.provisionAndroidAccount();
      if (!isProvisionedAccount(data)) throw new Error("provision-response-invalid");
      return data;
    },
    purchases: {
      grant: async (input) => (await androidFunctions.grantAndroidPurchase(input)).data,
      syncSubscriptions: async (purchaseTokens) => (await androidFunctions.syncAndroidSubscriptions({purchaseTokens})).data,
    },
  };
}
