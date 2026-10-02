/** Fixed server gateway routes; callers cannot turn this helper into an arbitrary proxy. */
const ROUTES = new Set(["exchangeRedditIdentity", "deleteRedditAccount", "redditStorage", "redditGameplay"]);
/** Existing 64 KiB provider-response budget, now enforced during consumption. */
const RESPONSE_BYTES = 64 * 1024;
/** Allows the existing 64 KiB payload plus its signed context envelope. */
const REQUEST_BYTES = 72 * 1024;
/** One deadline covers headers and response consumption, with no automatic retry. */
const TIMEOUT_MS = 10_000;
/** Fixed diagnostics cannot expose provider bodies, credentials, user IDs or exceptions. */
type FailureCode = "gateway-route-not-allowed" | "gateway-request-invalid" | "gateway-redirect-rejected" |
  "gateway-response-too-large" | "gateway-invalid-response" | "gateway-unavailable" | "gateway-timeout";
/** Carries only an app-owned diagnostic across asynchronous reads. */
class GatewayFailure extends Error {
  /** App-owned failure classification. */
  readonly code: FailureCode;
  /** Preserves one fixed diagnostic; never wraps a provider exception. */
  constructor(code: FailureCode) {super("reddit-gateway-request-failed"); this.code = code;}
}
/** Returns the existing envelope shape for an unsuccessful server gateway attempt. */
const failure = (error: FailureCode) => ({payload: {ok: false, error}, status: error === "gateway-timeout" ? 504 : 502});

/** Sends one immutable server-created signed assertion to the approved first-party gateway. */
export async function fetchRedditGateway(
  functionName: string,
  request: {
    /** Server-created signature. */
    signature: string;
    /** Already serialized signed envelope. */
    body: string;
  },
  fetcher: typeof fetch = fetch,
): Promise<{
  /** Provider JSON or a fixed local failure. */
  payload: unknown;
  /** HTTP status. */
  status: number;
}> {
  if (!ROUTES.has(functionName)) return failure("gateway-route-not-allowed");
  if (!request || typeof request.signature !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(request.signature) ||
      typeof request.body !== "string" || request.body.length > REQUEST_BYTES || Buffer.byteLength(request.body) > REQUEST_BYTES)
    return failure("gateway-request-invalid");
  /** Request bytes and header are captured before any asynchronous provider work. */
  const body = request.body, signature = request.signature;
  /** Signals cancellation to the actual Devvit server fetch implementation. */
  const controller = new AbortController();
  /** Shared reader allows the deadline to stop consumption even if the SDK ignores abort. */
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  /** Timer is always removed once the bounded attempt has returned. */
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** A hard deadline also closes transports whose promises never reject on abort. */
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      void reader?.cancel().catch(() => undefined);
      reject(new GatewayFailure("gateway-timeout"));
    }, TIMEOUT_MS);
  });
  try {
    /** Provider reads never log or retain an untrusted failure body. */
    const attempt = (async () => {
      /** Redirects must never forward the signed assertion to another URL. */
      const response = await fetcher(`https://www.roobsworld.com/api/reddit-gateway/${functionName}`, {
        method: "POST", redirect: "manual",
        headers: {"content-type": "application/json", "x-riddle-quest-reddit-signature": signature},
        body, signal: controller.signal,
      });
      if (controller.signal.aborted || response.redirected || (response.status >= 300 && response.status < 400)) {
        void response.body?.cancel().catch(() => undefined);
        throw new GatewayFailure(controller.signal.aborted ? "gateway-timeout" : "gateway-redirect-rejected");
      }
      if (!response.body || !Number.isInteger(response.status) || response.status < 200 || response.status > 599)
        throw new GatewayFailure("gateway-invalid-response");
      reader = response.body.getReader();
      /** Buffer retains at most the existing response budget, not the whole remote stream. */
      const chunks: Uint8Array[] = [];
      /** Actual received bytes are checked before retention; content-length is not trusted. */
      let bytes = 0;
      for (;;) {
        /** Reads may be interrupted by the shared deadline. */
        const chunk = await reader.read();
        if (controller.signal.aborted) throw new GatewayFailure("gateway-timeout");
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > RESPONSE_BYTES) throw new GatewayFailure("gateway-response-too-large");
        chunks.push(chunk.value);
      }
      try {
        // Preserve provider JSON and error status for existing identity/kill-switch fallback.
        return {payload: JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(Buffer.concat(chunks))), status: response.status};
      } catch {throw new GatewayFailure("gateway-invalid-response");}
    })();
    return await Promise.race([attempt, deadline]);
  } catch (error) {
    return failure(error instanceof GatewayFailure ? error.code : controller.signal.aborted ? "gateway-timeout" : "gateway-unavailable");
  } finally {
    clearTimeout(timer);
    // Cleanup must not extend the request's deadline when a provider cancellation stalls.
    void reader?.cancel().catch(() => undefined);
    try {reader?.releaseLock();} catch { /* A cancelled pending read is already being released. */ }
  }
}
