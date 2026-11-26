import type {FirebaseApp} from "firebase/app";
import {CustomProvider, initializeAppCheck, type AppCheck} from "firebase/app-check";
import {NativeModules} from "react-native";
import type {HostedConfig} from "./hostedConfig";
/** Play Integrity token source; the native module implements it on devices. */
export type PlayIntegrityPort = Readonly<{
  /** Requests a token bound to a nonce for the Cloud project number. */
  requestIntegrityToken(nonce: string, cloudProjectNumber: string): Promise<string>;
}>;
/** App Check token with its absolute expiry, as the Firebase JS SDK expects. */
export type AttestedToken = Readonly<{
  /** App Check token. */
  token: string;
  /** Expiry in epoch milliseconds. */
  expireTimeMillis: number;
}>;
/** Minimal HTTP transport so tests can substitute it. */
type Fetch = (url: string, init: {
/** Stores method. */
method: "POST";
/** Stores headers. */
headers: Record<string, string>;
/** Stores body. */
body: string}) => Promise<{
  /** Whether the status was 2xx. */
  ok: boolean;
  /** Parsed body. */
  json(): Promise<unknown>;
}>;
/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
/** Base URL of the attestation endpoints, which run beside the account callables. */
const attestationBase = (config: HostedConfig): string =>
  `https://${config.firebase.functionsRegion}-${config.firebase.projectId}.cloudfunctions.net`;
/**
 * Obtains an App Check token by attesting the device with Play Integrity.
 *
 * @remarks
 * The backend issues a single-use nonce, the device binds a Play Integrity
 * token to it, and the backend verifies the verdict before minting the App
 * Check token. These endpoints use direct HTTPS requests: the callable client would try to
 * attach the App Check token this exchange is still obtaining.
 */
export async function attestDevice(config: HostedConfig, integrity: PlayIntegrityPort, fetchImpl: Fetch, now: () => number = Date.now): Promise<AttestedToken> {
  /** Endpoint base. */
  const base = attestationBase(config);
  /** POST helper. */
  const post = async (name: string, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    /** HTTP response. */
    const response = await fetchImpl(`${base}/${name}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
    if (!response.ok) throw new Error(`${name}-failed`);
    /** Parsed body. */
    const parsed = await response.json().catch(() => null);
    if (!isRecord(parsed)) throw new Error(`${name}-failed`);
    return parsed;
  };
  /** Server nonce. */
  const issued = await post("issueAndroidAttestationNonce", {});
  if (typeof issued.nonce !== "string") throw new Error("attestation-nonce-invalid");
  /** Play Integrity token bound to the nonce. */
  const integrityToken = await integrity.requestIntegrityToken(issued.nonce, config.firebase.messagingSenderId);
  /** Minted App Check token. */
  const exchanged = await post("exchangeAndroidAttestation", {nonce: issued.nonce, integrityToken});
  if (typeof exchanged.appCheckToken !== "string" || typeof exchanged.ttlMillis !== "number") throw new Error("attestation-response-invalid");
  return {token: exchanged.appCheckToken, expireTimeMillis: now() + exchanged.ttlMillis};
}
/** The device's Play Integrity port, or `null` when the native module is absent. */
export function getPlayIntegrity(): PlayIntegrityPort | null {
  /** Registered native module. */
  const native = (NativeModules as Record<string, unknown>).RiddleQuestPlayIntegrity as PlayIntegrityPort | undefined;
  return native ?? null;
}
/**
 * Enables App Check for production calls; emulator builds and devices without Play Integrity skip it.
 *
 * @returns The App Check instance, or `null` when attestation does not apply.
 */
export function enableAndroidAppCheck(
  app: FirebaseApp,
  config: HostedConfig,
  integrity: PlayIntegrityPort | null = getPlayIntegrity(),
  fetchImpl: Fetch = (url, init) => fetch(url, init),
): AppCheck | null {
  if (config.emulators || !integrity) return null;
  return initializeAppCheck(app, {
    provider: new CustomProvider({getToken: () => attestDevice(config, integrity, fetchImpl)}),
    isTokenAutoRefreshEnabled: true,
  });
}
