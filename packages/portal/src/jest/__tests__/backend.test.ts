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

  it.each([0, -1, NaN, Infinity])("rejects an invalid total request budget: %p", requestTimeoutMs => {
    expect(() => new JestBackendClient("/", {requestTimeoutMs})).toThrow("Jest backend request timeout must be a positive number.");
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

  it("retries one subscription fetch transport failure with the same proof and controller", async () => {
    /** Preserves the successful signed-boundary response after a native fetch failure. */
    const fetchMock = jest.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValue(new Response(JSON.stringify({verified: true, activeSkus: []})));
    await expect(new JestBackendClient("/").syncSubscriptions("signed", "player")).resolves.toEqual({verified: true, activeSkus: []});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
  });

  it("returns the final subscription fetch failure without a third attempt", async () => {
    /** Keeps a persistent native transport failure observable. */
    const failure = new TypeError("network still failed");
    /** Rejects both admitted transport attempts. */
    const fetchMock = jest.spyOn(globalThis, "fetch").mockRejectedValue(failure);
    await expect(new JestBackendClient("/").syncSubscriptions("signed", "player")).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    (client: JestBackendClient) => client.exchangeIdentity("signed"),
    (client: JestBackendClient) => client.retryAccountDeletion("signed"),
    (client: JestBackendClient) => client.grantPurchase("signed", "player", "token"),
    (client: JestBackendClient) => client.verifyReferrals("signed", "player"),
  ])("does not retry another signed operation's transport failure", async invoke => {
    /** Restricts automatic replay to subscription reconciliation alone. */
    const failure = new TypeError("network failed");
    /** Rejects the unrelated operation at fetch. */
    const fetchMock = jest.spyOn(globalThis, "fetch").mockRejectedValue(failure);
    await expect(invoke(new JestBackendClient("/"))).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([new Error("offline"), new DOMException("Aborted", "AbortError")])(
    "does not retry a subscription fetch rejection outside native TypeError: %p", async failure => {
      /** Keeps explicit aborts and other errors observable without automatic replay. */
      const fetchMock = jest.spyOn(globalThis, "fetch").mockRejectedValue(failure);
      await expect(new JestBackendClient("/").syncSubscriptions("signed", "player")).rejects.toBe(failure);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([400, 401, 403, 429, 503])("does not retry subscription HTTP %i", async status => {
    /** An authoritative HTTP response is never a rejected fetch transport. */
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", {status}));
    await expect(new JestBackendClient("/").syncSubscriptions("signed", "player"))
      .rejects.toThrow(`Jest backend syncJestSubscriptions failed (${status})`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([new TypeError("body disturbed"), new SyntaxError("invalid JSON")])(
    "does not retry subscription response-processing errors: %p", async failure => {
      /** Separates successful transport from a failing body reader. */
      const response = new Response("{}");
      jest.spyOn(response, "json").mockRejectedValue(failure);
      /** Completes fetch normally before response processing fails. */
      const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(response);
      await expect(new JestBackendClient("/").syncSubscriptions("signed", "player")).rejects.toBe(failure);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("does not retry a request-serialization TypeError as a network failure", async () => {
    /** Models a runtime caller violating the string proof contract before fetch starts. */
    const failure = new TypeError("invalid request serialization");
    /** Throws during serialization rather than from the native transport. */
    const invalidProof = {
      /** Rejects malformed proof serialization before transport. */
      toJSON() { throw failure; },
    };
    /** Verifies that malformed request processing never reaches transport. */
    const fetchMock = jest.spyOn(globalThis, "fetch");
    /** Exposes the untyped public boundary without weakening production input types. */
    const client = new JestBackendClient("/");
    await expect(Reflect.apply(client.syncSubscriptions, client, [invalidProof, "player"])).rejects.toBe(failure);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps subscription transport retry inside one shared deadline", async () => {
    jest.useFakeTimers();
    try {
      /** Uses almost the entire first request budget before retrying. */
      const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementationOnce(() => new Promise((_resolve, reject) => {
        setTimeout(() => reject(new TypeError("network failed")), 24);
      })).mockImplementationOnce(() => new Promise(() => undefined));
      /** Observes timeout before advancing time. */
      const rejection = expect(new JestBackendClient("/", {requestTimeoutMs: 25}).syncSubscriptions("signed", "player"))
        .rejects.toThrow("Jest backend syncJestSubscriptions timed out.");
      await jest.advanceTimersByTimeAsync(24);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
      await jest.advanceTimersByTimeAsync(1);
      await rejection;
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it.each([25, 30])("does not retry a fetch TypeError arriving at %ims after timeout or at deadline", async delay => {
    jest.useFakeTimers();
    try {
      /** Settles the original native fetch only when no retry budget remains. */
      const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementationOnce(() => new Promise((_resolve, reject) => {
        setTimeout(() => reject(new TypeError("late network failure")), delay);
      }));
      /** Records the final rejection so either deadline-order outcome is observed. */
      const outcome = new JestBackendClient("/", {requestTimeoutMs: 25}).syncSubscriptions("signed", "player")
        .then(() => "unexpected-success", error => error);
      await jest.advanceTimersByTimeAsync(delay);
      expect(await outcome).toBeInstanceOf(Error);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
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

  it.each([
    {path: "exchangeJestIdentity", invoke: (client: JestBackendClient) => client.exchangeIdentity("signed")},
    {path: "retryJestAccountDeletion", invoke: (client: JestBackendClient) => client.retryAccountDeletion("signed")},
    {path: "grantJestPurchase", invoke: (client: JestBackendClient) => client.grantPurchase("signed", "p1", "token")},
    {path: "verifyJestReferrals", invoke: (client: JestBackendClient) => client.verifyReferrals("signed", "p1")},
    {path: "syncJestSubscriptions", invoke: (client: JestBackendClient) => client.syncSubscriptions("signed", "p1")},
  ])("bounds $path at 30s even when fetch ignores abort", async ({path, invoke}) => {
    jest.useFakeTimers();
    try {
      /** Models an unresponsive transport that never settles its fetch promise. */
      const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>(() => undefined));
      /** Exercises each signed boundary under the production default, with no automatic retry. */
      const pending = invoke(new JestBackendClient("/"));
      /** Observes the rejection before advancing time to prevent an unhandled rejection. */
      const rejection = expect(pending).rejects.toThrow(`Jest backend ${path} timed out.`);
      await jest.advanceTimersByTimeAsync(29_999);
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await rejection;
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([400, 503])("clears the longer deadline immediately after HTTP %i", async (status) => {
    jest.useFakeTimers();
    try {
      /** Supplies an authoritative rejection rather than an unresolved transport. */
      const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", {status}));
      await expect(new JestBackendClient("/").exchangeIdentity("signed")).rejects.toThrow(
        `Jest backend exchangeJestIdentity failed (${status})`,
      );
      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(60_000);
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
