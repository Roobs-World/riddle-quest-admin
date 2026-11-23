import {describe, expect, it, jest} from "@jest/globals";
import type {Firestore} from "firebase-admin/firestore";
import {
  ANDROID_NONCE_TTL_MS,
  allowAttestationRequest,
  consumeAndroidNonce,
  exchangeAndroidAttestationToken,
  issueAndroidNonce,
} from "../androidAttestation";
import {createPlayIntegrityDecoder, rejectIntegrityVerdict, type IntegrityVerdict} from "../playIntegrity";

/** Fixed server clock. */
const NOW = Date.parse("2026-11-02T12:00:00Z");

/** Firestore subset over a path map with create, transactional get and update. */
function createMemoryFirestore() {
  /** Stored documents. */
  const docs = new Map<string, Record<string, unknown>>();
  /** Document reference. */
  const ref = (path: string) => ({
    path,
    create: async (data: Record<string, unknown>) => {
      if (docs.has(path)) throw new Error("already exists");
      docs.set(path, data);
    },
  });
  /** Firestore subset. */
  const firestore = {
    collection: (name: string) => ({doc: (id: string) => ref(`${name}/${id}`)}),
    runTransaction: async <T>(callback: (transaction: unknown) => Promise<T>): Promise<T> => {
      /** Buffered writes. */
      const writes: Array<() => void> = [];
      /** Result. */
      const result = await callback({
        get: async ({path}: {
        /** Stores path. */
        path: string}) => ({data: () => docs.get(path)}),
        update: ({path}: {
        /** Stores path. */
        path: string}, data: Record<string, unknown>) => writes.push(() => docs.set(path, {...docs.get(path), ...data})),
      });
      writes.forEach((write) => write());
      return result;
    },
  };
  return {db: firestore as unknown as Firestore, docs};
}

/** A verdict for a genuine Play build on a genuine device. */
const genuine = (nonce: string, overrides: Partial<IntegrityVerdict> = {}): IntegrityVerdict => ({
  requestDetails: {requestPackageName: "com.roobsworld.riddlequest", nonce, timestampMillis: String(NOW - 5_000)},
  appIntegrity: {appRecognitionVerdict: "PLAY_RECOGNIZED", packageName: "com.roobsworld.riddlequest"},
  deviceIntegrity: {deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"]},
  ...overrides,
});

describe("Android attestation nonces", () => {
  it("issues URL-safe nonces that can be spent exactly once before they expire", async () => {
    /** Retains {db, docs} for this operation. */
    const {db, docs} = createMemoryFirestore();
    /** Retains {nonce, expires at ms} for this operation. */
    const {nonce, expiresAtMs} = await issueAndroidNonce(db, NOW);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(expiresAtMs).toBe(NOW + ANDROID_NONCE_TTL_MS);
    expect([...docs.values()][0]).toMatchObject({consumedAtMs: null, expiresAtMs});
    expect(await consumeAndroidNonce(db, nonce, () => NOW + 1_000)).toBe(true);
    expect(await consumeAndroidNonce(db, nonce, () => NOW + 2_000)).toBe(false);
    /** Retains late for this operation. */
    const late = await issueAndroidNonce(db, NOW);
    expect(await consumeAndroidNonce(db, late.nonce, () => NOW + ANDROID_NONCE_TTL_MS)).toBe(false);
  });

  it("refuses unknown and malformed nonces without a write", async () => {
    /** Retains {db, docs} for this operation. */
    const {db, docs} = createMemoryFirestore();
    expect(await consumeAndroidNonce(db, "A".repeat(43), () => NOW)).toBe(false);
    expect(await consumeAndroidNonce(db, "short", () => NOW)).toBe(false);
    expect(await consumeAndroidNonce(db, "has/slash-and-more-than-sixteen", () => NOW)).toBe(false);
    expect(docs.size).toBe(0);
  });
});

describe("rejectIntegrityVerdict", () => {
  it("accepts a fresh genuine verdict and names every failure", () => {
    expect(rejectIntegrityVerdict(genuine("n"), {nonce: "n", now: NOW})).toBeNull();
    expect(rejectIntegrityVerdict(genuine("n", {requestDetails: {requestPackageName: "com.example", nonce: "n", timestampMillis: String(NOW)}}), {nonce: "n", now: NOW})).toBe("package-mismatch");
    expect(rejectIntegrityVerdict(genuine("other"), {nonce: "n", now: NOW})).toBe("nonce-mismatch");
    expect(rejectIntegrityVerdict(genuine("n"), {nonce: "n", now: NOW + 10 * 60_000})).toBe("verdict-stale");
    expect(rejectIntegrityVerdict(genuine("n", {requestDetails: {requestPackageName: "com.roobsworld.riddlequest", nonce: "n"}}), {nonce: "n", now: NOW})).toBe("verdict-stale");
    expect(rejectIntegrityVerdict(genuine("n", {appIntegrity: {appRecognitionVerdict: "UNRECOGNIZED_VERSION", packageName: "com.roobsworld.riddlequest"}}), {nonce: "n", now: NOW})).toBe("app-not-recognized");
    expect(rejectIntegrityVerdict(genuine("n", {deviceIntegrity: {deviceRecognitionVerdict: ["MEETS_VIRTUAL_INTEGRITY"]}}), {nonce: "n", now: NOW})).toBe("device-not-trusted");
    expect(rejectIntegrityVerdict(genuine("n", {deviceIntegrity: {}}), {nonce: "n", now: NOW})).toBe("device-not-trusted");
  });
});

describe("exchangeAndroidAttestationToken", () => {
  /** Minter double. */
  const mint = async () => ({token: "app-check-token", ttlMillis: 3_600_000});

  it("mints an App Check token for a genuine verdict bound to an issued nonce, once", async () => {
    /** Retains {db} for this operation. */
    const {db} = createMemoryFirestore();
    /** Retains {nonce} for this operation. */
    const {nonce} = await issueAndroidNonce(db, NOW);
    /** Retains deps for this operation. */
    const deps = {db, decode: async () => genuine(nonce), mint, now: () => NOW};
    expect(await exchangeAndroidAttestationToken(deps, {nonce, integrityToken: "token"})).toEqual({ok: true, appCheckToken: "app-check-token", ttlMillis: 3_600_000});
    expect(await exchangeAndroidAttestationToken(deps, {nonce, integrityToken: "token"})).toEqual({ok: false, reason: "nonce-rejected"});
  });

  it("refuses malformed requests, undecodable tokens and failing verdicts without minting", async () => {
    /** Retains {db} for this operation. */
    const {db} = createMemoryFirestore();
    /** Retains minted for this operation. */
    const minted = jest.fn(mint);
    expect(await exchangeAndroidAttestationToken({db, decode: async () => genuine("x"), mint: minted}, null)).toEqual({ok: false, reason: "invalid-request"});
    expect(await exchangeAndroidAttestationToken({db, decode: async () => genuine("x"), mint: minted}, {nonce: "n", integrityToken: "x".repeat(16_385)})).toEqual({ok: false, reason: "invalid-request"});
    /** Retains first for this operation. */
    const first = await issueAndroidNonce(db, NOW);
    expect(await exchangeAndroidAttestationToken({db, decode: async () => {throw new Error("bad");}, mint: minted, now: () => NOW}, {nonce: first.nonce, integrityToken: "t"}))
      .toEqual({ok: false, reason: "integrity-decode-failed"});
    /** Retains second for this operation. */
    const second = await issueAndroidNonce(db, NOW);
    expect(await exchangeAndroidAttestationToken({db, decode: async () => genuine("someone-else"), mint: minted, now: () => NOW}, {nonce: second.nonce, integrityToken: "t"}))
      .toEqual({ok: false, reason: "nonce-mismatch"});
    expect(minted).not.toHaveBeenCalled();
  });
});

describe("allowAttestationRequest", () => {
  it("limits each address per minute and resets the next minute", () => {
    /** Retains at for this operation. */
    const at = NOW + 7 * 60_000;
    for (let index = 0; index < 30; index += 1) expect(allowAttestationRequest("203.0.113.9", at)).toBe(true);
    expect(allowAttestationRequest("203.0.113.9", at)).toBe(false);
    expect(allowAttestationRequest("203.0.113.10", at)).toBe(true);
    expect(allowAttestationRequest("203.0.113.9", at + 60_000)).toBe(true);
  });
});

describe("createPlayIntegrityDecoder", () => {
  it("decodes through the Play Integrity API with a playintegrity-scoped token", async () => {
    /** Retains calls for this operation. */
    const calls: Array<{
    /** Stores url. */
    url: string;
    /** Stores body. */
    body: string;
    /** Stores auth. */
    auth: string}> = [];
    /** Fetches mock. */
    const fetchMock = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      /** Retains headers for this operation. */
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (String(url).startsWith("http://metadata")) return new Response(JSON.stringify({access_token: "scoped", expires_in: 3600}), {status: 200});
      calls.push({url: String(url), body: String(init?.body), auth: headers.Authorization});
      if (String(init?.body).includes("bad")) return new Response("{}", {status: 400});
      if (String(init?.body).includes("empty")) return new Response("{}", {status: 200});
      return new Response(JSON.stringify({tokenPayloadExternal: genuine("n")}), {status: 200});
    });
    /** Retains decode for this operation. */
    const decode = createPlayIntegrityDecoder({fetch: fetchMock as unknown as typeof fetch});
    expect(await decode("good")).toEqual(genuine("n"));
    await expect(decode("bad")).rejects.toThrow("integrity-decode-failed");
    await expect(decode("empty")).rejects.toThrow("integrity-decode-failed");
    expect(calls[0]).toEqual({
      url: "https://playintegrity.googleapis.com/v1/com.roobsworld.riddlequest:decodeIntegrityToken",
      body: JSON.stringify({integrity_token: "good"}),
      auth: "Bearer scoped",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("scopes=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fplayintegrity");
  });
});
