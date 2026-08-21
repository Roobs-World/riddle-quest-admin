import {createHash, createHmac} from "node:crypto";
import {logger} from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import {admin} from "../shared/firebaseAdmin";
import {onRequestWithSentry} from "../shared/sentryHandlers";
import {createReservedRedditUser} from "./redditUser";
import {MAX_REDDIT_ACCOUNT_GENERATION, redditFirebaseUid, verifyRedditGatewayAssertion} from "./redditSecurity";
import {deleteRedditAccountGeneration} from "./redditAccountDeletion";
import {isRedditFeatureEnabled, resolveRedditClientFeatures} from "./redditFeatureFlags";

/** Provides reddit gateway secret behavior. */
const redditGatewaySecret = defineSecret("REDDIT_GATEWAY_SECRET");
/** Provides reddit uid secret behavior. */
const redditUidSecret = defineSecret("REDDIT_UID_SECRET");
/** Provides options behavior. */
const options = {secrets: [redditGatewaySecret, redditUidSecret], invoker: "public" as const};
/** Defines the reddit app name value. */
export const REDDIT_APP_NAME = "riddle-quest";
/** Defines the nonce retention ms value. */
const NONCE_RETENTION_MS = 24 * 60 * 60 * 1_000;
/** Defines the rate limit retention ms value. */
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1_000;
/** Defines the rate limit window ms value. */
const RATE_LIMIT_WINDOW_MS = 60_000;
/** Defines the rate limit max value. */
const RATE_LIMIT_MAX = 20;
/** Defines the max body bytes value. */
const MAX_BODY_BYTES = 4_096;
/** Defines the reddit profile ttl ms value. */
const REDDIT_PROFILE_TTL_MS = 24 * 60 * 60 * 1_000;

/** Describes reddit profile input. */
export type RedditProfileInput = Readonly<{username: string; avatarUrl: string | null}>;
/** Describes reddit identity input. */
export type RedditIdentityInput = Readonly<{
  environment: "sandbox" | "production";
  profile?: RedditProfileInput;
}>;

/** Provides valid reddit avatar behavior. */
const validRedditAvatar = (value: unknown): value is string | null => {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      new Set(["www.redditstatic.com", "styles.redditmedia.com", "i.redd.it"]).has(url.hostname);
  } catch { return false; }
};

/** Parses reddit identity payload. */
export const parseRedditIdentityPayload = (payload: unknown): RedditIdentityInput => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("invalid-reddit-identity-payload");
  }
  const value = payload as Record<string, unknown>;
  if ((value.environment !== "sandbox" && value.environment !== "production") ||
    Object.keys(value).some((key) => key !== "environment" && key !== "profile")) {
    throw new Error("invalid-reddit-identity-payload");
  }
  if (!("profile" in value)) return {environment: value.environment};
  if (typeof value.profile !== "object" || value.profile === null || Array.isArray(value.profile)) {
    throw new Error("invalid-reddit-identity-payload");
  }
  const profile = value.profile as Record<string, unknown>;
  if (Object.keys(profile).length !== 2 || typeof profile.username !== "string" ||
    !/^[A-Za-z0-9_-]{3,20}$/.test(profile.username) || !validRedditAvatar(profile.avatarUrl)) {
    throw new Error("invalid-reddit-identity-payload");
  }
  return {environment: value.environment,
    profile: {username: profile.username, avatarUrl: profile.avatarUrl}};
};

/** Parses reddit gateway envelope. */
export const parseRedditGatewayEnvelope = (body: unknown): {assertion: unknown; payload: unknown} => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("invalid-reddit-gateway-envelope");
  const value = body as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || !("assertion" in value) || !("payload" in value)) {
    throw new Error("invalid-reddit-gateway-envelope");
  }
  return {assertion: value.assertion, payload: value.payload};
};

/** Provides reddit provider identity id behavior. */
export const redditProviderIdentityId = (appName: string, userId: string) => createHash("sha256")
  .update(`reddit\0${appName}\0${userId}`, "utf8").digest("hex");

/** Parses reddit deletion payload. */
export const parseRedditDeletionPayload = (payload: unknown): {accountGeneration: number} => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload) ||
    Object.keys(payload).length !== 1 || !("accountGeneration" in payload) ||
    !Number.isSafeInteger(payload.accountGeneration) || (payload.accountGeneration as number) < 1 ||
    (payload.accountGeneration as number) > MAX_REDDIT_ACCOUNT_GENERATION) {
    throw new Error("invalid-reddit-deletion-payload");
  }
  return {accountGeneration: payload.accountGeneration as number};
};

/** Provides valid timestamp behavior. */
const validTimestamp = (value: unknown): boolean => timestampMs(value) !== undefined;

/** Validates a provider record, including the intentional blank UID between deleted generations. */
export function resolveRedditProviderIdentity(
  value: unknown,
  {appName, userId, uidSecret}: {appName: string; userId: string; uidSecret: string},
): {accountGeneration: number; uid: string; needsUidRepair: boolean} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("reddit-provider-identity-conflict");
  const provider = value as Record<string, unknown>;
  if (provider.provider !== "reddit" || provider.appName !== appName || provider.providerUserId !== userId ||
    !Number.isSafeInteger(provider.accountGeneration) || (provider.accountGeneration as number) < 1 ||
    (provider.accountGeneration as number) > MAX_REDDIT_ACCOUNT_GENERATION || provider.status !== "active") {
    throw new Error("reddit-provider-identity-conflict");
  }
  const accountGeneration = provider.accountGeneration as number;
  const uid = redditFirebaseUid(userId, uidSecret, accountGeneration);
  if (provider.uid !== null && provider.uid !== uid) throw new Error("reddit-provider-identity-conflict");
  if (provider.uid === null) {
    if (accountGeneration <= 1 || !validTimestamp(provider.lastDeletedAt)) throw new Error("reddit-provider-identity-conflict");
    const priorUid = redditFirebaseUid(userId, uidSecret, accountGeneration - 1);
    if (provider.lastDeletedUidHash !== createHash("sha256").update(priorUid).digest("hex")) {
      throw new Error("reddit-provider-identity-conflict");
    }
  }
  return {accountGeneration, uid, needsUidRepair: provider.uid === null};
}

/** Provisions or resumes the exact Reddit account generation in one transaction. */
export async function provisionRedditIdentity(
  {appName, userId, uidSecret, profile}: {
    appName: string; userId: string; uidSecret: string; profile?: RedditProfileInput;
  },
  db: FirebaseFirestore.Firestore = admin.firestore(),
  nowMs = Date.now(),
): Promise<{uid: string; accountGeneration: number}> {
  const providerRef = db.collection("providerIdentities").doc(redditProviderIdentityId(appName, userId));
  let uid = "";
  let accountGeneration = 1;
  await db.runTransaction(async (transaction) => {
    const provider = await transaction.get(providerRef);
    const value = provider.data();
    let needsUidRepair = false;
    if (provider.exists) {
      const resolved = resolveRedditProviderIdentity(value, {appName, userId, uidSecret});
      accountGeneration = resolved.accountGeneration;
      needsUidRepair = resolved.needsUidRepair;
      uid = resolved.uid;
    }
    if (!provider.exists) uid = redditFirebaseUid(userId, uidSecret, accountGeneration);
    const userRef = db.collection("users").doc(uid);
    const user = await transaction.get(userRef);
    if (!provider.exists && user.exists) throw new Error("reddit-identity-provisioning-conflict");
    if (provider.exists && needsUidRepair && user.exists) throw new Error("reddit-identity-provisioning-conflict");
    if (provider.exists && !needsUidRepair && !user.exists) throw new Error("reddit-identity-provisioning-conflict");
    const profileUpdate = profile ? {redditProfile: {
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      refreshedAt: admin.firestore.Timestamp.fromMillis(nowMs),
      expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + REDDIT_PROFILE_TTL_MS),
    }} : {};
    if (!provider.exists) {
      transaction.create(providerRef, {
        provider: "reddit", appName, providerUserId: userId, uid,
        accountGeneration, status: "active", createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...profileUpdate,
      });
      transaction.create(userRef, createReservedRedditUser(transaction, db, uid));
    } else if (needsUidRepair) {
      transaction.update(providerRef, {uid, ...profileUpdate});
      transaction.create(userRef, createReservedRedditUser(transaction, db, uid));
    } else {
      if (profile) transaction.update(providerRef, profileUpdate);
      transaction.update(userRef, {lastLogin: nowMs});
    }
  });
  return {uid, accountGeneration};
}

/** Provides timestamp ms behavior. */
const timestampMs = (value: unknown): number | undefined => {
  if (typeof value !== "object" || value === null || !("toMillis" in value) ||
    typeof (value as {toMillis?: unknown}).toMillis !== "function") return undefined;
  try {
    const result = (value as {toMillis(): unknown}).toMillis();
    return typeof result === "number" && Number.isSafeInteger(result) && result >= 0 ? result : undefined;
  } catch { return undefined; }
};

/** Enforces one shared per-user/operation quota across Devvit and Functions instances. */
export async function consumeRedditRequestQuota(
  key: string,
  secret: string,
  db: FirebaseFirestore.Firestore = admin.firestore(),
  nowMs = Date.now(),
): Promise<boolean> {
  if (!key || Buffer.byteLength(key, "utf8") > 1_024 || Buffer.byteLength(secret, "utf8") < 32 ||
    !Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > Number.MAX_SAFE_INTEGER - RATE_LIMIT_RETENTION_MS - RATE_LIMIT_WINDOW_MS) {
    return false;
  }
  const id = createHmac("sha256", secret).update("riddle-quest-reddit-rate-v1\0").update(key).digest("hex");
  const ref = db.collection("redditGatewayRateLimits").doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const value = snapshot.data();
    const count = value?.count;
    const resetAtMs = value?.resetAtMs;
    if (snapshot.exists && (
      !Number.isSafeInteger(count) || (count as number) < 1 || (count as number) > RATE_LIMIT_MAX ||
      !Number.isSafeInteger(resetAtMs) || (resetAtMs as number) < 1 ||
      timestampMs(value?.expiresAt) !== (resetAtMs as number) + RATE_LIMIT_RETENTION_MS
    )) throw new Error("invalid-reddit-rate-limit-record");
    if (snapshot.exists && (resetAtMs as number) > nowMs) {
      if ((count as number) >= RATE_LIMIT_MAX) return false;
      transaction.update(ref, {count: (count as number) + 1});
      return true;
    }
    const nextResetAtMs = nowMs - (nowMs % RATE_LIMIT_WINDOW_MS) + RATE_LIMIT_WINDOW_MS;
    transaction.set(ref, {
      count: 1,
      resetAtMs: nextResetAtMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(nextResetAtMs + RATE_LIMIT_RETENTION_MS),
    });
    return true;
  });
}

/** Provides consume reddit gateway nonce behavior. */
export const consumeRedditGatewayNonce = async (assertion: {nonce: string; userId: string; issuedAtMs: number}): Promise<boolean> => {
  const db = admin.firestore();
  const ref = db.collection("redditGatewayNonces").doc(createHash("sha256").update(assertion.nonce).digest("hex"));
  try {
    await ref.create({
      userIdHash: createHash("sha256").update(assertion.userId).digest("hex"),
      issuedAtMs: assertion.issuedAtMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(assertion.issuedAtMs + NONCE_RETENTION_MS),
    });
    return true;
  } catch (error) {
    if ((error as {code?: unknown})?.code === 6 || (error as {code?: unknown})?.code === "already-exists") return false;
    throw error;
  }
};

/** Provides exchange reddit identity behavior. */
export const exchangeRedditIdentity = onRequestWithSentry("exchangeRedditIdentity", options, async (request, response) => {
  response.set("Cache-Control", "no-store");
  response.set("X-Content-Type-Options", "nosniff");
  if (request.method !== "POST") { response.status(405).json({error: "method-not-allowed"}); return; }
  if (request.rawBody && request.rawBody.byteLength > MAX_BODY_BYTES) { response.status(413).json({error: "payload-too-large"}); return; }
  if (!isRedditFeatureEnabled("identity")) { response.status(503).json({error: "reddit-feature-disabled:identity"}); return; }
  try {
    const signature = request.get("x-riddle-quest-reddit-signature") ?? "";
    const envelope = parseRedditGatewayEnvelope(request.body);
    const assertion = await verifyRedditGatewayAssertion(envelope.assertion, signature, {
      gatewaySecret: redditGatewaySecret.value(),
      expectedAppName: REDDIT_APP_NAME,
      expectedOperation: "identity.exchange",
      expectedPayload: envelope.payload,
      consumeNonce: consumeRedditGatewayNonce,
    });
    const db = admin.firestore();
    const identityInput = parseRedditIdentityPayload(envelope.payload);
    const quotaKey = `${assertion.appName}\0${assertion.userId}\0${assertion.operation}`;
    if (!await consumeRedditRequestQuota(quotaKey, redditGatewaySecret.value(), db)) {
      response.status(429).json({error: "rate-limited"});
      return;
    }
    const {accountGeneration} = await provisionRedditIdentity({
      appName: assertion.appName, userId: assertion.userId, uidSecret: redditUidSecret.value(),
      profile: identityInput.profile,
    }, db);
    response.json({ok: true, authenticated: true, accountGeneration,
      features: resolveRedditClientFeatures(undefined, undefined, identityInput.environment)});
  } catch (error) {
    logger.warn("Rejected Reddit gateway identity exchange", {reason: error instanceof Error ? error.message : "invalid-request"});
    response.status(401).json({error: "invalid-request"});
  }
});

/** Deletes reddit account. */
export const deleteRedditAccount = onRequestWithSentry("deleteRedditAccount", options, async (request, response) => {
  response.set("Cache-Control", "no-store");
  response.set("X-Content-Type-Options", "nosniff");
  if (request.method !== "POST") { response.status(405).json({error: "method-not-allowed"}); return; }
  if (request.rawBody && request.rawBody.byteLength > MAX_BODY_BYTES) { response.status(413).json({error: "payload-too-large"}); return; }
  try {
    const envelope = parseRedditGatewayEnvelope(request.body);
    const assertion = await verifyRedditGatewayAssertion(
      envelope.assertion,
      request.get("x-riddle-quest-reddit-signature") ?? "",
      {
        gatewaySecret: redditGatewaySecret.value(), expectedAppName: REDDIT_APP_NAME,
        expectedOperation: "account.delete", expectedPayload: envelope.payload, consumeNonce: consumeRedditGatewayNonce,
      },
    );
    const deletion = parseRedditDeletionPayload(envelope.payload);
    if (!await consumeRedditRequestQuota(
      `${assertion.appName}\0${assertion.userId}\0${assertion.operation}`,
      redditGatewaySecret.value(),
    )) { response.status(429).json({error: "rate-limited"}); return; }
    const nextGeneration = await deleteRedditAccountGeneration(
      {appName: assertion.appName, userId: assertion.userId, accountGeneration: deletion.accountGeneration},
      {uidSecret: redditUidSecret.value()},
    );
    response.json({ok: true, deleted: true, nextGeneration});
  } catch (error) {
    logger.warn("Rejected Reddit account deletion", {reason: error instanceof Error ? error.message : "invalid-request"});
    response.status(401).json({error: "invalid-request"});
  }
});
