import {dirname, join} from "node:path";
import {pathToFileURL} from "node:url";
import type {JWTPayload, JWTVerifyGetKey} from "jose";

/** Keeps cryptographic verification real while replacing the network key source. */
const mockVerify = jest.fn();
/** Records the trusted JWKS endpoint selected by the callback. */
const mockRemoteKeys = jest.fn();
/** Prevents tests from creating real Firebase credentials. */
const mockCreateCustomToken = jest.fn().mockResolvedValue("custom-token");

jest.mock("jose", () => ({
  jwtVerify: (...args: unknown[]) => mockVerify(...args),
  createRemoteJWKSet: (url: URL) => {
    mockRemoteKeys(url);
    return (...args: unknown[]) => mockKeyResolver(...args);
  },
}));
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({createCustomToken: mockCreateCustomToken}),
}));
jest.mock("firebase-functions/params", () => ({
  defineSecret: () => ({value: () => "test-only-oauth-secret"}),
}));
jest.mock("../shared/sentryHandlers", () => ({
  onRequestWithSentry: (_name: string, _options: unknown, handler: unknown) => handler,
}));

import {yahooOAuthCallback, yahooOAuthStart} from "../yahoo/yahooOAuthEndpoints";

/** Uses the installed ESM implementation, bypassing the global Jest JOSE stub. */
let jose: typeof import("jose");
/** Resolves locally generated public keys without any external requests. */
let mockKeyResolver: jest.Mock;
/** Holds the private keys corresponding to the test JWKS. */
const keys = new Map<string, CryptoKey>();
/** Captures only the token exchange request. */
let fetchMock: jest.SpiedFunction<typeof fetch>;

/** Creates the small HTTP response surface used by the OAuth handlers. */
const makeResponse = () => ({
  set: jest.fn(),
  redirect: jest.fn(),
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
});

/** Starts a real signed-state flow and returns a matching callback request. */
async function startFlow() {
  /** Captures the authorization URL and state cookie. */
  const response = makeResponse();
  await yahooOAuthStart({method: "GET"} as never, response as never);
  /** Reads the parameters that a provider would receive. */
  const url = new URL(response.redirect.mock.calls[0][1]);
  return {
    request: {
      method: "GET",
      query: {code: "test-code", state: url.searchParams.get("state")!},
      get: () => response.set.mock.calls.find(([name]) => name === "Set-Cookie")![1],
    },
    claims: {
      iss: "https://api.login.yahoo.com",
      aud: url.searchParams.get("client_id")!,
      sub: "test-user",
      nonce: url.searchParams.get("nonce")!,
      exp: Math.floor(Date.now() / 1000) + 300,
    },
  };
}

/** Signs a provider-shaped token with an ephemeral test key. */
async function sign(claims: JWTPayload, algorithm = "ES256", key = keys.get(algorithm)!) {
  return new jose.SignJWT(claims).setProtectedHeader({alg: algorithm, kid: algorithm}).sign(key);
}

/** Supplies the ID token through the callback's token exchange boundary. */
async function callback(request: Awaited<ReturnType<typeof startFlow>>["request"], token: string) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({id_token: token}), {status: 200}));
  /** Captures the final authentication redirect. */
  const response = makeResponse();
  await yahooOAuthCallback(request as never, response as never);
  return response;
}

beforeAll(async () => {
  expect(mockRemoteKeys).toHaveBeenCalledWith(new URL("https://api.login.yahoo.com/openid/v1/certs"));
  // A file URL avoids the repository-wide moduleNameMapper for "jose".
  jose = await import(pathToFileURL(join(dirname(require.resolve("jose/package.json")), "dist/webapi/index.js")).href);
  /** Builds a provider-style JWKS using real asymmetric keys. */
  const publicKeys = [];
  for (const algorithm of ["ES256", "RS256", "ES384"]) {
    /** Generates a key pair for each acceptance/rejection case. */
    const pair = await jose.generateKeyPair(algorithm);
    keys.set(algorithm, pair.privateKey);
    publicKeys.push({...await jose.exportJWK(pair.publicKey), alg: algorithm, kid: algorithm, use: "sig"});
  }
  mockKeyResolver = jest.fn(jose.createLocalJWKSet({keys: publicKeys}) as JWTVerifyGetKey);
  mockVerify.mockImplementation(jose.jwtVerify);
});

beforeEach(() => {
  fetchMock = jest.spyOn(globalThis, "fetch");
});
afterEach(() => fetchMock.mockRestore());

describe("Yahoo OAuth ID token verification", () => {
  it.each(["ES256", "RS256"])("authenticates a valid %s token", async (algorithm) => {
    /** Creates matching state, nonce and audience. */
    const {request, claims} = await startFlow();
    /** Completes the callback with a cryptographically valid token. */
    const response = await callback(request, await sign(claims, algorithm));
    expect(mockCreateCustomToken).toHaveBeenCalledWith("yahoo:test-user", {provider: "yahoo"});
    expect(response.redirect).toHaveBeenCalledWith(302, "https://yahoo.roobsworld.com/#yahoo_token=custom-token");
    expect(mockVerify.mock.calls[0][2]).toEqual({
      issuer: "https://api.login.yahoo.com", audience: claims.aud, algorithms: ["ES256", "RS256"],
    });
    expect(mockKeyResolver).toHaveBeenCalled();
  });

  it.each([
    ["issuer", {iss: "https://attacker.example"}, "ERR_JWT_CLAIM_VALIDATION_FAILED"],
    ["audience", {aud: "different-client"}, "ERR_JWT_CLAIM_VALIDATION_FAILED"],
    ["expiration", {exp: 1}, "ERR_JWT_EXPIRED"],
    ["nonce", {nonce: "different-nonce"}, undefined],
    ["subject", {sub: undefined}, undefined],
  ])("rejects an invalid %s without issuing credentials", async (_name, override, code) => {
    /** Starts with otherwise valid claims. */
    const {request, claims} = await startFlow();
    /** Exercises real JOSE validation and the callback's nonce/subject checks. */
    const result = callback(request, await sign({...claims, ...override}));
    if (code) await expect(result).rejects.toMatchObject({code});
    else await expect(result).rejects.toThrow("invalid-yahoo-id-token");
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it("rejects a forged ES256 signature", async () => {
    /** Uses a private key absent from the trusted JWKS. */
    const attacker = await jose.generateKeyPair("ES256");
    /** Creates an otherwise valid authorization response. */
    const {request, claims} = await startFlow();
    await expect(callback(request, await sign(claims, "ES256", attacker.privateKey)))
      .rejects.toMatchObject({code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED"});
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it.each(["ES384", "HS256", "none"])("rejects the unapproved %s algorithm", async (algorithm) => {
    /** Creates valid claims so only the algorithm fails validation. */
    const {request, claims} = await startFlow();
    /** Includes symmetric and unsigned tokens to guard against algorithm confusion. */
    const token = algorithm === "none" ? new jose.UnsecuredJWT(claims).encode() :
      algorithm === "HS256" ? await new jose.SignJWT(claims).setProtectedHeader({alg: algorithm})
        .sign(new TextEncoder().encode("test-only-symmetric-signing-secret")) : await sign(claims, algorithm);
    await expect(callback(request, token)).rejects.toMatchObject({code: "ERR_JOSE_ALG_NOT_ALLOWED"});
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it("rejects a mismatched state cookie before exchanging the authorization code", async () => {
    /** Starts a signed state flow but simulates a different browser cookie. */
    const {request} = await startFlow();
    /** Captures the rejected request. */
    const response = makeResponse();
    await yahooOAuthCallback({...request, get: () => "rq_yahoo_state=wrong"} as never, response as never);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });
});
