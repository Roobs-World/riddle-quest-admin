import {createHmac} from "node:crypto";
import {jestFirebaseUid, verifyJestSigned} from "../jest/jestSecurity";

const secret = Buffer.alloc(32, 7).toString("base64");
const sign = (payload: object, alg = "HS256") => {
  const header = Buffer.from(JSON.stringify({alg, typ: "JWT"})).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", Buffer.from(secret, "base64")).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
};

describe("Jest signed verification", () => {
  const payload = {aud: "game", sub: "p1", iat: 1000, player: {playerId: "p1", registered: false}};
  it("accepts a valid fresh HS256 token", () => expect(verifyJestSigned(sign(payload), secret, "game", "p1", 1100, 900)).toMatchObject(payload));
  it.each([
    ["algorithm", () => verifyJestSigned(sign(payload, "none"), secret, "game", "p1", 1100)],
    ["signature", () => verifyJestSigned(`${sign(payload).slice(0, -1)}x`, secret, "game", "p1", 1100)],
    ["audience", () => verifyJestSigned(sign(payload), secret, "other", "p1", 1100)],
    ["subject", () => verifyJestSigned(sign(payload), secret, "game", "p2", 1100)],
    ["freshness", () => verifyJestSigned(sign(payload), secret, "game", "p1", 3000, 900)],
  ])("rejects invalid %s", (_name, verify) => expect(verify).toThrow());
  it("creates stable scoped Firebase UIDs", () => expect(jestFirebaseUid("p1")).toBe(jestFirebaseUid("p1")));
  it("accepts signed referral payloads without iat when freshness is not requested", () =>
    expect(verifyJestSigned(sign({aud: "game", sub: "p1", referrals: {campaign: []}}), secret, "game", "p1")).toMatchObject({sub: "p1"}));
  it("rejects oversized signed payloads before decoding them", () =>
    expect(() => verifyJestSigned(`a.${"a".repeat(256_001)}.a`, secret, "game")).toThrow("malformed-token"));
});
