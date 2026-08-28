import {createHmac} from "node:crypto";
import {
  facebookFirebaseUid,
  isFacebookFirebaseUid,
  verifyFacebookDeletionRequest,
  verifyFacebookSignedPlayer,
} from "../facebook/facebookSecurity";
import {jestFirebaseUid} from "../jest/jestSecurity";

/** Provides app secret behavior. */
const appSecret = "0123456789abcdef0123456789abcdef";
/** Provides uid secret behavior. */
const uidSecret = Buffer.alloc(32, 11).toString("base64");
/** Provides payload behavior. */
const payload = {
  algorithm: "HMAC-SHA256",
  issued_at: 1_000,
  player_id: "123456789",
  request_payload: "nonce_0123456789abcdef",
};
/** Provides sign behavior. */
const sign = (claims: object = payload, secret = appSecret) => {
  /** Provides encoded payload behavior. */
  const encodedPayload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  /** Provides signature behavior. */
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${signature}.${encodedPayload}`;
};
/** Provides options behavior. */
const options = {
  appSecret,
  configuredAppId: "meta-app-1",
  expectedAppId: "meta-app-1",
  expectedPlayerId: payload.player_id,
  expectedNonce: payload.request_payload,
  nowSeconds: 1_100,
  maxAgeSeconds: 300,
};

describe("Facebook signed-player security", () => {
  it("accepts a fresh assertion with exact app configuration, player, and nonce binding", async () => {
    await expect(verifyFacebookSignedPlayer(sign(), options)).resolves.toEqual(payload);
  });

  it.each([
    ["algorithm", {...payload, algorithm: "none"}, {}, "invalid-facebook-algorithm"],
    ["player", payload, {expectedPlayerId: "other"}, "facebook-player-id-mismatch"],
    ["nonce", payload, {expectedNonce: "other"}, "facebook-nonce-mismatch"],
    ["stale", payload, {nowSeconds: 2_000}, "stale-facebook-signed-player"],
    ["future", {...payload, issued_at: 1_161}, {}, "stale-facebook-signed-player"],
  ])("rejects %s mismatches", async (_name, claims, override, message) => {
    await expect(verifyFacebookSignedPlayer(sign(claims), {...options, ...override})).rejects.toThrow(message);
  });

  it("rejects signature tampering and a different app-specific secret", async () => {
    /** Provides token behavior. */
    const token = sign();
    await expect(verifyFacebookSignedPlayer(`${token.slice(0, -1)}x`, options)).rejects.toThrow(
      "invalid-facebook-signature",
    );
    await expect(
      verifyFacebookSignedPlayer(sign(payload, "abcdef0123456789abcdef0123456789"), options),
    ).rejects.toThrow("invalid-facebook-signature");
  });

  it("rejects app configuration mismatch before accepting the app-specific signature", async () => {
    await expect(verifyFacebookSignedPlayer(sign(), {...options, configuredAppId: "other-app"})).rejects.toThrow(
      "facebook-app-id-mismatch",
    );
  });

  it("consumes a nonce once and rejects replay", async () => {
    /** Provides consumed behavior. */
    const consumed = new Set<string>();
    /** Provides consume nonce behavior. */
    const consumeNonce = (nonce: string) => {
      if (consumed.has(nonce)) return false;
      consumed.add(nonce);
      return true;
    };
    await expect(verifyFacebookSignedPlayer(sign(), {...options, consumeNonce})).resolves.toEqual(payload);
    await expect(verifyFacebookSignedPlayer(sign(), {...options, consumeNonce})).rejects.toThrow(
      "facebook-nonce-replayed",
    );
  });

  it.each(["", "a.b.c", `a.${"a".repeat(8_193)}`, "*.payload"])(
    "rejects malformed or oversized assertions",
    async (token) => expect(verifyFacebookSignedPlayer(token, options)).rejects.toThrow(),
  );

  it("derives stable, provider-separated Facebook UIDs without changing Jest's golden UID", () => {
    /** Provides first behavior. */
    const first = facebookFirebaseUid(payload.player_id, uidSecret);
    expect(first).toMatch(/^facebook_[0-9a-f]{40}$/);
    expect(facebookFirebaseUid(payload.player_id, uidSecret)).toBe(first);
    expect(facebookFirebaseUid("987654321", uidSecret)).not.toBe(first);
    expect(facebookFirebaseUid(payload.player_id, uidSecret, 2)).not.toBe(first);
    expect(isFacebookFirebaseUid(first)).toBe(true);
    expect(isFacebookFirebaseUid(`facebook_${"A".repeat(40)}`)).toBe(false);
    expect(jestFirebaseUid("p1")).toBe("jest_19a97ec6b48b59dbb40220e4b6223f4a47e35532");
    expect(first).not.toBe(jestFirebaseUid(payload.player_id));
  });

  it("rejects invalid identity inputs and undersized UID secrets", () => {
    expect(() => facebookFirebaseUid("", uidSecret)).toThrow("invalid-facebook-player-id");
    expect(() => facebookFirebaseUid(payload.player_id, uidSecret, 0)).toThrow("invalid-facebook-account-generation");
    expect(() => facebookFirebaseUid(payload.player_id, Buffer.from("short").toString("base64"))).toThrow(
      "invalid-facebook-uid-secret",
    );
    expect(() => facebookFirebaseUid(payload.player_id, `${uidSecret}!`)).toThrow("invalid-facebook-uid-secret");
  });

  it("fails closed for unsafe assertion and verifier clocks", async () => {
    await expect(
      verifyFacebookSignedPlayer(sign({...payload, issued_at: Number.MAX_SAFE_INTEGER + 1}), options),
    ).rejects.toThrow("invalid-facebook-issued-at");
    await expect(verifyFacebookSignedPlayer(sign(), {...options, nowSeconds: Number.NaN})).rejects.toThrow(
      "invalid-facebook-verification-time",
    );
    await expect(verifyFacebookSignedPlayer(sign(), {...options, maxAgeSeconds: 0.5})).rejects.toThrow(
      "invalid-facebook-verification-time",
    );
  });
});

describe("Facebook data-deletion signed requests", () => {
  /** Provides deletion payload behavior. */
  const deletionPayload = {algorithm: "HMAC-SHA256", issued_at: 1_000, user_id: "123456789"};

  it("accepts only an app-secret-authenticated bounded player identity", () => {
    expect(verifyFacebookDeletionRequest(sign(deletionPayload), appSecret)).toEqual(deletionPayload);
    expect(() => verifyFacebookDeletionRequest(sign({...deletionPayload, algorithm: "none"}), appSecret)).toThrow(
      "invalid-facebook-algorithm",
    );
    expect(() => verifyFacebookDeletionRequest(sign({...deletionPayload, user_id: "bad id"}), appSecret)).toThrow(
      "invalid-facebook-player-id",
    );
    expect(() =>
      verifyFacebookDeletionRequest(sign({...deletionPayload, issued_at: Number.MAX_SAFE_INTEGER + 1}), appSecret),
    ).toThrow("invalid-facebook-issued-at");
  });

  it("rejects tampering, malformed input, and a different app secret", () => {
    /** Provides signed behavior. */
    const signed = sign(deletionPayload);
    expect(() => verifyFacebookDeletionRequest(`${signed.slice(0, -1)}x`, appSecret)).toThrow(
      "invalid-facebook-deletion-signature",
    );
    expect(() => verifyFacebookDeletionRequest(signed, "abcdef0123456789abcdef0123456789")).toThrow(
      "invalid-facebook-deletion-signature",
    );
    expect(() => verifyFacebookDeletionRequest("a.b.c", appSecret)).toThrow("invalid-facebook-deletion-request");
  });
});
