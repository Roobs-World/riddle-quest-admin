import assert from "node:assert/strict";
import {createServer, type Server} from "node:http";
import test from "node:test";
import {fetchRedditGateway} from "./redditGatewayTransport.ts";

/** Synthetic trust envelope; no actual gateway key, provider ID or signature is used. */
const request = {signature: "A".repeat(43), body: JSON.stringify({assertion: {fixture: true}, payload: {synthetic: true}})};
/** Starts a test-only listener on a kernel-assigned loopback port. */
const listen = async (server: Server) => {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  /** Kernel-assigned fixture address. */
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
};
/** Closes only an owned fixture listener, including keep-alive connections. */
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
};

test("does not forward the signed assertion through an actual 307 redirect", async () => {
  /** Tracks whether native fetch reaches a different destination. */
  let destinationRequests = 0;
  /** Redirect destination is a second local fixture, never an external provider. */
  const destination = createServer((_, response) => {
    destinationRequests++; response.setHeader("content-type", "application/json"); response.end('{"ok":true}');
  });
  /** Only the test adapter maps the fixed production URL to loopback. */
  const destinationUrl = await listen(destination);
  /** Gateway fixture emits a redirect that would otherwise preserve POST body/signature. */
  const gateway = createServer((_, response) => {
    response.writeHead(307, {location: `${destinationUrl}/received`}); response.end();
  });
  /** Loopback gateway origin. */
  const gatewayUrl = await listen(gateway);
  try {
    /** Native fetch still processes the production request options unchanged. */
    const fetcher: typeof fetch = (url, options) => {
      assert.equal(url, "https://www.roobsworld.com/api/reddit-gateway/redditStorage");
      return fetch(`${gatewayUrl}/redditStorage`, options);
    };
    assert.deepEqual(await fetchRedditGateway("redditStorage", request, fetcher),
      {status: 502, payload: {ok: false, error: "gateway-redirect-rejected"}});
    assert.equal(destinationRequests, 0);
  } finally {await close(gateway); await close(destination);}
});

test("stops streamed response consumption at the byte limit instead of buffering the whole body", async () => {
  /** Counts source chunks actually requested by the response reader. */
  let chunks = 0;
  /** Cancellation proves remaining provider bytes are discarded. */
  let cancelled = false;
  /** Four chunks exceed the 64 KiB limit; the fourth must never be consumed. */
  const stream = new ReadableStream<Uint8Array>({
    /** Supplies one fixture chunk only on demand. */
    pull(controller) {chunks++; controller.enqueue(new Uint8Array(32_768)); if (chunks === 4) controller.close();},
    /** Discards the unconsumed fourth fixture chunk. */
    cancel() {cancelled = true;},
  }, {highWaterMark: 0});
  assert.deepEqual(await fetchRedditGateway("redditGameplay", request, async () => new Response(stream)),
    {status: 502, payload: {ok: false, error: "gateway-response-too-large"}});
  assert.equal(chunks, 3); assert.equal(cancelled, true);
});

test("rejects corrupt UTF-8 rather than silently rewriting provider JSON strings", async () => {
  /** Invalid UTF-8 inside an otherwise valid JSON string. */
  const invalid = new Uint8Array([123, 34, 97, 34, 58, 34, 255, 34, 125]);
  assert.deepEqual(await fetchRedditGateway("redditStorage", request, async () => new Response(invalid)),
    {status: 502, payload: {ok: false, error: "gateway-invalid-response"}});
});

test("preserves valid payloads and provider failure statuses without retrying", async () => {
  for (const status of [200, 401, 403, 429, 503]) {
    /** Exactly one server request per operation, including error responses. */
    let calls = 0;
    /** Existing kill-switch rejection remains available to identity fallback. */
    const payload = status === 200 ? {ok: true, result: {text: "你好é"}} : {ok: false, error: "reddit-feature-disabled:identity"};
    assert.deepEqual(await fetchRedditGateway("exchangeRedditIdentity", request, async (url, options) => {
      calls++;
      assert.equal(url, "https://www.roobsworld.com/api/reddit-gateway/exchangeRedditIdentity");
      assert.equal(options?.redirect, "manual");
      assert.equal(options?.body, request.body);
      assert.deepEqual(options?.headers, {"content-type": "application/json", "x-riddle-quest-reddit-signature": request.signature});
      return Response.json(payload, {status});
    }), {status, payload});
    assert.equal(calls, 1);
  }
});

test("accepts exactly 64 KiB of valid multi-byte UTF-8 and rejects one byte more", async () => {
  /** Exact byte boundary differs from the number of JavaScript characters. */
  const body = JSON.stringify({text: "é".repeat(32_762) + "a"});
  assert.equal(Buffer.byteLength(body), 65_536);
  assert.equal((await fetchRedditGateway("redditStorage", request, async () => new Response(body))).status, 200);
  assert.deepEqual(await fetchRedditGateway("redditStorage", request, async () => new Response(body + " ")),
    {status: 502, payload: {ok: false, error: "gateway-response-too-large"}});
});

test("rejects route escapes and malformed requests before any transmission", async () => {
  /** Invalid destinations or envelopes cannot reach even the fixture transport. */
  let calls = 0;
  /** A fixture that must remain uncalled. */
  const fetcher: typeof fetch = async () => {calls++; return Response.json({ok: true});};
  for (const route of ["../redditStorage", "redditStorage?redirect=x", "https://other.invalid", "redditStorage/", "unknown", ""])
    assert.equal((await fetchRedditGateway(route, request, fetcher)).status, 502);
  for (const input of [{...request, signature: "bad\r\nsignature"}, {...request, body: "a".repeat(72 * 1024 + 1)}])
    assert.equal((await fetchRedditGateway("redditStorage", input, fetcher)).status, 502);
  assert.equal(calls, 0);
});

test("returns fixed diagnostics for network failures, malformed JSON and a redirected response", async () => {
  assert.deepEqual(await fetchRedditGateway("deleteRedditAccount", request, async () => {
    throw new Error("fixture private response or credential detail");
  }), {status: 502, payload: {ok: false, error: "gateway-unavailable"}});
  for (const body of ["", "<html>wrong destination</html>", "{broken"])
    assert.deepEqual(await fetchRedditGateway("redditStorage", request, async () => new Response(body)),
      {status: 502, payload: {ok: false, error: "gateway-invalid-response"}});
  /** A runtime that already followed a redirect cannot yield accepted gateway state. */
  const redirected = Response.json({ok: true});
  Object.defineProperty(redirected, "redirected", {value: true});
  assert.deepEqual(await fetchRedditGateway("redditStorage", request, async () => redirected),
    {status: 502, payload: {ok: false, error: "gateway-redirect-rejected"}});
});

test("the ten-second deadline covers a stalled body even when a transport ignores abort", async t => {
  t.mock.timers.enable({apis: ["setTimeout"]});
  /** Records abort separately from fixture stream cancellation. */
  let signal: AbortSignal | undefined;
  /** Stream has headers but never produces any response bytes. */
  let cancelled = false;
  /** The actual reader must be released even if the SDK does not link body reads to abort. */
  const stream = new ReadableStream<Uint8Array>({
    /** Simulates a provider whose cancellation acknowledgement never arrives. */
    cancel() {cancelled = true; return new Promise<void>(() => {});},
  });
  /** One in-flight request awaits the deadline. */
  const pending = fetchRedditGateway("redditStorage", request, async (_, options) => {
    signal = options?.signal ?? undefined; return new Response(stream);
  });
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(10_000);
  assert.deepEqual(await pending, {status: 504, payload: {ok: false, error: "gateway-timeout"}});
  assert.equal(signal?.aborted, true); assert.equal(cancelled, true);
});

test("ignores late headers after the deadline and cancels the body without consuming it", async t => {
  t.mock.timers.enable({apis: ["setTimeout"]});
  /** A transport that does not honor abort resolves only after the caller has timed out. */
  let resolveResponse: (response: Response) => void = () => {};
  /** Native response body must not be accepted after a late connection completes. */
  let cancelled = false;
  /** No response bytes are delivered by this late fixture. */
  const stream = new ReadableStream<Uint8Array>({
    /** Discards a provider body received after authorization already timed out. */
    cancel() {cancelled = true;},
  });
  /** One header wait must still be bounded by the transport's own deadline. */
  const pending = fetchRedditGateway("redditStorage", request, () => new Promise(resolve => {resolveResponse = resolve;}));
  t.mock.timers.tick(10_000);
  assert.deepEqual(await pending, {status: 504, payload: {ok: false, error: "gateway-timeout"}});
  resolveResponse(new Response(stream));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(cancelled, true);
});
