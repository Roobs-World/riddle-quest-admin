import hostedConfigDocument from "#hosted-config";
import {isFirebaseFunctionsRegion} from "../../../../../src/platform/firebase/secureConfiguration";
/** Public Firebase web-app configuration; never a secret, identical to the shared hosted game's client config. */
export type HostedFirebaseConfig = Readonly<{
  /** Stores api key. */
  apiKey: string;
  /** Stores app id. */
  appId: string;
  /** Registered Firebase Android app id for native FCM; absent until owner setup. */
  androidAppId?: string;
  /** Public Android API key for native Firebase installations and messaging. */
  androidApiKey?: string;
  /** Web OAuth client id from this Firebase project, used as Google ID token audience. */
  googleWebClientId?: string;
  /** Stores auth domain. */
  authDomain: string;
  /** Stores messaging sender id. */
  messagingSenderId: string;
  /** Stores project id. */
  projectId: string;
  /** Region of account and profile callables. */
  functionsRegion: string;
  /** Region of solo gameplay callables. */
  gameplayRegion: string;
}>;
/** Firebase emulator endpoints reachable from the device; absent in production builds. */
export type HostedEmulatorConfig = Readonly<{
  /** Host as seen from the device, such as `10.0.2.2` on the Android emulator. */
  host: string;
  /** Auth emulator port. */
  authPort: number;
  /** Functions emulator port. */
  functionsPort: number;
  /** Firestore emulator port. */
  firestorePort: number;
}>;
/** Machine-local hosted configuration shape. */
export type HostedConfig = Readonly<{
  /** Stores firebase. */
  firebase: HostedFirebaseConfig;
  /** Stores emulators. */
  emulators: HostedEmulatorConfig | null;
}>;
/** Whether a value is a non-empty string. */
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
/** Plaintext emulator connections are confined to local development hosts. */
const isEmulatorHost = (value: unknown): value is string => value === "10.0.2.2" || value === "127.0.0.1" || value === "localhost";
/** Whether a value is a TCP port. */
const isPort = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0 && Number(value) < 65_536;
/** Configuration values remain unknown until their owning block is validated. */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
/** Validates the bundled hosted configuration before any Firebase initialization. */
export function parseHostedConfig(value: unknown): HostedConfig {
  if (!isRecord(value)) throw new Error("hosted-config-invalid");
  /** Untrusted Firebase block. */
  const firebase = value.firebase;
  if (
    !isRecord(firebase) ||
    !isText(firebase.apiKey) ||
    !isText(firebase.appId) ||
    !isText(firebase.authDomain) ||
    !isText(firebase.messagingSenderId) ||
    !isText(firebase.projectId) ||
    !isFirebaseFunctionsRegion(firebase.functionsRegion) ||
    !isFirebaseFunctionsRegion(firebase.gameplayRegion)
  ) {
    throw new Error("hosted-config-firebase-invalid");
  }
  /** Untrusted emulator block. */
  const emulatorDocument = value.emulators ?? null;
  let emulators: HostedEmulatorConfig | null = null;
  if (emulatorDocument !== null) {
    if (!isRecord(emulatorDocument) || !isEmulatorHost(emulatorDocument.host) || !isPort(emulatorDocument.authPort) || !isPort(emulatorDocument.functionsPort) || !isPort(emulatorDocument.firestorePort)) {
      throw new Error("hosted-config-emulators-invalid");
    }
    emulators = {
      host: emulatorDocument.host,
      authPort: emulatorDocument.authPort,
      functionsPort: emulatorDocument.functionsPort,
      firestorePort: emulatorDocument.firestorePort,
    };
  }
  return {
    firebase: {
      apiKey: firebase.apiKey,
      appId: firebase.appId,
      ...(isText(firebase.androidAppId) ? {androidAppId: firebase.androidAppId} : {}),
      ...(isText(firebase.androidApiKey) ? {androidApiKey: firebase.androidApiKey} : {}),
      ...(isText(firebase.googleWebClientId) ? {googleWebClientId: firebase.googleWebClientId} : {}),
      authDomain: firebase.authDomain,
      messagingSenderId: firebase.messagingSenderId,
      projectId: firebase.projectId,
      functionsRegion: firebase.functionsRegion,
      gameplayRegion: firebase.gameplayRegion,
    },
    emulators,
  };
}
/** Hosted configuration bundled into this build. */
export const hostedConfig: HostedConfig = parseHostedConfig(hostedConfigDocument);
