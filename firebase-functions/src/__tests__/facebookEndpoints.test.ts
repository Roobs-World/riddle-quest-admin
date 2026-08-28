import type {Request} from "firebase-functions/v2/https";
import {createHash} from "node:crypto";
import {
  acceptFacebookRequest,
  allowFacebookRequest,
  applyFacebookCors,
  isAllowedFacebookOrigin,
  parseFacebookExchangeBody,
  resolveFacebookIdentityProvisioning,
  resolveFacebookProviderIdentity,
} from "../facebook/facebookEndpoints";
import {createFacebookUser} from "../facebook/facebookUser";
import {
  facebookDeletionConfirmationCode,
  parseFacebookDeletionBody,
  resolveFacebookCallbackDeletionIdentity,
  resolveFacebookDeletionReceipt,
} from "../facebook/facebookDataDeletionEndpoints";
import {facebookFirebaseUid} from "../facebook/facebookSecurity";

/** Provides request behavior. */
const request = (input: {
  /** Stores origin. */
  origin?: string;
  /** Stores method. */
  method?: string;
  /** Stores json. */
  json?: boolean;
  /** Stores media. */
  media?: string;
  /** Stores ip. */
  ip?: string;
  /** Stores raw body bytes. */
  rawBodyBytes?: number;
  /** Stores body. */
  body?: unknown;
}): Request =>
  ({
    get: (name: string) => (name.toLowerCase() === "origin" ? input.origin : undefined),
    method: input.method ?? "POST",
    is: (type: string) => (input.media ? type === input.media : input.json !== false && type === "application/json"),
    ip: input.ip ?? "facebook-endpoint-test",
    rawBody: input.rawBodyBytes === undefined ? undefined : Buffer.alloc(input.rawBodyBytes),
    body: input.body,
  }) as Request;

/** Provides response behavior. */
const response = () => {
  /** Provides result behavior. */
  const result = {
    headers: new Map<string, string>(),
    statusCode: 200,
    body: undefined as unknown,
    /** Provides set behavior. */
    set(name: string, value: string) {
      result.headers.set(name, value);
      return result;
    },
    /** Provides status behavior. */
    status(code: number) {
      result.statusCode = code;
      return result;
    },
    /** Provides json behavior. */
    json(body: unknown) {
      result.body = body;
      return result;
    },
    /** Provides send behavior. */
    send(body: string) {
      result.body = body;
      return result;
    },
  };
  return result;
};

describe("Facebook endpoint boundary", () => {
  /** Provides previous origins behavior. */
  const previousOrigins = process.env.FACEBOOK_GAME_ORIGINS;

  beforeAll(() => {
    process.env.FACEBOOK_GAME_ORIGINS = "https://meta.example,https://messenger.example";
  });

  afterAll(() => {
    if (previousOrigins === undefined) delete process.env.FACEBOOK_GAME_ORIGINS;
    else process.env.FACEBOOK_GAME_ORIGINS = previousOrigins;
  });

  it("uses only exact configured origins and emits no wildcard", () => {
    /** Provides headers behavior. */
    const headers = new Map<string, string>();
    applyFacebookCors({set: (name, value) => headers.set(name, value)}, "https://meta.example");
    expect(isAllowedFacebookOrigin("https://meta.example")).toBe(true);
    expect(isAllowedFacebookOrigin("https://attacker.example")).toBe(false);
    expect(Object.fromEntries(headers)).toMatchObject({
      "Access-Control-Allow-Origin": "https://meta.example",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    });
  });

  it("ignores wildcard, insecure, credentialed, and non-origin allowlist entries", () => {
    process.env.FACEBOOK_GAME_ORIGINS = [
      "*",
      "http://meta.example",
      "https://meta.example/path",
      "https://user@meta.example",
      "https://meta.example/",
      "https://valid.example",
    ].join(",");
    expect(isAllowedFacebookOrigin("https://valid.example")).toBe(true);
    expect(isAllowedFacebookOrigin("https://meta.example")).toBe(false);
    expect(isAllowedFacebookOrigin("http://meta.example")).toBe(false);
    expect(isAllowedFacebookOrigin("*")).toBe(false);
    process.env.FACEBOOK_GAME_ORIGINS = "https://meta.example,https://messenger.example";
  });

  it.each([
    ["missing origin", request({}), 403, {error: "forbidden-origin"}],
    ["untrusted origin", request({origin: "https://attacker.example"}), 403, {error: "forbidden-origin"}],
    ["wrong method", request({origin: "https://meta.example", method: "GET"}), 405, {error: "method-not-allowed"}],
    ["wrong media", request({origin: "https://meta.example", json: false}), 415, {error: "unsupported-media-type"}],
    [
      "oversized",
      request({origin: "https://meta.example", rawBodyBytes: 24 * 1_024 + 1}),
      413,
      {error: "payload-too-large"},
    ],
  ])("rejects %s", (_name, candidate, statusCode, body) => {
    /** Provides output behavior. */
    const output = response();
    expect(acceptFacebookRequest(candidate, output)).toBe(false);
    expect(output).toMatchObject({statusCode, body});
  });

  it("handles preflight and accepts a trusted JSON POST", () => {
    /** Provides preflight behavior. */
    const preflight = response();
    expect(acceptFacebookRequest(request({origin: "https://meta.example", method: "OPTIONS"}), preflight)).toBe(false);
    expect(preflight).toMatchObject({statusCode: 204, body: ""});
    expect(acceptFacebookRequest(request({origin: "https://meta.example", ip: "facebook-valid"}), response())).toBe(
      true,
    );
  });

  it("rate limits repeated requests without weakening other origins", () => {
    /** Provides candidate behavior. */
    const candidate = request({origin: "https://meta.example", ip: "facebook-rate-limit"});
    for (let index = 0; index < 20; index += 1) {
      expect(acceptFacebookRequest(candidate, response())).toBe(true);
    }
    /** Provides output behavior. */
    const output = response();
    expect(acceptFacebookRequest(candidate, output)).toBe(false);
    expect(output).toMatchObject({statusCode: 429, body: {error: "rate-limited"}});
    expect(allowFacebookRequest("invalid-clock", Number.NaN)).toBe(false);
    expect(allowFacebookRequest("overflow-clock", Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it("accepts only the exact bounded exchange fields", () => {
    /** Provides valid behavior. */
    const valid = {signedPlayer: "signature.payload", playerId: "123", nonce: "nonce"};
    expect(parseFacebookExchangeBody(valid)).toEqual(valid);
    expect(() => parseFacebookExchangeBody({...valid, extra: "no"})).toThrow("invalid-request");
    expect(() => parseFacebookExchangeBody({...valid, nonce: ""})).toThrow("invalid-request");
    expect(() => parseFacebookExchangeBody({...valid, playerId: 123})).toThrow("invalid-request");
  });

  it("fails closed for malformed or cross-app provider identity records", () => {
    /** Provides uid secret behavior. */
    const uidSecret = Buffer.alloc(32, 7).toString("base64");
    /** Provides prior uid behavior. */
    const priorUid = facebookFirebaseUid("player-1", uidSecret, 1);
    /** Provides base behavior. */
    const base = {
      provider: "facebook",
      appId: "app-1",
      providerPlayerId: "player-1",
      accountGeneration: 2,
      status: "active",
      uid: null,
      lastDeletedUidHash: createHash("sha256").update(priorUid).digest("hex"),
      lastDeletedAt: {toMillis: () => 1_700_000_000_000},
    };
    /** Resolves d. */
    const resolved = resolveFacebookProviderIdentity(base, {appId: "app-1", playerId: "player-1", uidSecret});
    expect(resolved).toMatchObject({accountGeneration: 2, needsUidRepair: true});
    expect(resolved.uid).toMatch(/^facebook_[0-9a-f]{40}$/);

    for (const corrupt of [
      {...base, appId: "other-app"},
      {...base, providerPlayerId: "other-player"},
      {...base, accountGeneration: undefined},
      {...base, accountGeneration: 1.5},
      {...base, accountGeneration: 1_000_001},
      {...base, status: "unknown"},
      {...base, uid: `facebook_${"f".repeat(40)}`},
      {...base, lastDeletedUidHash: "f".repeat(64)},
      {...base, lastDeletedAt: null},
      {...base, accountGeneration: 1},
    ]) {
      expect(() =>
        resolveFacebookProviderIdentity(corrupt, {
          appId: "app-1",
          playerId: "player-1",
          uidSecret,
        }),
      ).toThrow("facebook-provider-identity-conflict");
    }
    expect(() =>
      resolveFacebookProviderIdentity(
        {...base, status: "deleting"},
        {
          appId: "app-1",
          playerId: "player-1",
          uidSecret,
        },
      ),
    ).toThrow("facebook-account-deletion-in-progress");
  });

  it("creates users only for atomic new or blank-generation transitions", () => {
    expect(
      resolveFacebookIdentityProvisioning({
        providerExists: false,
        needsUidRepair: false,
        userExists: false,
      }),
    ).toBe("new_identity");
    expect(
      resolveFacebookIdentityProvisioning({
        providerExists: true,
        needsUidRepair: true,
        userExists: false,
      }),
    ).toBe("fresh_generation");
    expect(
      resolveFacebookIdentityProvisioning({
        providerExists: true,
        needsUidRepair: false,
        userExists: true,
      }),
    ).toBe("existing_identity");

    for (const corrupt of [
      {providerExists: false, needsUidRepair: false, userExists: true},
      {providerExists: false, needsUidRepair: true, userExists: false},
      {providerExists: true, needsUidRepair: true, userExists: true},
      {providerExists: true, needsUidRepair: false, userExists: false},
    ]) {
      expect(() => resolveFacebookIdentityProvisioning(corrupt)).toThrow("facebook-identity-provisioning-conflict");
    }
  });

  it("creates a game-owned profile without Meta names, photos, or player IDs", () => {
    /** Provides r. */
    const user = createFacebookUser(`facebook_${"a".repeat(40)}`);
    expect(user).toMatchObject({coins: 300, preferredLanguage: "en", hasActiveSubscription: false});
    expect(JSON.stringify(user)).not.toContain("123456789");
    expect(user).not.toHaveProperty("providerPlayerId");
    expect(user).not.toHaveProperty("photo");
  });

  it("accepts only Meta's bounded form-encoded deletion callback shape", () => {
    /** Provides signed request behavior. */
    const signedRequest = "signature.payload";
    expect(
      parseFacebookDeletionBody(
        request({
          media: "application/x-www-form-urlencoded",
          body: {signed_request: signedRequest},
        }) as Request & {
          /** Provides is behavior. */
          is(type: string): boolean;
        },
      ),
    ).toBe(signedRequest);
    /** Provides wrong media behavior. */
    const wrongMedia = request({body: {signed_request: signedRequest}});
    expect(() => parseFacebookDeletionBody(wrongMedia)).toThrow("unsupported-media-type");
    /** Provides extra behavior. */
    const extra = request({
      media: "application/x-www-form-urlencoded",
      body: {signed_request: signedRequest, extra: "no"},
    });
    expect(() => parseFacebookDeletionBody(extra)).toThrow("invalid-request");
  });

  it("derives stable opaque deletion confirmation codes from the signed request", () => {
    /** Provides secret behavior. */
    const secret = "0123456789abcdef0123456789abcdef";
    /** Provides code behavior. */
    const code = facebookDeletionConfirmationCode("signature.payload", secret);
    expect(code).toMatch(/^[0-9a-f]{32}$/);
    expect(facebookDeletionConfirmationCode("signature.payload", secret)).toBe(code);
    expect(facebookDeletionConfirmationCode("signature.other", secret)).not.toBe(code);
  });

  it("restores only the generation frozen into a valid deletion callback receipt", () => {
    /** Provides uid secret behavior. */
    const uidSecret = Buffer.alloc(32, 17).toString("base64");
    /** Provides timestamp behavior. */
    const timestamp = {toMillis: () => 1_700_000_000_000};
    /** Provides processing behavior. */
    const processing = {
      schemaVersion: 1,
      status: "processing",
      providerIdentityId: "provider-hash",
      accountGeneration: 3,
      requestedAt: timestamp,
    };
    expect(
      resolveFacebookDeletionReceipt(processing, {
        providerIdentityId: "provider-hash",
        playerId: "player-1",
        uidSecret,
      }),
    ).toEqual({
      complete: false,
      identity: {uid: facebookFirebaseUid("player-1", uidSecret, 3), accountGeneration: 3},
    });
    expect(
      resolveFacebookDeletionReceipt(
        {
          ...processing,
          status: "complete",
          completedAt: timestamp,
        },
        {
          providerIdentityId: "provider-hash",
          playerId: "player-1",
          uidSecret,
        },
      ),
    ).toEqual({
      complete: true,
      identity: {uid: facebookFirebaseUid("player-1", uidSecret, 3), accountGeneration: 3},
    });
    expect(
      resolveFacebookDeletionReceipt(
        {...processing, accountGeneration: null},
        {
          providerIdentityId: "provider-hash",
          playerId: "player-1",
          uidSecret,
        },
      ),
    ).toEqual({complete: false, identity: null});

    for (const corrupt of [
      {...processing, schemaVersion: 2},
      {...processing, providerIdentityId: "other"},
      {...processing, accountGeneration: undefined},
      {...processing, accountGeneration: 1.5},
      {...processing, requestedAt: null},
      {
        ...processing,
        requestedAt: {
          toMillis: () => {
            throw new Error("corrupt");
          },
        },
      },
      {...processing, status: "complete"},
      {
        ...processing,
        status: "complete",
        completedAt: {
          toMillis: () => {
            throw new Error("corrupt");
          },
        },
      },
      {...processing, status: "unknown"},
    ])
      expect(() =>
        resolveFacebookDeletionReceipt(corrupt, {
          providerIdentityId: "provider-hash",
          playerId: "player-1",
          uidSecret,
        }),
      ).toThrow("facebook-deletion-receipt-conflict");
  });

  it("binds callback deletion to the exact app, player, generation, and deterministic UID", () => {
    /** Provides uid secret behavior. */
    const uidSecret = Buffer.alloc(32, 13).toString("base64");
    /** Provides account generation behavior. */
    const accountGeneration = 3;
    /** Provides uid behavior. */
    const uid = facebookFirebaseUid("player-1", uidSecret, accountGeneration);
    /** Provides record behavior. */
    const record = {
      provider: "facebook",
      appId: "app-1",
      providerPlayerId: "player-1",
      accountGeneration,
      status: "active",
      uid,
    };
    expect(
      resolveFacebookCallbackDeletionIdentity(record, {
        appId: "app-1",
        playerId: "player-1",
        uidSecret,
      }),
    ).toEqual({uid, accountGeneration});
    /** Completes d record. */
    const completedRecord = {
      ...record,
      uid: null,
      accountGeneration: accountGeneration + 1,
      lastDeletedUidHash: createHash("sha256").update(uid).digest("hex"),
      lastDeletedAt: {toMillis: () => 1_700_000_000_000},
    };
    expect(
      resolveFacebookCallbackDeletionIdentity(completedRecord, {
        appId: "app-1",
        playerId: "player-1",
        uidSecret,
      }),
    ).toBeNull();
    /** Provides maximum uid behavior. */
    const maximumUid = facebookFirebaseUid("player-1", uidSecret, 1_000_000);
    expect(
      resolveFacebookCallbackDeletionIdentity(
        {
          ...record,
          uid: null,
          status: "exhausted",
          accountGeneration: 1_000_000,
          lastDeletedUidHash: createHash("sha256").update(maximumUid).digest("hex"),
          lastDeletedAt: {toMillis: () => 1_700_000_000_000},
        },
        {
          appId: "app-1",
          playerId: "player-1",
          uidSecret,
        },
      ),
    ).toBeNull();

    for (const corrupt of [
      {...record, appId: "other-app"},
      {...record, providerPlayerId: "other-player"},
      {...record, accountGeneration: accountGeneration + 1},
      {...record, status: "unknown"},
      {...record, uid: `facebook_${"f".repeat(40)}`},
      {...record, uid: null, status: "deleting"},
      {...completedRecord, lastDeletedUidHash: "f".repeat(64)},
      {...completedRecord, lastDeletedAt: undefined},
    ]) {
      expect(() =>
        resolveFacebookCallbackDeletionIdentity(corrupt, {
          appId: "app-1",
          playerId: "player-1",
          uidSecret,
        }),
      ).toThrow("facebook-provider-identity-conflict");
    }
  });
});
