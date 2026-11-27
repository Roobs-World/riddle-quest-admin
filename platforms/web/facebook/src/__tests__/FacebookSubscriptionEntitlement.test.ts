import {createFacebookSubscriptionEntitlement} from "../ads/FacebookSubscriptionEntitlement";

const documentName = "projects/riddle-quest-test/databases/(default)/documents/users/facebook_generation_1";
const unavailable = "Facebook subscription entitlement is unavailable.";
const documentResponse = (fields: unknown = {hasActiveSubscription: {booleanValue: true}}) => new Response(
  JSON.stringify({name: documentName, fields}), {status: 200, headers: {"content-type": "application/json"}},
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

const setup = (
  fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValue(documentResponse()),
  options: Partial<Parameters<typeof createFacebookSubscriptionEntitlement>[0]> = {},
) => ({
  fetch,
  entitlement: createFacebookSubscriptionEntitlement({
    projectId: "riddle-quest-test", uid: "facebook_generation_1", getIdToken: async () => "firebase-id-token",
    getAppCheckToken: async () => "app-check-token", isActive: () => true, fetch, ...options,
  }),
});

describe("Facebook subscription entitlement read", () => {
  afterEach(() => jest.useRealTimers());
  it("recognizes the authenticated owner's active subscription", async () => {
    const {entitlement} = setup();
    await expect(entitlement.read()).resolves.toBe(true);
  });

  it.each([
    ["inactive", {hasActiveSubscription: {booleanValue: false}}],
    ["legacy omitted", {}],
  ])("recognizes an existing owner's %s subscription", async (_label, fields) => {
    const {entitlement} = setup(jest.fn<typeof globalThis.fetch>().mockResolvedValue(documentResponse(fields)));
    await expect(entitlement.read()).resolves.toBe(false);
  });

  it.each([
    ["missing document", () => new Response("{}", {status: 404})],
    ["denied access", () => new Response("private server response", {status: 403})],
    ["failed server", () => new Response("private server response", {status: 500})],
    ["wrong owner", () => new Response(JSON.stringify({name: documentName + "_other", fields: {}}))],
    ["missing document name", () => new Response(JSON.stringify({fields: {}}))],
    ["unexpected document data", () => new Response(JSON.stringify({name: documentName, error: "private data"}))],
    ["malformed document metadata", () => new Response(JSON.stringify({name: documentName, createTime: {private: "data"}}))],
    ["non-boolean field", () => documentResponse({hasActiveSubscription: {booleanValue: "false"}})],
    ["wrong value kind", () => documentResponse({hasActiveSubscription: {stringValue: "false"}})],
    ["ambiguous value", () => documentResponse({hasActiveSubscription: {booleanValue: false, nullValue: null}})],
    ["unexpected field", () => documentResponse({hasActiveSubscription: {booleanValue: false}, coins: {integerValue: "99"}})],
    ["null fields", () => documentResponse(null)],
    ["array fields", () => documentResponse([])],
    ["malformed JSON", () => new Response("private invalid response")],
  ])("rejects %s without exposing the response", async (_label, response) => {
    const {entitlement} = setup(jest.fn<typeof globalThis.fetch>().mockResolvedValue(response()));
    await expect(entitlement.read()).rejects.toThrow(new Error(unavailable));
  });

  it("coalesces simultaneous reads but checks again after a completed read", async () => {
    const pending = deferred<Response>();
    const {fetch, entitlement} = setup(jest.fn<typeof globalThis.fetch>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(documentResponse({hasActiveSubscription: {booleanValue: false}})));
    const first = entitlement.read();
    const second = entitlement.read();
    pending.resolve(documentResponse());
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(entitlement.read()).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["getIdToken", "getAppCheckToken"] as const)("bounds %s acquisition and never sends a late request", async (credential) => {
    jest.useFakeTimers();
    const token = deferred<string>();
    const {entitlement, fetch} = setup(undefined, {[credential]: () => token.promise});
    let outcome = "pending";
    const read = entitlement.read().then(() => {outcome = "resolved";}, (error: Error) => {outcome = error.message;});
    await jest.advanceTimersByTimeAsync(10_000);
    expect(outcome).toBe(unavailable);
    token.resolve("late-private-token");
    await jest.advanceTimersByTimeAsync(0);
    await read;
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retires a waiting read immediately and permanently", async () => {
    jest.useFakeTimers();
    const token = deferred<string>();
    const getIdToken = jest.fn(() => token.promise);
    const {entitlement, fetch} = setup(undefined, {getIdToken});
    let outcome = "pending";
    const read = entitlement.read().then(() => {outcome = "resolved";}, (error: Error) => {outcome = error.message;});
    entitlement.retire();
    entitlement.retire();
    await jest.advanceTimersByTimeAsync(0);
    expect(outcome).toBe(unavailable);
    await expect(entitlement.read()).rejects.toThrow(unavailable);
    token.resolve("retired-private-token");
    await read;
    await jest.advanceTimersByTimeAsync(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(getIdToken).toHaveBeenCalledTimes(1);
  });

  it.each(["getIdToken", "getAppCheckToken"] as const)("stops a replaced account after awaiting %s", async (credential) => {
    const token = deferred<string>();
    let active = true;
    const {entitlement, fetch} = setup(undefined, {[credential]: () => token.promise, isActive: () => active});
    const read = entitlement.read();
    active = false;
    token.resolve("old-account-token");
    await expect(read).rejects.toThrow(unavailable);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not request credentials for an inactive account", async () => {
    const getIdToken = jest.fn(async () => "old-account-token");
    const {entitlement, fetch} = setup(undefined, {getIdToken, isActive: () => false});
    await expect(entitlement.read()).rejects.toThrow(unavailable);
    expect(getIdToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a completed response after its account is replaced", async () => {
    const started = deferred<void>();
    const response = deferred<Response>();
    let active = true;
    const {entitlement} = setup(jest.fn<typeof globalThis.fetch>().mockImplementation(() => {
      started.resolve();
      return response.promise;
    }), {isActive: () => active});
    const read = entitlement.read();
    await started.promise;
    active = false;
    response.resolve(documentResponse({hasActiveSubscription: {booleanValue: false}}));
    await expect(read).rejects.toThrow(unavailable);
  });

  it("rejects a completed body after its account is replaced", async () => {
    const started = deferred<void>();
    let body!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {body = controller;},
      pull() {started.resolve();},
    }, {highWaterMark: 0});
    let active = true;
    const {entitlement} = setup(jest.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(stream)), {isActive: () => active});
    const read = entitlement.read();
    await started.promise;
    active = false;
    body.enqueue(new TextEncoder().encode(JSON.stringify({name: documentName, fields: {}})));
    body.close();
    await expect(read).rejects.toThrow(unavailable);
  });

  it("bounds streaming response bytes even when content length is missing", async () => {
    const cancelled = jest.fn();
    const bytes = new TextEncoder().encode(JSON.stringify({name: documentName, fields: {}, updateTime: "x".repeat(9_000)}));
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length) controller.close();
        else {
          controller.enqueue(bytes.subarray(offset, offset + 1024));
          offset += 1024;
        }
      },
      cancel: cancelled,
    }, {highWaterMark: 0});
    const {entitlement, fetch} = setup(jest.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body)));
    await expect(entitlement.read()).rejects.toThrow(unavailable);
    expect(cancelled).toHaveBeenCalled();
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it.each([
    {projectId: "riddle-quest-test/../../other-project"},
    {uid: ""},
    {uid: "../other-owner"},
    {uid: "private\nowner"},
    {uid: "x".repeat(129)},
  ])("rejects invalid owner coordinates before requesting credentials: %j", async (coordinates) => {
    const getIdToken = jest.fn(async () => "firebase-id-token");
    const {entitlement, fetch} = setup(undefined, {...coordinates, getIdToken});
    await expect(entitlement.read()).rejects.toThrow(unavailable);
    expect(getIdToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["getIdToken", "getAppCheckToken"] as const)("rejects empty %s rather than sending an unauthenticated request", async (credential) => {
    const {entitlement, fetch} = setup(undefined, {[credential]: async () => ""});
    await expect(entitlement.read()).rejects.toThrow(unavailable);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects expired credentials even before a delayed deadline callback can run", async () => {
    jest.useFakeTimers();
    const token = deferred<string>();
    const {entitlement, fetch} = setup(undefined, {getIdToken: () => token.promise});
    const read = entitlement.read();
    jest.setSystemTime(Date.now() + 10_000);
    token.resolve("late-private-token");
    await expect(read).rejects.toThrow(unavailable);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads only the masked current owner's document with verified credentials", async () => {
    const response = new Response(JSON.stringify({
      name: "projects/riddle-quest-test/databases/(default)/documents/users/facebook:generation_1",
      createTime: "2026-11-01T00:00:00Z",
      updateTime: "2026-11-01T00:00:00Z",
    }));
    const {entitlement, fetch} = setup(jest.fn<typeof globalThis.fetch>().mockResolvedValue(response), {uid: "facebook:generation_1"});
    await expect(entitlement.read()).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      "https://firestore.googleapis.com/v1/projects/riddle-quest-test/databases/(default)/documents/users/facebook%3Ageneration_1?mask.fieldPaths=hasActiveSubscription",
      {
        method: "GET",
        headers: {Authorization: "Bearer firebase-id-token", "X-Firebase-AppCheck": "app-check-token"},
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: expect.any(AbortSignal),
      },
    );
  });

  it.each(["deadline", "retirement"] as const)("aborts a pending request at %s and cancels a late response", async (stop) => {
    jest.useFakeTimers();
    const started = deferred<void>();
    const response = deferred<Response>();
    const {entitlement, fetch} = setup(jest.fn<typeof globalThis.fetch>().mockImplementation(() => {
      started.resolve();
      return response.promise;
    }));
    const rejected = expect(entitlement.read()).rejects.toThrow(unavailable);
    await started.promise;
    if (stop === "retirement") entitlement.retire();
    else await jest.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    const pull = jest.fn();
    const cancel = jest.fn();
    response.resolve(new Response(new ReadableStream({pull, cancel}, {highWaterMark: 0})));
    await jest.advanceTimersByTimeAsync(0);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(pull).not.toHaveBeenCalled();
  });

  it.each(["deadline", "retirement"] as const)("aborts body consumption at %s", async (stop) => {
    jest.useFakeTimers();
    const started = deferred<void>();
    const cancel = jest.fn();
    const body = new ReadableStream({pull() {started.resolve();}, cancel}, {highWaterMark: 0});
    const {entitlement, fetch} = setup(jest.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body)));
    const rejected = expect(entitlement.read()).rejects.toThrow(unavailable);
    await started.promise;
    if (stop === "retirement") entitlement.retire();
    else await jest.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each(["getIdToken", "getAppCheckToken"] as const)("sanitizes a %s failure without starting HTTP", async (credential) => {
    const {entitlement, fetch} = setup(undefined, {[credential]: async () => {throw new Error("private credential details");}});
    await expect(entitlement.read()).rejects.toThrow(new Error(unavailable));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries after a network failure without retaining unknown or a stale result", async () => {
    const {entitlement, fetch} = setup(jest.fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error("private network details"))
      .mockResolvedValueOnce(documentResponse({hasActiveSubscription: {booleanValue: false}})));
    await expect(entitlement.read()).rejects.toThrow(new Error(unavailable));
    await expect(entitlement.read()).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
