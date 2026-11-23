import {createHash, randomBytes} from "node:crypto";
import {getAppCheck} from "firebase-admin/app-check";
import {Timestamp, type Firestore} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import type {HttpsOptions} from "firebase-functions/v2/https";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {onRequestWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {createPlayIntegrityDecoder, rejectIntegrityVerdict, type PlayIntegrityDecoder} from "./playIntegrity";

/** Nonce records, one per issued nonce, removed by the `expiresAt` TTL policy. */
export const ANDROID_ATTESTATION_NONCES = "androidAttestationNonces";
/** How long an issued nonce can be exchanged. */
export const ANDROID_NONCE_TTL_MS = 5 * 60 * 1_000;
/** App Check token lifetime minted for an attested device. */
export const ANDROID_APP_CHECK_TTL_MS = 60 * 60 * 1_000;
/** Requests per address per minute on one instance before refusing. */
const REQUESTS_PER_MINUTE = 30;

/**
 * HTTP options for the attestation endpoints.
 *
 * @remarks
 * These are the App Check bootstrap: a device cannot hold an App Check token
 * before attesting, so they are plain HTTP endpoints rather than callables
 * (the callable client would try to attach the token it is still obtaining).
 * Play Integrity, the single-use nonce and a per-address limit protect them.
 */
const attestationHttpOptions = {
  region: ["us-central1", "europe-west1"],
  minInstances: 0,
  invoker: "public",
  timeoutSeconds: 30,
} satisfies HttpsOptions;

/** Request counters per address for the current minute on this instance. */
const requestCounts = new Map<string, {
/** Stores minute. */
minute: number;
/** Stores count. */
count: number}>();
/** Whether an address may make another attestation request. */
export function allowAttestationRequest(address: string, now = Date.now()): boolean {
  /** Current minute. */
  const minute = Math.floor(now / 60_000);
  /** Counter for the address. */
  const current = requestCounts.get(address);
  if (!current || current.minute !== minute) {
    if (requestCounts.size > 10_000) requestCounts.clear();
    requestCounts.set(address, {minute, count: 1});
    return true;
  }
  current.count += 1;
  return current.count <= REQUESTS_PER_MINUTE;
}

/** Firestore id for a nonce; raw nonces never become document paths. */
const nonceId = (nonce: string) => createHash("sha256").update(nonce).digest("hex");

/** Issues one single-use nonce for a Play Integrity request. */
export async function issueAndroidNonce(db: Firestore, now = Date.now()): Promise<{
/** Stores nonce. */
nonce: string;
/** Stores expires at ms. */
expiresAtMs: number}> {
  /** URL-safe nonce Play Integrity accepts (16–500 characters). */
  const nonce = randomBytes(32).toString("base64url");
  /** Expiry. */
  const expiresAtMs = now + ANDROID_NONCE_TTL_MS;
  await db.collection(ANDROID_ATTESTATION_NONCES).doc(nonceId(nonce)).create({
    createdAtMs: now,
    expiresAtMs,
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    consumedAtMs: null,
  });
  return {nonce, expiresAtMs};
}

/** Spends a nonce once; returns whether it was issued, unexpired and unspent. */
export async function consumeAndroidNonce(db: Firestore, nonce: string, now: () => number = Date.now): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{16,128}$/u.test(nonce)) return false;
  /** Nonce record. */
  const ref = db.collection(ANDROID_ATTESTATION_NONCES).doc(nonceId(nonce));
  return db.runTransaction(async (transaction) => {
    /** Stored record. */
    const snapshot = await transaction.get(ref);
    /** Stored fields. */
    const data = snapshot.data();
    /** Time of this attempt. */
    const at = now();
    if (!data || data.consumedAtMs !== null || typeof data.expiresAtMs !== "number" || data.expiresAtMs <= at) return false;
    transaction.update(ref, {consumedAtMs: at});
    return true;
  });
}

/** Outcome of one exchange. */
export type AttestationExchange =
  | {
      /** The device attested. */
      ok: true;
      /** App Check token for the Firebase JS SDK. */
      appCheckToken: string;
      /** Token lifetime. */
      ttlMillis: number;
    }
  | {
      /** The exchange was refused. */
      ok: false;
      /** Stable reason for logs. */
      reason: string;
    };

/** Collaborators of {@link exchangeAndroidAttestationToken}. */
export type AttestationDependencies = Readonly<{
  /** Firestore holding nonces. */
  db: Firestore;
  /** Play Integrity decoder. */
  decode: PlayIntegrityDecoder;
  /** Mints an App Check token for the Android Firebase app. */
  mint: () => Promise<{
  /** Stores token. */
  token: string;
  /** Stores ttl millis. */
  ttlMillis: number}>;
  /** Server clock. */
  now?: () => number;
}>;

/** Verifies a Play Integrity token bound to a server nonce and mints an App Check token. */
export async function exchangeAndroidAttestationToken(
  {db, decode, mint, now = Date.now}: AttestationDependencies,
  body: unknown,
): Promise<AttestationExchange> {
  /** Untrusted request. */
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof input.nonce !== "string" || typeof input.integrityToken !== "string" || input.integrityToken.length > 16_384) {
    return {ok: false, reason: "invalid-request"};
  }
  if (!(await consumeAndroidNonce(db, input.nonce, now))) return {ok: false, reason: "nonce-rejected"};
  /** Google's verdict. */
  const verdict = await decode(input.integrityToken).catch(() => null);
  if (!verdict) return {ok: false, reason: "integrity-decode-failed"};
  /** Why the verdict fails, if it does. */
  const reason = rejectIntegrityVerdict(verdict, {nonce: input.nonce, now: now()});
  if (reason) return {ok: false, reason};
  /** Minted token. */
  const minted = await mint();
  return {ok: true, appCheckToken: minted.token, ttlMillis: minted.ttlMillis};
}

/** Decoder created on first use. */
let decoder: PlayIntegrityDecoder | null = null;

/** Issues a nonce for Play Integrity. */
export const issueAndroidAttestationNonce = onRequestWithSentry("issueAndroidAttestationNonce", attestationHttpOptions, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({error: "method-not-allowed"});
    return;
  }
  if (!allowAttestationRequest(request.ip ?? "unknown")) {
    response.status(429).json({error: "rate-limited"});
    return;
  }
  response.json(await issueAndroidNonce(admin.firestore()));
});

/** Exchanges a Play Integrity token for an App Check token. */
export const exchangeAndroidAttestation = onRequestWithSentry("exchangeAndroidAttestation", attestationHttpOptions, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({error: "method-not-allowed"});
    return;
  }
  if (!allowAttestationRequest(request.ip ?? "unknown")) {
    response.status(429).json({error: "rate-limited"});
    return;
  }
  /** Firebase app the token is minted for; unset until the Android app is registered. */
  const appId = process.env.ANDROID_FIREBASE_APP_ID ?? "";
  if (!appId) {
    response.status(503).json({error: "attestation-not-configured"});
    return;
  }
  /** Exchange result. */
  const result = await exchangeAndroidAttestationToken(
    {
      db: admin.firestore(),
      decode: (decoder ??= createPlayIntegrityDecoder()),
      mint: () => getAppCheck().createToken(appId, {ttlMillis: ANDROID_APP_CHECK_TTL_MS}),
    },
    request.body,
  );
  if (!result.ok) {
    logger.warn("Rejected Android attestation", {reason: result.reason});
    response.status(401).json({error: "attestation-rejected"});
    return;
  }
  response.json({appCheckToken: result.appCheckToken, ttlMillis: result.ttlMillis});
});
