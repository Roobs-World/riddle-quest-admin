import {defineSecret} from "firebase-functions/params";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {runWithJestAccountOperationLease} from "../../../../firebase-functions/src/shared/accountDeletion";
import {onRequestWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {
  consumeRedditGatewayNonce,
  consumeRedditRequestQuota,
  parseRedditGatewayEnvelope,
  REDDIT_APP_NAME,
  redditProviderIdentityId,
  resolveRedditProviderIdentity,
} from "./redditEndpoints";
import {verifyRedditGatewayAssertion} from "./redditSecurity";
import {isRedditFeatureEnabled} from "./redditFeatureFlags";

/** Provides gateway secret behavior. */
const gatewaySecret = defineSecret("REDDIT_GATEWAY_SECRET");
/** Provides uid secret behavior. */
const uidSecret = defineSecret("REDDIT_UID_SECRET");
/** Provides options behavior. */
const options = {secrets: [gatewaySecret, uidSecret], invoker: "public" as const, timeoutSeconds: 60};
/** Renders the operations interface. */
const OPERATIONS = new Set(["storage.read", "storage.write", "storage.clear"]);
/** Defines the max body bytes value. */
const MAX_BODY_BYTES = 80 * 1_024;
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Parses reddit preferences. */
export function parseRedditPreferences(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("invalid-reddit-preferences");
  const {highContrast: obsoleteHighContrast, ...preferences} = value;
  if (obsoleteHighContrast !== undefined && typeof obsoleteHighContrast !== "boolean") {
    throw new Error("invalid-reddit-preferences");
  }
  /** Provides allowed behavior. */
  const allowed = new Set([
    "locale",
    "muted",
    "reducedMotion",
    "onboardingComplete",
    "firstMilestoneMarked",
    "presenceEnabled",
  ]);
  if (Object.keys(preferences).some((key) => !allowed.has(key))) throw new Error("invalid-reddit-preferences");
  if (
    preferences.locale !== undefined &&
    (typeof preferences.locale !== "string" || !/^[a-z]{2}(?:-[A-Z]{2})?$/u.test(preferences.locale))
  ) {
    throw new Error("invalid-reddit-preferences");
  }
  for (const key of [...allowed].filter((key) => key !== "locale")) {
    if (preferences[key] !== undefined && typeof preferences[key] !== "boolean") throw new Error("invalid-reddit-preferences");
  }
  return preferences;
}

/** Parses reddit player data. */
export function parseRedditPlayerData(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.updatedAt) ||
    (value.updatedAt as number) < 0 ||
    Buffer.byteLength(JSON.stringify(value), "utf8") > 48 * 1_024
  )
    throw new Error("invalid-reddit-player-data");
  /** Provides allowed behavior. */
  const allowed = new Set(["schemaVersion", "updatedAt", "profile", "activeGame"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("invalid-reddit-player-data");
  return value;
}

/** Parses write payload. */
const parseWritePayload = (payload: unknown) => {
  if (
    !isRecord(payload) ||
    Object.keys(payload).length < 1 ||
    Object.keys(payload).some((key) => key !== "preferences" && key !== "playerData")
  ) {
    throw new Error("invalid-reddit-storage-write");
  }
  return {
    ...(payload.preferences === undefined ? {} : {preferences: parseRedditPreferences(payload.preferences)}),
    ...(payload.playerData === undefined ? {} : {playerData: parseRedditPlayerData(payload.playerData)}),
  };
};

/** Provides reddit storage behavior. */
export const redditStorage = onRequestWithSentry("redditStorage", options, async (request, response) => {
  response.set("Cache-Control", "no-store");
  response.set("X-Content-Type-Options", "nosniff");
  if (request.method !== "POST") {
    response.status(405).json({error: "method-not-allowed"});
    return;
  }
  if (request.rawBody && request.rawBody.byteLength > MAX_BODY_BYTES) {
    response.status(413).json({error: "payload-too-large"});
    return;
  }
  if (!isRedditFeatureEnabled("identity")) {
    response.status(503).json({error: "reddit-feature-disabled:identity"});
    return;
  }
  try {
    /** Provides envelope behavior. */
    const envelope = parseRedditGatewayEnvelope(request.body);
    /** Provides operation behavior. */
    const operation =
      isRecord(envelope.assertion) && typeof envelope.assertion.operation === "string"
        ? envelope.assertion.operation
        : "";
    if (!OPERATIONS.has(operation)) throw new Error("invalid-reddit-storage-operation");
    /** Asserts ion. */
    const assertion = await verifyRedditGatewayAssertion(
      envelope.assertion,
      request.get("x-riddle-quest-reddit-signature") ?? "",
      {
        gatewaySecret: gatewaySecret.value(),
        expectedAppName: REDDIT_APP_NAME,
        expectedOperation: operation,
        expectedPayload: envelope.payload,
        consumeNonce: consumeRedditGatewayNonce,
      },
    );
    if (
      !(await consumeRedditRequestQuota(
        `${assertion.appName}\0${assertion.userId}\0${assertion.operation}`,
        gatewaySecret.value(),
      ))
    ) {
      response.status(429).json({error: "rate-limited"});
      return;
    }
    if (
      (operation === "storage.read" || operation === "storage.clear") &&
      (!isRecord(envelope.payload) || Object.keys(envelope.payload).length !== 0)
    ) {
      throw new Error("invalid-reddit-storage-payload");
    }
    /** Provides db behavior. */
    const db = admin.firestore();
    /** Provides provider behavior. */
    const provider = await db
      .collection("providerIdentities")
      .doc(redditProviderIdentityId(assertion.appName, assertion.userId))
      .get();
    /** Provides identity behavior. */
    const identity = resolveRedditProviderIdentity(provider.data(), {
      appName: assertion.appName,
      userId: assertion.userId,
      uidSecret: uidSecret.value(),
    });
    if (identity.needsUidRepair) throw new Error("reddit-session-refresh-required");
    /** Provides storage ref behavior. */
    const storageRef = db.collection("redditPlayerStorage").doc(identity.uid);
    /** Provides result behavior. */
    const result = await runWithJestAccountOperationLease(identity.uid, 60, async () => {
      if (operation === "storage.read") {
        /** Provides snapshot behavior. */
        const snapshot = await storageRef.get();
        /** Provides value behavior. */
        const value = snapshot.data();
        return {
          preferences: value?.preferences === undefined ? {} : parseRedditPreferences(value.preferences),
          playerData: value?.playerData === undefined ? null : parseRedditPlayerData(value.playerData),
        };
      }
      if (operation === "storage.clear") {
        await storageRef.delete();
        return {cleared: true};
      }
      /** Provides update behavior. */
      const update = parseWritePayload(envelope.payload);
      await storageRef.set({...update, updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
      return {written: true};
    });
    response.json({ok: true, ...result});
  } catch {
    response.status(401).json({error: "invalid-request"});
  }
});
