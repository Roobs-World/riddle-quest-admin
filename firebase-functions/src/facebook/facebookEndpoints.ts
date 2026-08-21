import {createHash, randomBytes} from "node:crypto";
import {getAppCheck} from "firebase-admin/app-check";
import {logger} from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import {admin} from "../shared/firebaseAdmin";
import {captureException, flushSentry} from "../shared/sentry";
import {onRequestWithSentry} from "../shared/sentryHandlers";
import {
  facebookFirebaseUid,
  MAX_FACEBOOK_ACCOUNT_GENERATION,
  verifyFacebookSignedPlayer,
} from "./facebookSecurity";
import {createReservedFacebookUser} from "./facebookUser";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
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
/** Defines the nonce collection value. */
const NONCE_COLLECTION = "facebookIdentityNonces";
/** Defines the identity collection value. */
const IDENTITY_COLLECTION = "providerIdentities";
/** Defines the nonce ttl ms value. */
const NONCE_TTL_MS = 5 * 60 * 1_000;
/** Defines the app check ttl ms value. */
const APP_CHECK_TTL_MS = 60 * 60 * 1_000;

/** Describes facebook custom auth claims. */
export type FacebookCustomAuthClaims = Readonly<{
  provider: "facebook";
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
  if (typeof value !== "object" || value === null || !("toMillis" in value) ||
    typeof (value as {toMillis?: unknown}).toMillis !== "function") return false;
  const milliseconds = (value as {toMillis(): unknown}).toMillis();
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
  const priorUid = facebookFirebaseUid(playerId, uidSecret, accountGeneration - 1);
  const expectedHash = createHash("sha256").update(priorUid).digest("hex");
  return value.lastDeletedUidHash === expectedHash;
};

/** Validates the complete server-owned identity record before deriving session credentials. */
export function resolveFacebookProviderIdentity(
  value: unknown,
  {appId, playerId, uidSecret}: {appId: string; playerId: string; uidSecret: string},
): {accountGeneration: number; uid: string; needsUidRepair: boolean} {
  if (!isRecord(value) ||
    value.provider !== "facebook" ||
    value.appId !== appId ||
    value.providerPlayerId !== playerId ||
    !Number.isSafeInteger(value.accountGeneration) ||
    (value.accountGeneration as number) < 1 ||
    (value.accountGeneration as number) > MAX_FACEBOOK_ACCOUNT_GENERATION ||
    (value.status !== "active" && value.status !== "deleting")) {
    throw new Error("facebook-provider-identity-conflict");
  }
  if (value.status === "deleting") throw new Error("facebook-account-deletion-in-progress");
  const accountGeneration = value.accountGeneration as number;
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
  providerExists: boolean;
  needsUidRepair: boolean;
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
  now = Date.now(),
): Promise<boolean> => {
  if (
    !nonce ||
    Buffer.byteLength(nonce, "utf8") > 256 ||
    !playerId ||
    playerId.length > 256 ||
    !/^[A-Za-z0-9_-]+$/.test(playerId) ||
    !isSafeNonNegativeInteger(now) ||
    now > Number.MAX_SAFE_INTEGER - NONCE_TTL_MS ||
    !isSafeNonNegativeInteger(issuedAt) ||
    issuedAt > Math.floor(Number.MAX_SAFE_INTEGER / 1_000)
  ) return false;
  const issuedAtMs = issuedAt * 1_000;
  const ref = db.collection(NONCE_COLLECTION).doc(nonceId(nonce));
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    const createdAtMs = data?.createdAtMs;
    const expiresAtMs = data?.expiresAtMs;
    if (
      !snapshot.exists ||
      data?.consumedAtMs !== null ||
      !isSafeNonNegativeInteger(createdAtMs) ||
      !isSafeNonNegativeInteger(expiresAtMs) ||
      createdAtMs > Number.MAX_SAFE_INTEGER - NONCE_TTL_MS ||
      expiresAtMs !== createdAtMs + NONCE_TTL_MS ||
      expiresAtMs <= now ||
      issuedAtMs < createdAtMs - 60_000 ||
      issuedAtMs > expiresAtMs
    ) return false;
    transaction.update(ref, {
      consumedAtMs: now,
      playerIdHash: createHash("sha256").update(playerId).digest("hex"),
    });
    return true;
  });
};

/** Provides reject behavior. */
const reject = async (functionName: string, response: FacebookHttpResponse, error: unknown) => {
  logger.warn("Rejected Facebook platform request", {reason: error instanceof Error ? error.message : "invalid-request"});
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
      if (!await consumeFacebookRequestQuota(request.ip ?? "unknown", facebookAppSecret.value())) {
        response.status(429).json({error: "rate-limited"});
        return;
      }
      parseEmptyBody(request.body);
      const nonce = randomBytes(32).toString("base64url");
      const createdAtMs = Date.now();
      await admin.firestore().collection(NONCE_COLLECTION).doc(nonceId(nonce)).create({
        createdAtMs,
        expiresAtMs: createdAtMs + NONCE_TTL_MS,
        consumedAtMs: null,
      });
      response.json({nonce, expiresAtMs: createdAtMs + NONCE_TTL_MS});
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
      if (!await consumeFacebookRequestQuota(request.ip ?? "unknown", facebookAppSecret.value())) {
        response.status(429).json({error: "rate-limited"});
        return;
      }
      const appId = process.env.FACEBOOK_APP_ID ?? "";
      const firebaseAppId = process.env.FACEBOOK_FIREBASE_APP_ID ?? "";
      if (!appId || !firebaseAppId) throw new Error("facebook-identity-not-configured");
      const input = parseFacebookExchangeBody(request.body);
      const verified = await verifyFacebookSignedPlayer(input.signedPlayer, {
        appSecret: facebookAppSecret.value(),
        configuredAppId: appId,
        expectedAppId: appId,
        expectedPlayerId: input.playerId,
        expectedNonce: input.nonce,
        consumeNonce: consumeFacebookIdentityNonce,
      });
      const db = admin.firestore();
      const providerRef = db.collection(IDENTITY_COLLECTION).doc(facebookProviderIdentityId(appId, verified.player_id));
      let accountGeneration = 1;
      let uid = "";
      await db.runTransaction(async (transaction) => {
        const providerSnapshot = await transaction.get(providerRef);
        const existingProvider = providerSnapshot.data();
        let needsUidRepair = false;
        if (providerSnapshot.exists) {
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
        const userRef = db.collection("users").doc(uid);
        const userSnapshot = await transaction.get(userRef);
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
      const claims = facebookCustomAuthClaims(accountGeneration);
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
