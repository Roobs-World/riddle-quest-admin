import {JestBackendClient, resolveSecureBackendUrl} from "../backend";

describe("Jest backend transport security", () => {
  afterEach(() => jest.restoreAllMocks());

  it("accepts HTTPS and same-origin root-relative endpoints", () => {
    expect(resolveSecureBackendUrl("https://us-central1.example.cloudfunctions.net/")).toBe(
      "https://us-central1.example.cloudfunctions.net/",
    );
    expect(resolveSecureBackendUrl("/api/functions")).toBe("/api/functions");
  });

  it.each([
    "http://example.com/functions",
    "ws://example.com/functions",
    "//example.com/functions",
    "functions.example.com",
    "",
  ])("rejects an insecure or ambiguous endpoint: %s", (endpoint) => {
    expect(() => resolveSecureBackendUrl(endpoint)).toThrow(/HTTPS|protocol-relative/);
  });

  it("permits HTTP loopback only when explicitly enabled for development", () => {
    expect(() => resolveSecureBackendUrl("http://localhost:5001")).toThrow("Jest backend URL must use HTTPS.");
    expect(resolveSecureBackendUrl("http://127.0.0.1:5001", {allowInsecureLoopback: true})).toBe(
      "http://127.0.0.1:5001/",
    );
    expect(() => resolveSecureBackendUrl("http://example.com", {allowInsecureLoopback: true})).toThrow(
      "Jest backend URL must use HTTPS.",
    );
  });

  it("refuses to construct a client with a plaintext production endpoint", () => {
    expect(() => new JestBackendClient("http://functions.example.com")).toThrow("Jest backend URL must use HTTPS.");
  });

  it("posts every signed trust-boundary operation as JSON", async () => {
    /** Fetches mock. */
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({verified: true}),
    } as Response);
    /** Provides client behavior. */
    const client = new JestBackendClient("/functions/");

    await client.exchangeIdentity("player.signed");
    await client.retryAccountDeletion("player.signed");
    await client.grantPurchase("purchase.signed", "player-1", "token-1");
    await client.verifyReferrals("referrals.signed", "player-1");
    await client.syncSubscriptions("subscriptions.signed", "player-1");

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/functions/exchangeJestIdentity",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({playerSigned: "player.signed"}),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/functions/retryJestAccountDeletion",
      expect.objectContaining({
        body: JSON.stringify({playerSigned: "player.signed"}),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/functions/grantJestPurchase",
      expect.objectContaining({
        body: JSON.stringify({purchaseSigned: "purchase.signed", playerId: "player-1", purchaseToken: "token-1"}),
      }),
    );
  });

  it("rejects non-success backend responses without exposing response content", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({ok: false, status: 403} as Response);
    await expect(new JestBackendClient("/").exchangeIdentity("invalid")).rejects.toThrow(
      "Jest backend exchangeJestIdentity failed (403)",
    );
  });

  it("maps a tombstone and retries deletion without requesting Firebase identity", async () => {
    /** Fetches mock. */
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({accountDeleted: true}),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({error: "account-deleted"}),
      } as Response);
    /** Provides client behavior. */
    const client = new JestBackendClient("/");

    await expect(client.retryAccountDeletion("signed")).resolves.toEqual({accountDeleted: true});
    await expect(client.exchangeIdentity("signed")).resolves.toEqual({status: "account-deleted"});
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/retryJestAccountDeletion",
      expect.objectContaining({
        body: JSON.stringify({playerSigned: "signed"}),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/exchangeJestIdentity",
      expect.objectContaining({
        body: JSON.stringify({playerSigned: "signed"}),
      }),
    );
  });

  it("keeps malformed tombstone responses status-only", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({error: "unexpected-internal-detail"}),
    } as Response);

    await expect(new JestBackendClient("/").exchangeIdentity("signed")).rejects.toThrow(
      "Jest backend exchangeJestIdentity failed (409)",
    );
  });

  it("aborts backend requests that exceed their deadline", async () => {
    jest.useFakeTimers();
    try {
      /** Fetches mock. */
      const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      );
      /** Provides pending behavior. */
      const pending = new JestBackendClient("/", {requestTimeoutMs: 25}).exchangeIdentity("signed");
      /** Provides rejection behavior. */
      const rejection = expect(pending).rejects.toThrow("Jest backend exchangeJestIdentity timed out.");

      await jest.advanceTimersByTimeAsync(25);

      await rejection;
      expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
      expect(((fetchMock.mock.calls[0]?.[1] as RequestInit).signal as AbortSignal).aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
