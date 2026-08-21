import {afterEach, describe, expect, jest, test} from "@jest/globals";
import {exchangeFacebookCredentials} from "../credentialExchange";
import {
  FacebookBackendClient,
  parseFacebookIdentityCredentials,
  parseFacebookIdentityNonceResponse,
  resolveFacebookBackendUrl,
  type FacebookBackendPort,
} from "../backend";
import type {FacebookInstantSdk} from "../fbinstant";

afterEach(() => jest.restoreAllMocks());

describe("Facebook backend transport", () => {
  test("allows HTTPS/root-relative and development loopback only", () => {
    expect(resolveFacebookBackendUrl("/functions")).toBe("/functions");
    expect(resolveFacebookBackendUrl("https://example.test/functions")).toBe("https://example.test/functions");
    expect(resolveFacebookBackendUrl("http://localhost:5001", {allowInsecureLoopback: true}))
      .toBe("http://localhost:5001/");
    expect(() => resolveFacebookBackendUrl("//attacker.test")).toThrow("protocol-relative");
    expect(() => resolveFacebookBackendUrl("http://attacker.test")).toThrow("must use HTTPS");
  });

  test("posts exact nonce and exchange request shapes", async () => {
    const nonce = "n".repeat(43);
    const fetchMock = jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({nonce, expiresAtMs: 10}), {status: 200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        customToken: "auth",
        appCheckToken: "app-check",
        appCheckExpiresInMs: 3_600_000,
        uid: `facebook_${"a".repeat(40)}`,
      }), {status: 200}));
    const client = new FacebookBackendClient("/functions");
    await expect(client.issueIdentityNonce()).resolves.toEqual({nonce, expiresAtMs: 10});
    await client.exchangeIdentity({signedPlayer: "sig.payload", playerId: "p1", nonce});
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/functions/issueFacebookIdentityNonce", expect.objectContaining({
      method: "POST",
      body: "{}",
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/functions/exchangeFacebookIdentity", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({signedPlayer: "sig.payload", playerId: "p1", nonce}),
    }));
  });

  test("rejects malformed, unsafe, or contract-drifted identity responses", () => {
    const nonce = "n".repeat(43);
    expect(parseFacebookIdentityNonceResponse({nonce, expiresAtMs: 1})).toEqual({nonce, expiresAtMs: 1});
    for (const invalid of [
      null,
      {nonce: "short", expiresAtMs: 1},
      {nonce, expiresAtMs: Number.MAX_SAFE_INTEGER + 1},
      {nonce, expiresAtMs: 1, extra: true},
    ]) expect(() => parseFacebookIdentityNonceResponse(invalid)).toThrow("nonce response");

    const valid = {
      customToken: "auth.token",
      appCheckToken: "app-check.token",
      appCheckExpiresInMs: 3_600_000,
      uid: `facebook_${"a".repeat(40)}`,
    };
    expect(parseFacebookIdentityCredentials(valid)).toEqual(valid);
    for (const invalid of [
      {...valid, customToken: ""},
      {...valid, appCheckToken: "token with spaces"},
      {...valid, appCheckExpiresInMs: 3_599_999},
      {...valid, appCheckExpiresInMs: Number.NaN},
      {...valid, uid: `jest_${"a".repeat(40)}`},
      {...valid, extra: true},
    ]) expect(() => parseFacebookIdentityCredentials(invalid)).toThrow("credential response");
  });
});

describe("Facebook signed credential exchange", () => {
  const credentials = {
    customToken: "auth",
    appCheckToken: "app-check",
    appCheckExpiresInMs: 3_600_000,
    uid: `facebook_${"a".repeat(40)}`,
  };
  const backend = (): FacebookBackendPort => ({
    issueIdentityNonce: async () => ({nonce: "server-nonce", expiresAtMs: Date.now() + 1_000}),
    exchangeIdentity: async (input) => {
      expect(input).toEqual({signedPlayer: "signature.payload", playerId: "player-1", nonce: "server-nonce"});
      return credentials;
    },
  });
  const sdk = (signedPlayerId = "player-1"): FacebookInstantSdk => ({
    initializeAsync: async () => undefined,
    setLoadingProgress: () => undefined,
    startGameAsync: async () => undefined,
    getSupportedAPIs: () => [],
    onPause: () => undefined,
    player: {
      getID: () => "player-1",
      getSignedPlayerInfoAsync: async (nonce) => {
        expect(nonce).toBe("server-nonce");
        return {getSignature: () => "signature.payload", getPlayerID: () => signedPlayerId};
      },
      getDataAsync: async () => ({}),
      setDataAsync: async () => undefined,
      flushDataAsync: async () => undefined,
    },
  });

  test("binds the exact server nonce and SDK player ID", async () => {
    await expect(exchangeFacebookCredentials(sdk(), backend())).resolves.toEqual(credentials);
  });

  test("fails before backend exchange when signed and current player IDs differ", async () => {
    const exchangeIdentity = jest.fn<FacebookBackendPort["exchangeIdentity"]>();
    await expect(exchangeFacebookCredentials(sdk("other-player"), {
      ...backend(),
      exchangeIdentity,
    })).rejects.toThrow("facebook-signed-player-id-mismatch");
    expect(exchangeIdentity).not.toHaveBeenCalled();
  });
});
