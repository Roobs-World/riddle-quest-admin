import {createHmac} from "node:crypto";
import {isJestFirebaseUid, jestFirebaseUid, verifyJestSigned} from "../jest/jestSecurity";

/** Provides secret behavior. */
const secret = Buffer.alloc(32, 7).toString("base64");
/** Provides sign behavior. */
const sign = (payload: object, alg = "HS256") => {
  /** Provides header behavior. */
  const header = Buffer.from(JSON.stringify({alg, typ: "JWT"})).toString("base64url");
  /** Provides body behavior. */
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  /** Provides signature behavior. */
  const signature = createHmac("sha256", Buffer.from(secret, "base64")).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
};

describe("Jest signed verification", () => {
  /** Provides payload behavior. */
  const payload = {aud: "game", sub: "p1", iat: 1000, player: {playerId: "p1", registered: false}};
  it("accepts a valid fresh HS256 token", () =>
    expect(verifyJestSigned(sign(payload), secret, "game", "p1", 1100, 900)).toMatchObject(payload));
  it.each([
    ["algorithm", () => verifyJestSigned(sign(payload, "none"), secret, "game", "p1", 1100)],
    ["signature", () => verifyJestSigned(`${sign(payload).slice(0, -1)}x`, secret, "game", "p1", 1100)],
    ["audience", () => verifyJestSigned(sign(payload), secret, "other", "p1", 1100)],
    ["subject", () => verifyJestSigned(sign(payload), secret, "game", "p2", 1100)],
    ["freshness", () => verifyJestSigned(sign(payload), secret, "game", "p1", 3000, 900)],
  ])("rejects invalid %s", (_name, verify) => expect(verify).toThrow());
  it("creates stable scoped Firebase UIDs", () => expect(jestFirebaseUid("p1")).toBe(jestFirebaseUid("p1")));

  it("recognizes only canonical deterministic Jest Firebase UIDs", () => {
    expect(isJestFirebaseUid(jestFirebaseUid("p1"))).toBe(true);
    expect(isJestFirebaseUid("firebase-user")).toBe(false);
    expect(isJestFirebaseUid(`jest_${"A".repeat(40)}`)).toBe(false);
  });
  it("accepts signed referral payloads without iat when freshness is not requested", () =>
    expect(
      verifyJestSigned(sign({aud: "game", sub: "p1", referrals: {campaign: []}}), secret, "game", "p1"),
    ).toMatchObject({sub: "p1"}));
  it("accepts signed claims during their validity window", () =>
    expect(verifyJestSigned(sign({...payload, nbf: 1_000, exp: 1_101}), secret, "game", "p1", 1_100))
      .toMatchObject({sub: "p1", nbf: 1_000, exp: 1_101}));
  it.each([
    [{exp: 1_099}, "expired-token"],
    [{exp: 1_100}, "expired-token"],
    [{exp: "1200"}, "expired-token"],
    [{exp: null}, "expired-token"],
    [{nbf: 1_101}, "token-not-active"],
    [{nbf: "1000"}, "token-not-active"],
    [{nbf: null}, "token-not-active"],
  ])("rejects expired, premature, or malformed validity claims", (claims, message) =>
    expect(() => verifyJestSigned(sign({...payload, ...claims}), secret, "game", "p1", 1_100)).toThrow(message));
  it("rejects oversized signed payloads before decoding them", () =>
    expect(() => verifyJestSigned(`a.${"a".repeat(256_001)}.a`, secret, "game")).toThrow("malformed-token"));

  it.each(["", "a.b", "a.b.c.d", "x".repeat(256_001)])("rejects malformed token structure", (token) =>
    expect(() => verifyJestSigned(token, secret, "game")).toThrow("malformed-token"),
  );

  it("rejects malformed, empty, and oversized encoded parts", () => {
    expect(() => verifyJestSigned(`.${sign(payload).split(".")[1]}.x`, secret, "game")).toThrow("malformed-token");
    expect(() => verifyJestSigned(`${Buffer.from("not-json").toString("base64url")}.x.x`, secret, "game")).toThrow();
    expect(() => verifyJestSigned(`${"A".repeat(170_668)}.x.x`, secret, "game")).toThrow("malformed-token");
  });

  it("rejects short secrets and signatures with the wrong byte length", () => {
    expect(() => verifyJestSigned(sign(payload), Buffer.from("short").toString("base64"), "game")).toThrow(
      "invalid-secret",
    );
    /** Provides [header, body] behavior. */
    const [header, body] = sign(payload).split(".");
    expect(() => verifyJestSigned(`${header}.${body}.eA`, secret, "game")).toThrow("invalid-signature");
  });

  it.each([
    [{aud: "game", sub: ""}, "invalid-subject"],
    [{aud: "game", sub: 42}, "invalid-subject"],
    [{aud: "game", sub: "p1", iat: 1_000, player: {playerId: "p2", registered: false}}, "player-subject-mismatch"],
    [{aud: "game", sub: "p1"}, "stale-token"],
    [{aud: "game", sub: "p1", iat: 1.5}, "stale-token"],
    [{aud: "game", sub: "p1", iat: 1_161}, "stale-token"],
  ])("rejects invalid payload claims", (claims, message) => {
    expect(() => verifyJestSigned(sign(claims), secret, "game", undefined, 1_100, 900)).toThrow(message);
  });
});
