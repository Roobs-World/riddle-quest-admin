import {generateKeyPairSync} from "node:crypto";
import {cert, deleteApp, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {facebookCustomAuthClaims} from "../facebookEndpoints";

/** Provides decode payload behavior. */
const decodePayload = (token: string): Record<string, unknown> => {
  /** Provides encoded behavior. */
  const encoded = token.split(".")[1];
  if (!encoded) throw new Error("missing-jwt-payload");
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
};

describe("Facebook custom-auth claims", () => {
  it("signs a token whose only custom claims are provider and account generation", async () => {
    /** Provides {private key} behavior. */
    const {privateKey} = generateKeyPairSync("rsa", {modulusLength: 2048});
    /** Provides app behavior. */
    const app = initializeApp(
      {
        credential: cert({
          projectId: "facebook-claims-test",
          clientEmail: "claims@facebook-claims-test.iam.gserviceaccount.com",
          privateKey: privateKey.export({type: "pkcs8", format: "pem"}).toString(),
        }),
      },
      `facebook-claims-${Date.now()}`,
    );
    try {
      /** Provides token behavior. */
      const token = await getAuth(app).createCustomToken(`facebook_${"a".repeat(40)}`, facebookCustomAuthClaims(7));
      /** Provides payload behavior. */
      const payload = decodePayload(token);
      expect(payload.uid).toBe(`facebook_${"a".repeat(40)}`);
      expect(payload.claims).toEqual({provider: "facebook", accountGeneration: 7});
      expect(JSON.stringify(payload)).not.toMatch(/playerId|providerPlayerId|name|photo/i);
    } finally {
      await deleteApp(app);
    }
  });

  it.each([0, -1, 1.5, Number.NaN, 1_000_001])("rejects invalid account generation %s", (value) => {
    expect(() => facebookCustomAuthClaims(value)).toThrow("invalid-facebook-account-generation");
  });
});
