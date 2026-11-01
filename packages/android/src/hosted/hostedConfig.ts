import hostedConfigDocument from "#hosted-config";
/** Public Firebase web-app configuration; never a secret, identical to the Jest Web Target's client config. */
export type HostedFirebaseConfig = Readonly<{
  /** Stores api key. */
  apiKey: string;
  /** Stores app id. */
  appId: string;
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
/** Whether a value is a TCP port. */
const isPort = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0 && Number(value) < 65_536;
/** Shape of the bundled document before validation. */
type UntrustedHostedConfig = {
  /** Unvalidated Firebase block. */
  firebase?: Record<string, unknown>;
  /** Unvalidated emulator block. */
  emulators?: Record<string, unknown> | null;
};
/** Validates the bundled hosted configuration before any Firebase initialization. */
export function parseHostedConfig(value: unknown): HostedConfig {
  if (typeof value !== "object" || value === null) throw new Error("hosted-config-invalid");
  /** Untrusted document. */
  const document = value as UntrustedHostedConfig;
  /** Untrusted Firebase block. */
  const firebase = document.firebase;
  if (
    !firebase ||
    !isText(firebase.apiKey) ||
    !isText(firebase.appId) ||
    !isText(firebase.authDomain) ||
    !isText(firebase.messagingSenderId) ||
    !isText(firebase.projectId) ||
    !isText(firebase.functionsRegion) ||
    !isText(firebase.gameplayRegion)
  ) {
    throw new Error("hosted-config-firebase-invalid");
  }
  /** Untrusted emulator block. */
  const emulators = document.emulators ?? null;
  if (emulators !== null && (!isText(emulators.host) || !isPort(emulators.authPort) || !isPort(emulators.functionsPort) || !isPort(emulators.firestorePort))) {
    throw new Error("hosted-config-emulators-invalid");
  }
  return {
    firebase: {
      apiKey: firebase.apiKey,
      appId: firebase.appId,
      authDomain: firebase.authDomain,
      messagingSenderId: firebase.messagingSenderId,
      projectId: firebase.projectId,
      functionsRegion: firebase.functionsRegion,
      gameplayRegion: firebase.gameplayRegion,
    },
    emulators: emulators
      ? {
          host: emulators.host as string,
          authPort: emulators.authPort as number,
          functionsPort: emulators.functionsPort as number,
          firestorePort: emulators.firestorePort as number,
        }
      : null,
  };
}
/** Hosted configuration bundled into this build. */
export const hostedConfig: HostedConfig = parseHostedConfig(hostedConfigDocument);
