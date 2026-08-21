import {createHmac, timingSafeEqual} from "node:crypto";

/** Defines the max signed player characters value. */
const MAX_SIGNED_PLAYER_CHARACTERS = 8_192;
/** Defines the max encoded part characters value. */
const MAX_ENCODED_PART_CHARACTERS = 6_144;
/** Defines the max player id characters value. */
const MAX_PLAYER_ID_CHARACTERS = 256;
/** Defines the max nonce characters value. */
const MAX_NONCE_CHARACTERS = 256;
/** Renders the base64 url interface. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;
/** Defines the max facebook account generation value. */
export const MAX_FACEBOOK_ACCOUNT_GENERATION = 1_000_000;

/** Describes facebook signed player payload. */
export type FacebookSignedPlayerPayload = {
  /** Stores algorithm. */
  algorithm: "HMAC-SHA256";
  /** Stores issued at. */
  issued_at: number;
  /** Stores player id. */
  player_id: string;
  /** Stores request payload. */
  request_payload: string;
};

/** Describes facebook signed player options. */
export type FacebookSignedPlayerOptions = {
  /** Stores app secret. */
  appSecret: string;
  /** Stores configured app id. */
  configuredAppId: string;
  /** Stores expected app id. */
  expectedAppId: string;
  /** Stores expected player id. */
  expectedPlayerId: string;
  /** Stores expected nonce. */
  expectedNonce: string;
  /** Stores now seconds. */
  nowSeconds?: number;
  /** Stores max age seconds. */
  maxAgeSeconds?: number;
  /** Stores consume nonce. */
  consumeNonce?: (nonce: string, playerId: string, issuedAt: number) => boolean | Promise<boolean>;
};

/** Provides decode base64 url behavior. */
const decodeBase64Url = (part: string): Buffer => {
  if (!part || part.length > MAX_ENCODED_PART_CHARACTERS || !BASE64URL.test(part)) {
    throw new Error("malformed-facebook-signed-player");
  }
  const decoded = Buffer.from(part, "base64url");
  if (!decoded.length || decoded.toString("base64url") !== part) {
    throw new Error("malformed-facebook-signed-player");
  }
  return decoded;
};

/** Provides equal text behavior. */
const equalText = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

/** Verifies one Meta signed-player assertion and consumes its exact request nonce. */
export async function verifyFacebookSignedPlayer(
  signedPlayer: string,
  options: FacebookSignedPlayerOptions,
): Promise<FacebookSignedPlayerPayload> {
  if (!signedPlayer || signedPlayer.length > MAX_SIGNED_PLAYER_CHARACTERS) {
    throw new Error("malformed-facebook-signed-player");
  }
  if (!options.expectedAppId || options.configuredAppId !== options.expectedAppId) {
    throw new Error("facebook-app-id-mismatch");
  }
  if (options.appSecret.length < 32) throw new Error("invalid-facebook-app-secret");
  if (
    !options.expectedNonce ||
    options.expectedNonce.length > MAX_NONCE_CHARACTERS ||
    !options.expectedPlayerId ||
    options.expectedPlayerId.length > MAX_PLAYER_ID_CHARACTERS
  ) {
    throw new Error("invalid-facebook-verification-input");
  }

  const parts = signedPlayer.split(".");
  if (parts.length !== 2) throw new Error("malformed-facebook-signed-player");
  const actualSignature = decodeBase64Url(parts[0]);
  const expectedSignature = createHmac("sha256", options.appSecret).update(parts[1]).digest();
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    throw new Error("invalid-facebook-signature");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decodeBase64Url(parts[1]).toString("utf8"));
  } catch (error) {
    if (error instanceof Error && error.message === "malformed-facebook-signed-player") throw error;
    throw new Error("malformed-facebook-signed-player");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("malformed-facebook-signed-player");
  }
  const claims = payload as Record<string, unknown>;
  if (claims.algorithm !== "HMAC-SHA256") throw new Error("invalid-facebook-algorithm");
  if (
    typeof claims.player_id !== "string" ||
    !claims.player_id ||
    claims.player_id.length > MAX_PLAYER_ID_CHARACTERS ||
    !/^[A-Za-z0-9_-]+$/.test(claims.player_id)
  ) throw new Error("invalid-facebook-player-id");
  if (!equalText(claims.player_id, options.expectedPlayerId)) throw new Error("facebook-player-id-mismatch");
  if (
    typeof claims.request_payload !== "string" ||
    !claims.request_payload ||
    claims.request_payload.length > MAX_NONCE_CHARACTERS ||
    !equalText(claims.request_payload, options.expectedNonce)
  ) throw new Error("facebook-nonce-mismatch");
  if (!Number.isSafeInteger(claims.issued_at) || (claims.issued_at as number) < 0) {
    throw new Error("invalid-facebook-issued-at");
  }
  const issuedAt = claims.issued_at as number;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxAgeSeconds = options.maxAgeSeconds ?? 300;
  if (
    !Number.isSafeInteger(nowSeconds) ||
    nowSeconds < 0 ||
    !Number.isSafeInteger(maxAgeSeconds) ||
    maxAgeSeconds < 1
  ) {
    throw new Error("invalid-facebook-verification-time");
  }
  if (issuedAt > nowSeconds + 60 || nowSeconds - issuedAt > maxAgeSeconds) {
    throw new Error("stale-facebook-signed-player");
  }
  if (options.consumeNonce && !await options.consumeNonce(options.expectedNonce, claims.player_id, issuedAt)) {
    throw new Error("facebook-nonce-replayed");
  }
  return claims as FacebookSignedPlayerPayload;
}

/** Derives a stable provider-scoped UID using a dedicated, rotatable v1 key. */
export function facebookFirebaseUid(playerId: string, uidSecretBase64: string, accountGeneration = 1): string {
  if (!playerId || playerId.length > MAX_PLAYER_ID_CHARACTERS || !/^[A-Za-z0-9_-]+$/.test(playerId)) {
    throw new Error("invalid-facebook-player-id");
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(uidSecretBase64)) {
    throw new Error("invalid-facebook-uid-secret");
  }
  const secret = Buffer.from(uidSecretBase64, "base64");
  if (secret.length < 32 || secret.toString("base64") !== uidSecretBase64) {
    throw new Error("invalid-facebook-uid-secret");
  }
  if (
    !Number.isSafeInteger(accountGeneration) ||
    accountGeneration < 1 ||
    accountGeneration > MAX_FACEBOOK_ACCOUNT_GENERATION
  ) {
    throw new Error("invalid-facebook-account-generation");
  }
  const digest = createHmac("sha256", secret)
    .update("riddle-quest-facebook-uid-v1\0", "utf8")
    .update(String(accountGeneration), "utf8")
    .update("\0", "utf8")
    .update(playerId, "utf8")
    .digest("hex")
    .slice(0, 40);
  return `facebook_${digest}`;
}

/** Indicates whether is facebook firebase uid. */
export const isFacebookFirebaseUid = (userId: string): boolean => /^facebook_[0-9a-f]{40}$/.test(userId);

/** Describes facebook deletion payload. */
export type FacebookDeletionPayload = {
  /** Stores algorithm. */
  algorithm: "HMAC-SHA256";
  /** Stores user id. */
  user_id: string;
  /** Stores issued at. */
  issued_at?: number;
};

/** Verifies Meta's app-level data-deletion signed_request without trusting form fields. */
export function verifyFacebookDeletionRequest(signedRequest: string, appSecret: string): FacebookDeletionPayload {
  if (!signedRequest || signedRequest.length > MAX_SIGNED_PLAYER_CHARACTERS || appSecret.length < 32) {
    throw new Error("invalid-facebook-deletion-request");
  }
  const parts = signedRequest.split(".");
  if (parts.length !== 2) throw new Error("invalid-facebook-deletion-request");
  const actualSignature = decodeBase64Url(parts[0]);
  const expectedSignature = createHmac("sha256", appSecret).update(parts[1]).digest();
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    throw new Error("invalid-facebook-deletion-signature");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(decodeBase64Url(parts[1]).toString("utf8"));
  } catch {
    throw new Error("invalid-facebook-deletion-request");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid-facebook-deletion-request");
  }
  const claims = payload as Record<string, unknown>;
  if (claims.algorithm !== "HMAC-SHA256") throw new Error("invalid-facebook-algorithm");
  if (
    typeof claims.user_id !== "string" ||
    !claims.user_id ||
    claims.user_id.length > MAX_PLAYER_ID_CHARACTERS ||
    !/^[A-Za-z0-9_-]+$/.test(claims.user_id)
  ) throw new Error("invalid-facebook-player-id");
  if (claims.issued_at !== undefined &&
    (!Number.isSafeInteger(claims.issued_at) || (claims.issued_at as number) < 0)) {
    throw new Error("invalid-facebook-issued-at");
  }
  return claims as FacebookDeletionPayload;
}
