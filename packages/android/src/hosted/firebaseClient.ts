import AsyncStorage from "@react-native-async-storage/async-storage";
import {initializeApp, type FirebaseApp} from "firebase/app";
import {
  connectAuthEmulator,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import {connectFunctionsEmulator, getFunctions, httpsCallable, type Functions} from "firebase/functions";
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
  /** Current Firebase user or `null`. */
  currentUser(): User | null;
  /** Subscribes to sign-in changes. */
  onUserChanged(listener: (user: User | null) => void): () => void;
  /** Signs in anonymously, reusing the persisted session when one exists. */
  signInAnonymously(): Promise<User>;
  /** Creates or confirms the Global Game Account for the signed-in user. */
  provisionAccount(): Promise<ProvisionedAccount>;
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
 * targeting the local emulators. App Check attestation is added in Phase 1.7.
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
  /** Auth with the device-private persisted session. */
  const auth: Auth = initializeAuth(app, {persistence: getReactNativePersistence(storage)});
  /** Account callables. */
  const accountFunctions: Functions = getFunctions(app, config.firebase.functionsRegion);
  /** Solo gameplay callables, kept separate so the region can differ. */
  const gameplayFunctions: Functions = getFunctions(app, config.firebase.gameplayRegion);
  if (config.emulators) {
    connectAuthEmulator(auth, `http://${config.emulators.host}:${config.emulators.authPort}`, {disableWarnings: true});
    connectFunctionsEmulator(accountFunctions, config.emulators.host, config.emulators.functionsPort);
    connectFunctionsEmulator(gameplayFunctions, config.emulators.host, config.emulators.functionsPort);
  }
  /** Account provisioning callable; it runs beside the gameplay region. */
  const provision = httpsCallable<undefined, unknown>(gameplayFunctions, "provisionAndroidAccount");
  return {
    projectId: config.firebase.projectId,
    usingEmulators: config.emulators !== null,
    currentUser: () => auth.currentUser,
    onUserChanged: (listener) => onAuthStateChanged(auth, listener),
    /** Reuses the persisted anonymous session before creating a new one. */
    async signInAnonymously() {
      if (auth.currentUser) return auth.currentUser;
      return (await signInAnonymously(auth)).user;
    },
    /** Provisions the account and validates the response shape. */
    async provisionAccount() {
      /** Raw callable response. */
      const {data} = await provision();
      if (!isProvisionedAccount(data)) throw new Error("provision-response-invalid");
      return data;
    },
  };
}
