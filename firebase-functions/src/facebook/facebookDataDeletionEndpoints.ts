import {createHash, createHmac} from "node:crypto";
import {logger} from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import {type Request} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {captureException, flushSentry} from "../shared/sentry";
import {onRequestWithSentry} from "../shared/sentryHandlers";
import {
  deleteFacebookAccountGeneration,
  type FacebookDeletionIdentity,
} from "./facebookAccountDeletion";
import {facebookProviderIdentityId, allowFacebookRequest} from "./facebookEndpoints";
import {
  facebookFirebaseUid,
  MAX_FACEBOOK_ACCOUNT_GENERATION,
  verifyFacebookDeletionRequest,
} from "./facebookSecurity";

/** Provides facebook app secret behavior. */
const facebookAppSecret = defineSecret("FACEBOOK_APP_SECRET");
/** Provides facebook uid secret behavior. */
const facebookUidSecret = defineSecret("FACEBOOK_UID_SECRET");
/** Defines the deletion collection value. */
const DELETION_COLLECTION = "facebookDeletionRequests";
/** Defines the max body bytes value. */
const MAX_BODY_BYTES = 12 * 1_024;
/** Defines the code pattern value. */
const CODE_PATTERN = /^[0-9a-f]{32}$/;

/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Provides valid deletion timestamp behavior. */
const validDeletionTimestamp = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.toMillis !== "function") return false;
  try {
    const milliseconds = value.toMillis();
    return typeof milliseconds === "number" && Number.isSafeInteger(milliseconds) && milliseconds >= 0;
  } catch {
    return false;
  }
};

/** Describes http response. */
type HttpResponse = {
  /** Provides set behavior. */
  set(name: string, value: string): unknown;
  /** Provides status behavior. */
  status(code: number): HttpResponse;
  /** Provides json behavior. */
  json(body: unknown): unknown;
  /** Provides send behavior. */
  send(body: string): unknown;
};

/** Applies deletion headers. */
const applyDeletionHeaders = (response: Pick<HttpResponse, "set">): void => {
  response.set("Cache-Control", "no-store");
  response.set("Referrer-Policy", "no-referrer");
  response.set("X-Content-Type-Options", "nosniff");
  response.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
};

/** Parses facebook deletion body. */
export function parseFacebookDeletionBody(request: Request): string {
  if (request.method !== "POST") throw new Error("method-not-allowed");
  if (!request.is("application/x-www-form-urlencoded")) throw new Error("unsupported-media-type");
  if (request.rawBody && request.rawBody.byteLength > MAX_BODY_BYTES) throw new Error("payload-too-large");
  const body = request.body as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1) {
    throw new Error("invalid-request");
  }
  const signedRequest = (body as Record<string, unknown>).signed_request;
  if (typeof signedRequest !== "string" || !signedRequest || signedRequest.length > 8_192) {
    throw new Error("invalid-request");
  }
  return signedRequest;
}

/** Provides facebook deletion confirmation code behavior. */
export function facebookDeletionConfirmationCode(signedRequest: string, appSecret: string): string {
  return createHmac("sha256", appSecret)
    .update("riddle-quest-facebook-deletion-v1\0")
    .update(signedRequest)
    .digest("hex")
    .slice(0, 32);
}

/** Provides deletion status url behavior. */
const deletionStatusUrl = (code: string): string => {
  const configured = process.env.FACEBOOK_DELETION_STATUS_BASE_URL ?? "";
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("facebook-deletion-status-url-invalid");
  }
  url.searchParams.set("code", code);
  return url.toString();
};

/** Provides respond with confirmation behavior. */
const respondWithConfirmation = (response: HttpResponse, code: string): unknown =>
  response.status(200).json({url: deletionStatusUrl(code), confirmation_code: code});

/** Describes facebook deletion receipt plan. */
type FacebookDeletionReceiptPlan = Readonly<{
  complete: boolean;
  identity: FacebookDeletionIdentity | null;
}>;

/** Validates an existing callback receipt and restores only its originally frozen generation. */
export function resolveFacebookDeletionReceipt(
  value: unknown,
  {providerIdentityId, playerId, uidSecret}: {providerIdentityId: string; playerId: string; uidSecret: string},
): FacebookDeletionReceiptPlan {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.providerIdentityId !== providerIdentityId ||
    (value.status !== "processing" && value.status !== "complete") ||
    !validDeletionTimestamp(value.requestedAt) ||
    (value.accountGeneration !== null && (
      !Number.isSafeInteger(value.accountGeneration) ||
      (value.accountGeneration as number) < 1 ||
      (value.accountGeneration as number) > MAX_FACEBOOK_ACCOUNT_GENERATION
    )) ||
    (value.status === "complete" && !validDeletionTimestamp(value.completedAt))
  ) throw new Error("facebook-deletion-receipt-conflict");
  const accountGeneration = value.accountGeneration as number | null;
  return {
    complete: value.status === "complete",
    identity: accountGeneration === null ? null : {
      uid: facebookFirebaseUid(playerId, uidSecret, accountGeneration),
      accountGeneration,
    },
  };
}

/** Resolves only the exact deterministic account generation owned by this Meta identity. */
export function resolveFacebookCallbackDeletionIdentity(
  value: unknown,
  {appId, playerId, uidSecret}: {appId: string; playerId: string; uidSecret: string},
): FacebookDeletionIdentity | null {
  if (
    !isRecord(value) ||
    value.provider !== "facebook" ||
    value.appId !== appId ||
    value.providerPlayerId !== playerId ||
    !Number.isSafeInteger(value.accountGeneration) ||
    (value.accountGeneration as number) < 1 ||
    (value.accountGeneration as number) > MAX_FACEBOOK_ACCOUNT_GENERATION ||
    (value.status !== "active" && value.status !== "deleting" && value.status !== "exhausted") ||
    (value.status === "exhausted" && value.accountGeneration !== MAX_FACEBOOK_ACCOUNT_GENERATION)
  ) throw new Error("facebook-provider-identity-conflict");
  if (value.uid === null) {
    if (value.status !== "active" && value.status !== "exhausted") {
      throw new Error("facebook-provider-identity-conflict");
    }
    const deletedGeneration = value.status === "exhausted"
      ? value.accountGeneration as number
      : (value.accountGeneration as number) - 1;
    if (deletedGeneration < 1 || !validDeletionTimestamp(value.lastDeletedAt)) {
      throw new Error("facebook-provider-identity-conflict");
    }
    const deletedUid = facebookFirebaseUid(playerId, uidSecret, deletedGeneration);
    const expectedDeletedHash = createHash("sha256").update(deletedUid).digest("hex");
    if (value.lastDeletedUidHash !== expectedDeletedHash) {
      throw new Error("facebook-provider-identity-conflict");
    }
    return null;
  }
  if (value.status === "exhausted") throw new Error("facebook-provider-identity-conflict");
  const accountGeneration = value.accountGeneration as number;
  const expectedUid = facebookFirebaseUid(playerId, uidSecret, accountGeneration);
  if (value.uid !== expectedUid) throw new Error("facebook-provider-identity-conflict");
  return {uid: expectedUid, accountGeneration};
}

/** Meta app-dashboard callback for an app-secret-authenticated data-deletion request. */
export const facebookDataDeletionCallback = onRequestWithSentry(
  "facebookDataDeletionCallback",
  {secrets: [facebookAppSecret, facebookUidSecret], invoker: "public", timeoutSeconds: 540},
  async (request, response) => {
    applyDeletionHeaders(response);
    try {
      if (!allowFacebookRequest(`deletion:${request.ip ?? "unknown"}`)) {
        response.status(429).json({error: "rate-limited"});
        return;
      }
      const signedRequest = parseFacebookDeletionBody(request);
      const secret = facebookAppSecret.value();
      const payload = verifyFacebookDeletionRequest(signedRequest, secret);
      const appId = process.env.FACEBOOK_APP_ID ?? "";
      if (!appId) throw new Error("facebook-identity-not-configured");
      const code = facebookDeletionConfirmationCode(signedRequest, secret);
      const db = admin.firestore();
      const receiptRef = db.collection(DELETION_COLLECTION).doc(code);
      const providerRef = db.collection("providerIdentities")
        .doc(facebookProviderIdentityId(appId, payload.user_id));
      const uidSecret = facebookUidSecret.value();
      const plan = await db.runTransaction(async (transaction) => {
        const [receipt, providerSnapshot] = await Promise.all([
          transaction.get(receiptRef),
          transaction.get(providerRef),
        ]);
        if (receipt.exists) return resolveFacebookDeletionReceipt(receipt.data(), {
          providerIdentityId: providerRef.id,
          playerId: payload.user_id,
          uidSecret,
        });
        const identity = providerSnapshot.exists
          ? resolveFacebookCallbackDeletionIdentity(providerSnapshot.data(), {
              appId,
              playerId: payload.user_id,
              uidSecret,
            })
          : null;
        transaction.create(receiptRef, {
          schemaVersion: 1,
          status: "processing",
          providerIdentityId: providerRef.id,
          accountGeneration: identity?.accountGeneration ?? null,
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {complete: false, identity};
      });
      if (plan.complete) {
        respondWithConfirmation(response, code);
        return;
      }
      if (plan.identity) await deleteFacebookAccountGeneration(plan.identity, {uidSecret});
      await receiptRef.set({
        status: "complete",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      respondWithConfirmation(response, code);
    } catch (error) {
      logger.warn("Rejected Facebook data-deletion callback", {
        reason: error instanceof Error ? error.message : "invalid-request",
      });
      captureException(error, {firebaseFunction: "facebookDataDeletionCallback"});
      await flushSentry();
      const message = error instanceof Error ? error.message : "invalid-request";
      const status = message === "method-not-allowed" ? 405
        : message === "unsupported-media-type" ? 415
          : message === "payload-too-large" ? 413
            : 400;
      response.status(status).json({error: "invalid-request"});
    }
  },
);

/** PII-free status endpoint referenced by Meta's deletion confirmation response. */
export const facebookDataDeletionStatus = onRequestWithSentry(
  "facebookDataDeletionStatus",
  {invoker: "public"},
  async (request, response) => {
    applyDeletionHeaders(response);
    const code = typeof request.query.code === "string" ? request.query.code : "";
    if (request.method !== "GET" || !CODE_PATTERN.test(code)) {
      response.status(400).send("Invalid deletion confirmation code.");
      return;
    }
    const receipt = await admin.firestore().collection(DELETION_COLLECTION).doc(code).get();
    const complete = receipt.data()?.status === "complete";
    response.set("Content-Type", "text/plain; charset=utf-8");
    response.status(complete ? 200 : 202).send(complete
      ? "Riddle Quest account data deletion is complete."
      : "Riddle Quest account data deletion is still processing.");
  },
);
