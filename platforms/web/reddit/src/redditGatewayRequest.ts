import {assertSecureBrowserOrigin} from "../../../../src/platform/browser/secureTransport";
import {createPayloadRequestId, protectPayload, readProtectedPayload} from "../../../../src/platform/transport/payloadProtection";
import {withRedditGatewayDeadline} from "./redditGatewayDeadline";
import {readRedditJson, REDDIT_REQUEST_BYTES, REDDIT_RESPONSE_BYTES, redditProtectedWireBytes, serializeRedditPayload} from "./shared/redditPayloadTransport";

/** Rejects paths that could escape Reddit's same-origin Devvit gateway namespace. */
const assertRedditGatewayPath = (path: string): void => {
  if (!/^\/api\/[A-Za-z0-9._/-]+$/u.test(path) || path.includes("//") ||
      path.split("/").some(segment => segment === "." || segment === "..")) {
    throw new Error("invalid-reddit-gateway-path");
  }
};

/** Protects every browser API body while retaining same-origin TLS and HTTP error categories. */
export async function requestRedditGateway(path: string, body: unknown = {}): Promise<{
  /** HTTP success remains independent of the decoded application's result. */ ok: boolean;
  /** Original gateway status for host error classification. */ status: number;
  /** Authenticated JSON, still subject to the caller's domain validation. */ payload: unknown;
}> {
  assertRedditGatewayPath(path);
  assertSecureBrowserOrigin({allowInsecureLoopback: import.meta.env.DEV});
  serializeRedditPayload(body, REDDIT_REQUEST_BYTES);
  return withRedditGatewayDeadline(async signal => {
    const requestId = createPayloadRequestId();
    const protectedBody = await protectPayload(body, {operation: path, direction: "request", requestId});
    const wireBody = serializeRedditPayload(protectedBody, redditProtectedWireBytes(REDDIT_REQUEST_BYTES));
    signal.throwIfAborted();
    const response = await fetch(new URL(path, location.origin).href, {
      method: "POST", redirect: "error", headers: {"content-type": "application/json"}, body: wireBody, signal,
    });
    const wirePayload = await readRedditJson(response.body, redditProtectedWireBytes(REDDIT_RESPONSE_BYTES));
    const payload = await readProtectedPayload(wirePayload, {operation: path, direction: "response", requestId});
    serializeRedditPayload(payload, REDDIT_RESPONSE_BYTES);
    return {ok: response.ok, status: response.status, payload};
  });
}
