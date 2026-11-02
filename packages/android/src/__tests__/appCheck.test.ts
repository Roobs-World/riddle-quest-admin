import {describe, expect, it, jest} from "@jest/globals";
import {NativeModules} from "react-native";
import {attestDevice, enableAndroidAppCheck, getPlayIntegrity, type PlayIntegrityPort} from "../hosted/appCheck";
import {parseHostedConfig, type HostedConfig} from "../hosted/hostedConfig";

/** Initialized App Check calls recorded by the module double. */
const mockInitialized: unknown[] = [];
jest.mock("firebase/app-check", () => ({
  CustomProvider: class {
    /** Provider options. */
    options: {getToken: () => Promise<unknown>};
    constructor(options: {getToken: () => Promise<unknown>}) {
      this.options = options;
    }
  },
  initializeAppCheck: (app: unknown, options: unknown) => {
    mockInitialized.push(options);
    return {app};
  },
}));

/** Production configuration. */
const production: HostedConfig = parseHostedConfig({
  firebase: {
    apiKey: "key",
    appId: "1:329028367192:web:abc",
    authDomain: "riddle-quest-ec2b2.firebaseapp.com",
    messagingSenderId: "329028367192",
    projectId: "riddle-quest-ec2b2",
    functionsRegion: "us-central1",
    gameplayRegion: "europe-west1",
  },
  emulators: null,
});
/** Integrity double that records its nonce. */
const integrity = (calls: string[]): PlayIntegrityPort => ({
  requestIntegrityToken: async (nonce, projectNumber) => {
    calls.push(`${nonce}@${projectNumber}`);
    return "integrity-token";
  },
});
/** Scripted HTTP transport. */
const transport = (responses: Record<string, {ok: boolean; body: unknown}>, calls: string[]) =>
  async (url: string, init: {body: string}) => {
    calls.push(`${url} ${init.body}`);
    /** Scripted response. */
    const scripted = responses[url.split("/").pop() ?? ""];
    return {ok: scripted.ok, json: async () => scripted.body};
  };

describe("attestDevice", () => {
  it("binds a Play Integrity token to the server nonce and returns the minted App Check token", async () => {
    const calls: string[] = [];
    const token = await attestDevice(
      production,
      integrity(calls),
      transport(
        {
          issueAndroidAttestationNonce: {ok: true, body: {nonce: "server-nonce"}},
          exchangeAndroidAttestation: {ok: true, body: {appCheckToken: "app-check", ttlMillis: 1_000}},
        },
        calls,
      ),
      () => 5_000,
    );
    expect(token).toEqual({token: "app-check", expireTimeMillis: 6_000});
    expect(calls).toEqual([
      "https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/issueAndroidAttestationNonce {}",
      "server-nonce@329028367192",
      `https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/exchangeAndroidAttestation ${JSON.stringify({nonce: "server-nonce", integrityToken: "integrity-token"})}`,
    ]);
  });

  it("fails on a refused exchange, a malformed nonce and a malformed token", async () => {
    const calls: string[] = [];
    await expect(attestDevice(production, integrity(calls), transport({
      issueAndroidAttestationNonce: {ok: true, body: {nonce: "n"}},
      exchangeAndroidAttestation: {ok: false, body: {error: "attestation-rejected"}},
    }, calls))).rejects.toThrow("exchangeAndroidAttestation-failed");
    await expect(attestDevice(production, integrity(calls), transport({
      issueAndroidAttestationNonce: {ok: true, body: {nonce: 7}},
    }, calls))).rejects.toThrow("attestation-nonce-invalid");
    await expect(attestDevice(production, integrity(calls), transport({
      issueAndroidAttestationNonce: {ok: true, body: {nonce: "n"}},
      exchangeAndroidAttestation: {ok: true, body: {appCheckToken: "t"}},
    }, calls))).rejects.toThrow("attestation-response-invalid");
    await expect(attestDevice(production, integrity(calls), transport({
      issueAndroidAttestationNonce: {ok: true, body: "nope"},
    }, calls))).rejects.toThrow("issueAndroidAttestationNonce-failed");
  });
});

describe("enableAndroidAppCheck", () => {
  it("installs a Play Integrity provider in production and skips emulator builds and devices without the module", async () => {
    mockInitialized.length = 0;
    const calls: string[] = [];
    expect(enableAndroidAppCheck({} as never, {...production, emulators: {host: "10.0.2.2", authPort: 9099, functionsPort: 5001, firestorePort: 8099}}, integrity(calls))).toBeNull();
    expect(enableAndroidAppCheck({} as never, production, null)).toBeNull();
    expect(mockInitialized).toHaveLength(0);
    const fetchImpl = transport({
      issueAndroidAttestationNonce: {ok: true, body: {nonce: "n"}},
      exchangeAndroidAttestation: {ok: true, body: {appCheckToken: "t", ttlMillis: 60_000}},
    }, calls);
    expect(enableAndroidAppCheck({} as never, production, integrity(calls), fetchImpl)).not.toBeNull();
    expect(mockInitialized).toHaveLength(1);
    /** Provider handed to App Check. */
    const options = mockInitialized[0] as {provider: {options: {getToken: () => Promise<{token: string}>}}; isTokenAutoRefreshEnabled: boolean};
    expect(options.isTokenAutoRefreshEnabled).toBe(true);
    expect((await options.provider.options.getToken()).token).toBe("t");
  });

  it("binds the registered native module", () => {
    expect(getPlayIntegrity()).toBeNull();
    (NativeModules as Record<string, unknown>).RiddleQuestPlayIntegrity = integrity([]);
    try {
      expect(getPlayIntegrity()).not.toBeNull();
    } finally {
      delete (NativeModules as Record<string, unknown>).RiddleQuestPlayIntegrity;
    }
  });
});
