import {createHmac, timingSafeEqual} from "node:crypto";

/** Defines the max signed token characters value. */
const MAX_SIGNED_TOKEN_CHARACTERS = 256_000;
/** Defines the max signed part bytes value. */
const MAX_SIGNED_PART_BYTES = 128_000;

/** Describes jest signed payload. */
export type JestSignedPayload = {
  /** Stores aud. */
  aud: string;
  /** Stores sub. */
  sub: string;
  /** Stores iat. */
  iat?: number;
  /** Stores player. */
  player?: {
    /** Stores player id. */
    playerId: string; /** Stores registered. */
    /** Stores registered. */
    registered: boolean;
  };
  /** Documents default export. */
  [key: string]: unknown;
};

/** Provides decode part behavior. */
const decodePart = (part: string): unknown => {
  if (!part || part.length > MAX_SIGNED_TOKEN_CHARACTERS) throw new Error("malformed-token");
  /** Provides decoded behavior. */
  const decoded = Buffer.from(part, "base64url");
  if (decoded.length === 0 || decoded.length > MAX_SIGNED_PART_BYTES) throw new Error("malformed-token");
  return JSON.parse(decoded.toString("utf8"));
};

/** Provides verify jest signed behavior. */
export function verifyJestSigned(
  token: string,
  secretBase64: string,
  expectedGameId: string,
  expectedPlayerId?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds: number | null = null,
): JestSignedPayload {
  if (token.length === 0 || token.length > MAX_SIGNED_TOKEN_CHARACTERS) throw new Error("malformed-token");
  /** Provides parts behavior. */
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed-token");
  /** Provides header behavior. */
  const header = decodePart(parts[0]) as {
    /** Stores alg. */
    alg?: unknown; /** Stores typ. */
    /** Stores typ. */
    typ?: unknown;
  };
  if (header.alg !== "HS256") throw new Error("invalid-algorithm");

  /** Provides secret behavior. */
  const secret = Buffer.from(secretBase64, "base64");
  if (secret.length < 32) throw new Error("invalid-secret");
  /** Provides expected behavior. */
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  /** Provides actual behavior. */
  const actual = Buffer.from(parts[2], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("invalid-signature");

  /** Provides payload behavior. */
  const payload = decodePart(parts[1]) as JestSignedPayload;
  if (payload.aud !== expectedGameId) throw new Error("invalid-audience");
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("invalid-subject");
  if (expectedPlayerId && payload.sub !== expectedPlayerId) throw new Error("invalid-subject");
  if (payload.exp !== undefined &&
    (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= nowSeconds)) {
    throw new Error("expired-token");
  }
  if (payload.nbf !== undefined &&
    (typeof payload.nbf !== "number" || !Number.isFinite(payload.nbf) || payload.nbf > nowSeconds)) {
    throw new Error("token-not-active");
  }
  if (maxAgeSeconds !== null) {
    /** Provides issued at behavior. */
    const issuedAt = payload.iat;
    if (
      typeof issuedAt !== "number" ||
      !Number.isInteger(issuedAt) ||
      issuedAt > nowSeconds + 60 ||
      nowSeconds - issuedAt > maxAgeSeconds
    ) {
      throw new Error("stale-token");
    }
  }
  if (payload.player && payload.player.playerId !== payload.sub) throw new Error("player-subject-mismatch");
  return payload;
}

/** Provides jest firebase uid behavior. */
export const jestFirebaseUid = (playerId: string, accountGeneration = 1): string => {
  if (!Number.isSafeInteger(accountGeneration) || accountGeneration < 1) throw new Error("invalid-jest-generation");
  const identity = accountGeneration === 1 ? playerId : `${playerId}\0generation:${accountGeneration}`;
  return `jest_${createHmac("sha256", "riddle-quest-jest-uid-v1").update(identity).digest("hex").slice(0, 40)}`;
};

export const jestGenerationFromClaims = (claims: Record<string, unknown>): number => {
  const generation = claims.jestAccountGeneration ?? 1;
  if (typeof generation !== "number" || !Number.isSafeInteger(generation) || generation < 1) {
    throw new Error("invalid-jest-generation");
  }
  return generation;
};

/** Returns whether a Firebase UID belongs to the deterministic Jest identity namespace. */
export const isJestFirebaseUid = (userId: string): boolean => /^jest_[0-9a-f]{40}$/.test(userId);
