import {clearAndroidNotificationAccount} from "../notifications/androidNotifications";
import type {GoogleAccountChange} from "../auth/androidGoogleIdentity";
import type {AndroidGoogleIdentity} from "../auth/androidGoogleIdentity";
import {createFirebaseGoogleIdentity} from "../auth/firebaseGoogleIdentity";
import {clearGoogleCredentialState} from "../auth/googleCredentials";
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
import {connectFunctionsEmulator, getFunctions, httpsCallable, type Functions} from "firebase/functions";
import {createGameFunctionsClient, type GameFunctionsClient} from "../../../../../src/platform/firebase/gameFunctions";
import {createAndroidAccountFunctions} from "./androidAccountFunctions";
import type {AndroidReferralBackend, AndroidReferralStatus, AndroidReferralToken, AndroidReferralBinding} from "../referrals/androidReferrals";
import type {AndroidNotificationBackend} from "../notifications/androidNotificationController";
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
  /** Explicit native FCM consent and registration. */
  notifications?: AndroidNotificationBackend;
  /** Optional native Google linking preserves the current account and confirms explicit restore choices. */
  googleIdentity?: AndroidGoogleIdentity;
  /** Google-only server-authoritative referral acquisition. */
  referrals?: AndroidReferralBackend;
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
  /** Provisioning is reused after native linking so the backend registers the verified Google subject. */
  const provision = async (): Promise<ProvisionedAccount> => {
    /** The callable remains authoritative for profile ownership and starting balance. */
    const {data} = await androidFunctions.provisionAndroidAccount();
    if (!isProvisionedAccount(data)) throw new Error("provision-response-invalid");
    return data;
  };
  /** Firebase sign-out also clears Credential Manager's selected provider session. */
  const signOutOwned = async (expectedUid: string | undefined, current: () => boolean): Promise<GoogleAccountChange> => {
    if (!expectedUid || !current() || auth.currentUser?.uid !== expectedUid) return {kind: "cancelled"};
    await clearAndroidNotificationAccount(expectedUid).catch(() => undefined);
    await clearGoogleCredentialState().catch(() => undefined);
    if (!current() || auth.currentUser?.uid !== expectedUid) return {kind: "cancelled"};
    await firebaseSignOut(auth);
    return auth.currentUser === null ? {kind: "committed", uid: null} : {kind: "cancelled"};
  };
  /** Public sign-out retains its existing void contract while retiring only the original owner. */
  const signOut = async (): Promise<void> => {await signOutOwned(auth.currentUser?.uid, () => true);};

  return {
    projectId: config.firebase.projectId,
    usingEmulators: config.emulators !== null,
    functions: gameFunctions,
    currentUser: () => auth.currentUser,
    /** Auth replacement retires only the previous persisted native notification owner. */
    onUserChanged(listener) {
      /** Previous Firebase owner selects the native compare-and-clear operation. */
      let previousUid = auth.currentUser?.uid ?? null;
      return onAuthStateChanged(auth, user => {
        /** New Firebase identity is authoritative even if a view has already retired. */
        const nextUid = user?.uid ?? null, retiredUid = previousUid;
        previousUid = nextUid;
        if (retiredUid && retiredUid !== nextUid) void clearAndroidNotificationAccount(retiredUid).catch(() => undefined);
        listener(user);
      });
    },
    /** Reuses the persisted anonymous session before creating a new one. */
    async signInAnonymously() {
      if (auth.currentUser) return auth.currentUser;
      return (await signInAnonymously(auth)).user;
    },
    /** Signs out through the SDK; the next launch provisions a fresh anonymous account. */
    signOut,
    googleIdentity: createFirebaseGoogleIdentity(auth, config.firebase.googleWebClientId, provision, signOutOwned),
    /** Reads the account document the backend maintains. */
    async loadUserDocument(userId) {
      /** Document snapshot. */
      const snapshot = await getDoc(doc(firestore, "users", userId));
      return snapshot.exists() ? snapshot.data() : null;
    },
    /** Provisions the account and validates the response shape. */
    provisionAccount: provision,
    referrals: {
      status: async expectedOwnerId => (await httpsCallable<{
        /** Initiating native account, never a replacement signed-in uid. */
        expectedOwnerId?: string}, AndroidReferralStatus>(gameplayFunctions, "getAndroidReferralStatus")(expectedOwnerId ? {expectedOwnerId} : {})).data,
      create: async expectedOwnerId => (await httpsCallable<{
        /** Native view's original authenticated owner. */
        expectedOwnerId?: string}, AndroidReferralToken>(gameplayFunctions, "createAndroidReferral")(expectedOwnerId ? {expectedOwnerId} : {})).data,
      bind: async (token, expectedOwnerId) => (await httpsCallable<{
        /** Opaque server-issued acquisition token, never an inviter or award. */
        token: string;
        /** Account lifetime that explicitly accepted the referral. */
        expectedOwnerId?: string
      }, AndroidReferralBinding>(gameplayFunctions, "bindAndroidReferralEntry")({token, ...(expectedOwnerId ? {expectedOwnerId} : {})})).data,
    },
    notifications: {
      async readPreference(expectedOwnerId) {
        if (auth.currentUser?.uid !== expectedOwnerId) throw new Error("notification-account-changed");
        const snapshot = await getDoc(doc(firestore, "users", expectedOwnerId));
        if (auth.currentUser?.uid !== expectedOwnerId) throw new Error("notification-account-changed");
        const enabled = snapshot.data()?.notificationsEnabled;
        return typeof enabled === "boolean" ? enabled : null;
      },
      /** Sends only the current account's explicit native notification consent. */
      async setSubscription(input) {
        /** Android-only callable bound to the authenticated gameplay region. */
        if (auth.currentUser?.uid !== input.expectedOwnerId) throw new Error("notification-account-changed");
        const call = httpsCallable<Parameters<AndroidNotificationBackend["setSubscription"]>[0], Awaited<ReturnType<AndroidNotificationBackend["setSubscription"]>>>(gameplayFunctions, "setAndroidPushSubscription");
        const result = (await call(input)).data;
        if (auth.currentUser?.uid !== input.expectedOwnerId) throw new Error("notification-account-changed");
        return result;
      },
    },
    purchases: {
      grant: async (input) => (await androidFunctions.grantAndroidPurchase(input)).data,
      syncSubscriptions: async (purchaseTokens) => (await androidFunctions.syncAndroidSubscriptions({purchaseTokens})).data,
    },
  };
}
