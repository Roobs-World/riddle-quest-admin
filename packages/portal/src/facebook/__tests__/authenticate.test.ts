import {authenticateFacebook, type FacebookFirebaseAuthRuntime} from "../authenticate";
import type {FacebookBackendPort, FacebookIdentityCredentials} from "../backend";
import type {FacebookInstantSdk} from "../fbinstant";

const credentials = (suffix: string): FacebookIdentityCredentials => ({
  customToken: `custom-${suffix}`,
  appCheckToken: `app-check-${suffix}`,
  appCheckExpiresInMs: 3_600_000,
  uid: `facebook_${suffix.padEnd(40, "a")}`,
});

describe("Facebook authentication", () => {
  it("uses the initial exchange once and performs a fresh nonce-bound exchange on App Check refresh", async () => {
    const issuedNonces = ["nonce-initial", "nonce-refresh"];
    const signedNonces: string[] = [];
    const exchangeInputs: Array<{signedPlayer: string; playerId: string; nonce: string}> = [];
    const initialCredentials = credentials("initial");
    const returnedCredentials = [
      initialCredentials,
      {...credentials("refresh"), uid: initialCredentials.uid},
    ];
    const backend: FacebookBackendPort = {
      issueIdentityNonce: jest.fn(async () => ({nonce: issuedNonces.shift()!, expiresAtMs: Date.now() + 60_000})),
      exchangeIdentity: jest.fn(async (input) => {
        exchangeInputs.push(input);
        return returnedCredentials.shift()!;
      }),
    };
    const sdk = {
      player: {
        getID: () => "player-1",
        getSignedPlayerInfoAsync: async (nonce: string) => {
          signedNonces.push(nonce);
          return {getPlayerID: () => "player-1", getSignature: () => `signed-${nonce}`};
        },
      },
    } as FacebookInstantSdk;
    let appCheckProvider: (() => Promise<{token: string; expireTimeMillis: number}>) | undefined;
    const signIn = jest.fn(async () => undefined);
    const runtime: FacebookFirebaseAuthRuntime = {
      initializeAppCheck: async (provider) => {
        appCheckProvider = provider;
        expect((await provider()).token).toBe("app-check-initial");
      },
      signIn,
    };

    await expect(authenticateFacebook(sdk, backend, runtime)).resolves.toBe(credentials("initial").uid);
    expect(signIn).toHaveBeenCalledWith("custom-initial");
    expect(await appCheckProvider?.()).toMatchObject({token: "app-check-refresh"});
    expect(signedNonces).toEqual(["nonce-initial", "nonce-refresh"]);
    expect(exchangeInputs).toEqual([
      {signedPlayer: "signed-nonce-initial", playerId: "player-1", nonce: "nonce-initial"},
      {signedPlayer: "signed-nonce-refresh", playerId: "player-1", nonce: "nonce-refresh"},
    ]);
  });

  it("rejects a renewed generation instead of mixing new App Check with old Firebase Auth", async () => {
    const initial = credentials("initial");
    const nextGeneration = {...credentials("next"), uid: `facebook_${"b".repeat(40)}`};
    const backend: FacebookBackendPort = {
      issueIdentityNonce: jest.fn()
        .mockResolvedValueOnce({nonce: "nonce-1", expiresAtMs: Date.now() + 60_000})
        .mockResolvedValueOnce({nonce: "nonce-2", expiresAtMs: Date.now() + 60_000}),
      exchangeIdentity: jest.fn()
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(nextGeneration),
    };
    const sdk = {
      player: {
        getID: () => "player-1",
        getSignedPlayerInfoAsync: async (nonce: string) => ({
          getPlayerID: () => "player-1",
          getSignature: () => `signed-${nonce}`,
        }),
      },
    } as FacebookInstantSdk;
    let provider: (() => Promise<{token: string; expireTimeMillis: number}>) | undefined;
    const runtime: FacebookFirebaseAuthRuntime = {
      initializeAppCheck: async (candidate) => {
        provider = candidate;
        await candidate();
      },
      signIn: async () => undefined,
    };

    await authenticateFacebook(sdk, backend, runtime);
    await expect(provider?.()).rejects.toThrow("facebook-account-generation-changed");
  });

  it("shares one nonce exchange across concurrent refreshes and retries after failure", async () => {
    const initial = credentials("initial");
    const refreshed = {...credentials("refresh"), uid: initial.uid};
    const issueIdentityNonce = jest.fn<FacebookBackendPort["issueIdentityNonce"]>()
      .mockResolvedValueOnce({nonce: "initial-nonce", expiresAtMs: 1})
      .mockRejectedValueOnce(new Error("temporary-nonce-failure"))
      .mockResolvedValueOnce({nonce: "shared-refresh-nonce", expiresAtMs: 2});
    const exchangeIdentity = jest.fn<FacebookBackendPort["exchangeIdentity"]>()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(refreshed);
    const backend: FacebookBackendPort = {issueIdentityNonce, exchangeIdentity};
    const sdk = {
      player: {
        getID: () => "player-1",
        getSignedPlayerInfoAsync: async (nonce: string) => ({
          getPlayerID: () => "player-1",
          getSignature: () => `signed-${nonce}`,
        }),
      },
    } as FacebookInstantSdk;
    let provider: (() => Promise<{token: string; expireTimeMillis: number}>) | undefined;
    await authenticateFacebook(sdk, backend, {
      initializeAppCheck: async (candidate) => {
        provider = candidate;
        await candidate();
      },
      signIn: async () => undefined,
    });

    const failed = [provider!(), provider!()];
    await expect(Promise.all(failed)).rejects.toThrow("temporary-nonce-failure");
    expect(issueIdentityNonce).toHaveBeenCalledTimes(2);
    await expect(Promise.all([provider!(), provider!(), provider!()])).resolves.toEqual([
      expect.objectContaining({token: refreshed.appCheckToken}),
      expect.objectContaining({token: refreshed.appCheckToken}),
      expect.objectContaining({token: refreshed.appCheckToken}),
    ]);
    expect(issueIdentityNonce).toHaveBeenCalledTimes(3);
    expect(exchangeIdentity).toHaveBeenCalledTimes(2);
  });
});
