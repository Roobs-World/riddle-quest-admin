import {createHash, randomBytes} from "node:crypto";
import {getAppCheck} from "firebase-admin/app-check";
import {logger} from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {captureException, flushSentry} from "../../../../firebase-functions/src/shared/sentry";
import {onRequestWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {facebookFirebaseUid, MAX_FACEBOOK_ACCOUNT_GENERATION, verifyFacebookSignedPlayer} from "./facebookSecurity";
import {createReservedFacebookUser} from "./facebookUser";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {FACEBOOK_NONCE_COLLECTION as NONCE_COLLECTION,
  FACEBOOK_NONCE_TIMESTAMP_MAX_MS, createFacebookIdentityNonceRecord, readFacebookIdentityNonceRecord} from "./facebookIdentityNonce";
import {
  acceptFacebookRequest,
  consumeFacebookRequestQuota,
  parseFacebookExchangeBody,
  type FacebookHttpResponse,
} from "./facebookIdentityRequestSecurity";
export {
  acceptFacebookRequest,
  allowFacebookRequest,
  applyFacebookCors,
  consumeFacebookRequestQuota,
  isAllowedFacebookOrigin,
  parseFacebookExchangeBody,
} from "./facebookIdentityRequestSecurity";

/** Provides facebook app secret behavior. */
const facebookAppSecret = defineSecret("FACEBOOK_APP_SECRET");
/** Provides facebook uid secret behavior. */
const facebookUidSecret = defineSecret("FACEBOOK_UID_SECRET");
/** Provides facebook http options behavior. */
const facebookHttpOptions = {secrets: [facebookAppSecret, facebookUidSecret], invoker: "public" as const};
/** Defines the identity collection value. */
const IDENTITY_COLLECTION = "providerIdentities";
/** Defines the app check ttl ms value. */
const APP_CHECK_TTL_MS = 60 * 60 * 1_000;

/** Describes facebook custom auth claims. */
export type FacebookCustomAuthClaims = Readonly<{
  /** Stores provider. */
  provider: "facebook";
  /** Stores account generation. */
  accountGeneration: number;
}>;

/** Builds the complete, intentionally PII-free claim set for Facebook sessions. */
export function facebookCustomAuthClaims(accountGeneration: number): FacebookCustomAuthClaims {
  if (
    !Number.isSafeInteger(accountGeneration) ||
    accountGeneration < 1 ||
    accountGeneration > MAX_FACEBOOK_ACCOUNT_GENERATION
  ) {
    throw new Error("invalid-facebook-account-generation");
  }
  return {provider: "facebook", accountGeneration};
}

/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** Indicates whether is safe non negative integer. */
const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
/** Provides nonce id behavior. */
const nonceId = (nonce: string) => createHash("sha256").update(nonce).digest("hex");
/** Provides facebook provider identity id behavior. */
export const facebookProviderIdentityId = (appId: string, playerId: string) =>
  createHash("sha256").update(`${appId}\0${playerId}`).digest("hex");

/** Provides valid deletion timestamp behavior. */
const validDeletionTimestamp = (value: unknown): boolean => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("toMillis" in value) ||
    typeof (
      value as {
        /** Stores to millis. */
        toMillis?: unknown;
      }
    ).toMillis !== "function"
  )
    return false;
  /** Provides milliseconds behavior. */
  const milliseconds = (
    value as {
      /** Provides to millis behavior. */
      toMillis(): unknown;
    }
  ).toMillis();
  return typeof milliseconds === "number" && Number.isSafeInteger(milliseconds) && milliseconds >= 0;
};

/** Indicates whether has fresh generation deletion proof. */
const hasFreshGenerationDeletionProof = (
  value: Record<string, unknown>,
  playerId: string,
  uidSecret: string,
  accountGeneration: number,
): boolean => {
  if (accountGeneration <= 1 || !validDeletionTimestamp(value.lastDeletedAt)) return false;
  /** Provides prior uid behavior. */
  const priorUid = facebookFirebaseUid(playerId, uidSecret, accountGeneration - 1);
  /** Provides expected hash behavior. */
  const expectedHash = createHash("sha256").update(priorUid).digest("hex");
  return value.lastDeletedUidHash === expectedHash;
};

/** Validates the complete server-owned identity record before deriving session credentials. */
export function resolveFacebookProviderIdentity(
  value: unknown,
  {
    appId,
    playerId,
    uidSecret,
  }: {
    /** Stores app id. */
    appId: string; /** Stores player id. */
    /** Stores player id. */
    playerId: string; /** Stores uid secret. */
    /** Stores uid secret. */
    uidSecret: string;
  },
): {
  /** Stores account generation. */
  accountGeneration: number; /** Stores uid. */
  /** Stores uid. */
  uid: string; /** Stores needs uid repair. */
  /** Stores needs uid repair. */
  needsUidRepair: boolean;
} {
  if (
    !isRecord(value) ||
    value.provider !== "facebook" ||
    value.appId !== appId ||
    value.providerPlayerId !== playerId ||
    !Number.isSafeInteger(value.accountGeneration) ||
    (value.accountGeneration as number) < 1 ||
    (value.accountGeneration as number) > MAX_FACEBOOK_ACCOUNT_GENERATION ||
    (value.status !== "active" && value.status !== "deleting")
  ) {
    throw new Error("facebook-provider-identity-conflict");
  }
  if (value.status === "deleting") throw new Error("facebook-account-deletion-in-progress");
  /** Provides account generation behavior. */
  const accountGeneration = value.accountGeneration as number;
  /** Provides uid behavior. */
  const uid = facebookFirebaseUid(playerId, uidSecret, accountGeneration);
  if (value.uid !== null && value.uid !== uid) throw new Error("facebook-provider-identity-conflict");
  if (value.uid === null && !hasFreshGenerationDeletionProof(value, playerId, uidSecret, accountGeneration)) {
    throw new Error("facebook-provider-identity-conflict");
  }
  return {accountGeneration, uid, needsUidRepair: value.uid === null};
}

/** Describes facebook identity provisioning. */
export type FacebookIdentityProvisioning = "new_identity" | "fresh_generation" | "existing_identity";

/** Prevents orphaned or stale user documents from being adopted or recreated during identity exchange. */
export function resolveFacebookIdentityProvisioning({
  providerExists,
  needsUidRepair,
  userExists,
}: {
  /** Stores provider exists. */
  providerExists: boolean;
  /** Stores needs uid repair. */
  needsUidRepair: boolean;
  /** Stores user exists. */
  userExists: boolean;
}): FacebookIdentityProvisioning {
  if (!providerExists) {
    if (needsUidRepair || userExists) throw new Error("facebook-identity-provisioning-conflict");
    return "new_identity";
  }
  if (needsUidRepair) {
    if (userExists) throw new Error("facebook-identity-provisioning-conflict");
    return "fresh_generation";
  }
  if (!userExists) throw new Error("facebook-identity-provisioning-conflict");
  return "existing_identity";
}

/** Parses empty body. */
const parseEmptyBody = (body: unknown): void => {
  if (!isRecord(body) || Object.keys(body).length !== 0) throw new Error("invalid-request");
};

/** Provides consume facebook identity nonce behavior. */
export const consumeFacebookIdentityNonce = async (
  nonce: string,
  playerId: string,
  issuedAt: number,
  db: FirebaseFirestore.Firestore = admin.firestore(),
  now: number | (() => number) = Date.now,
): Promise<boolean> => {
  /** Fresh server time is bounded after every awaited storage boundary; tests may inject a fixed clock. */
  const readNow = (): number | undefined => {
    try {
      /** A stalled read/commit cannot reuse the request's earlier acceptance time. */
      const value = typeof now === "function" ? now() : now;
      return isSafeNonNegativeInteger(value) && value <= FACEBOOK_NONCE_TIMESTAMP_MAX_MS ? value : undefined;
    } catch {return undefined;}
  };
  /** Syntax/clock failures stay before all nonce database reads. */
  const startedAtMs = readNow();
  if (
    !nonce ||
    Buffer.byteLength(nonce, "utf8") > 256 ||
    !playerId ||
    playerId.length > 256 ||
    !/^[A-Za-z0-9_-]+$/.test(playerId) ||
    startedAtMs === undefined ||
    !isSafeNonNegativeInteger(issuedAt) ||
    issuedAt > Math.floor(Number.MAX_SAFE_INTEGER / 1_000)
  )
    return false;
  /** Provides issued at ms behavior. */
  const issuedAtMs = issuedAt * 1_000;
  /** Provides ref behavior. */
  const ref = db.collection(NONCE_COLLECTION).doc(nonceId(nonce));
  /** Only the successful transaction attempt supplies its commit acceptance window. */
  let acceptedAtMs: number | undefined;
  /** Original expiry is never extended to cover storage latency. */
  let acceptedDeadlineMs: number | undefined;
  /** A committed nonce may be spent even when delayed completion makes authentication fail closed. */
  const accepted = await db.runTransaction(async (transaction) => {
    /** Provides snapshot behavior. */
    const snapshot = await transaction.get(ref);
    /** Provides data behavior. */
    let data;
    try {data = readFacebookIdentityNonceRecord(snapshot.data());} catch {return false;}
    /** Creates d at ms. */
    const createdAtMs = data?.createdAtMs;
    /** Provides expires at ms behavior. */
    const expiresAtMs = data?.expiresAtMs;
    /** Re-evaluate the server clock after the authoritative read and on every transaction retry. */
    const currentNow = readNow();
    if (
      data.consumedAtMs !== null ||
      currentNow === undefined || currentNow < startedAtMs ||
      currentNow < createdAtMs ||
      expiresAtMs <= currentNow ||
      issuedAtMs < createdAtMs - 60_000 ||
      issuedAtMs > expiresAtMs
    )
      return false;
    transaction.update(ref, {
      consumedAtMs: currentNow,
      playerIdHash: createHash("sha256").update(playerId).digest("hex"),
    });
    acceptedAtMs = currentNow;
    acceptedDeadlineMs = expiresAtMs;
    return true;
  });
  if (!accepted || acceptedAtMs === undefined || acceptedDeadlineMs === undefined) return false;
  /** An expired or regressed clock after commit cannot authorize a custom token. */
  const completedAtMs = readNow();
  return completedAtMs !== undefined && completedAtMs >= acceptedAtMs && completedAtMs < acceptedDeadlineMs;
};

/** Provides reject behavior. */
const reject = async (functionName: string, response: FacebookHttpResponse, error: unknown) => {
  logger.warn("Rejected Facebook platform request", {
    reason: error instanceof Error ? error.message : "invalid-request",
  });
  captureException(error, {firebaseFunction: functionName});
  await flushSentry();
  response.status(401).json({error: "invalid-request"});
};

/** Provides issue facebook identity nonce behavior. */
export const issueFacebookIdentityNonce = onRequestWithSentry(
  "issueFacebookIdentityNonce",
  facebookHttpOptions,
  async (request, response) => {
    if (!acceptFacebookRequest(request, response)) return;
    if (!isFacebookFeatureEnabled("identity")) {
      response.status(503).json({error: "temporarily-unavailable"});
      return;
    }
    try {
      if (!(await consumeFacebookRequestQuota(request.ip ?? "unknown", facebookAppSecret.value()))) {
        response.status(429).json({error: "rate-limited"});
        return;
      }
      parseEmptyBody(request.body);
      /** Provides nonce behavior. */
      const nonce = randomBytes(32).toString("base64url");
      /** Creates d at ms. */
      const createdAtMs = Date.now();
      /** Shared nonce policy binds physical TTL to the same logical five-minute deadline. */
      const record = createFacebookIdentityNonceRecord(createdAtMs);
      await admin
        .firestore()
        .collection(NONCE_COLLECTION)
        .doc(nonceId(nonce))
        .create(record);
      response.json({nonce, expiresAtMs: record.expiresAtMs});
    } catch (error) {
      await reject("issueFacebookIdentityNonce", response, error);
    }
  },
);

/** Provides exchange facebook identity behavior. */
export const exchangeFacebookIdentity = onRequestWithSentry(
  "exchangeFacebookIdentity",
  facebookHttpOptions,
  async (request, response) => {
    if (!acceptFacebookRequest(request, response)) return;
    if (!isFacebookFeatureEnabled("identity")) {
      response.status(503).json({error: "temporarily-unavailable"});
      return;
    }
    try {
      if (!(await consumeFacebookRequestQuota(request.ip ?? "unknown", facebookAppSecret.value()))) {
        response.status(429).json({error: "rate-limited"});
        return;
      }
      /** Provides app id behavior. */
      const appId = process.env.FACEBOOK_APP_ID ?? "";
      /** Provides firebase app id behavior. */
      const firebaseAppId = process.env.FACEBOOK_FIREBASE_APP_ID ?? "";
      if (!appId || !firebaseAppId) throw new Error("facebook-identity-not-configured");
      /** Provides input behavior. */
      const input = parseFacebookExchangeBody(request.body);
      /** Provides verified behavior. */
      const verified = await verifyFacebookSignedPlayer(input.signedPlayer, {
        appSecret: facebookAppSecret.value(),
        configuredAppId: appId,
        expectedAppId: appId,
        expectedPlayerId: input.playerId,
        expectedNonce: input.nonce,
        consumeNonce: consumeFacebookIdentityNonce,
      });
      /** Provides db behavior. */
      const db = admin.firestore();
      /** Provides provider ref behavior. */
      const providerRef = db.collection(IDENTITY_COLLECTION).doc(facebookProviderIdentityId(appId, verified.player_id));
      /** Provides account generation behavior. */
      let accountGeneration = 1;
      /** Provides uid behavior. */
      let uid = "";
      await db.runTransaction(async (transaction) => {
        /** Provides provider snapshot behavior. */
        const providerSnapshot = await transaction.get(providerRef);
        /** Provides existing provider behavior. */
        const existingProvider = providerSnapshot.data();
        /** Provides needs uid repair behavior. */
        let needsUidRepair = false;
        if (providerSnapshot.exists) {
          /** Resolves d. */
          const resolved = resolveFacebookProviderIdentity(existingProvider, {
            appId,
            playerId: verified.player_id,
            uidSecret: facebookUidSecret.value(),
          });
          accountGeneration = resolved.accountGeneration;
          uid = resolved.uid;
          needsUidRepair = resolved.needsUidRepair;
        }
        if (!providerSnapshot.exists) {
          uid = facebookFirebaseUid(verified.player_id, facebookUidSecret.value(), accountGeneration);
        }
        /** Provides r ref. */
        const userRef = db.collection("users").doc(uid);
        /** Provides r snapshot. */
        const userSnapshot = await transaction.get(userRef);
        /** Provides provisioning behavior. */
        const provisioning = resolveFacebookIdentityProvisioning({
          providerExists: providerSnapshot.exists,
          needsUidRepair,
          userExists: userSnapshot.exists,
        });
        if (provisioning === "new_identity") {
          transaction.create(providerRef, {
            provider: "facebook",
            appId,
            providerPlayerId: verified.player_id,
            uid,
            accountGeneration,
            status: "active",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else if (provisioning === "fresh_generation") {
          transaction.update(providerRef, {uid, status: "active"});
        }
        if (provisioning !== "existing_identity") {
          transaction.create(userRef, createReservedFacebookUser(transaction, db, uid));
        }
      });
      /** Provides claims behavior. */
      const claims = facebookCustomAuthClaims(accountGeneration);
      /** Provides [custom token, app check token] behavior. */
      const [customToken, appCheckToken] = await Promise.all([
        admin.auth().createCustomToken(uid, claims),
        getAppCheck().createToken(firebaseAppId, {ttlMillis: APP_CHECK_TTL_MS}),
      ]);
      response.json({
        customToken,
        appCheckToken: appCheckToken.token,
        appCheckExpiresInMs: appCheckToken.ttlMillis,
        uid,
      });
    } catch (error) {
      await reject("exchangeFacebookIdentity", response, error);
    }
  },
);
