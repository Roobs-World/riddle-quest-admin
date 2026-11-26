import type {MiddlewareHandler} from "hono";
import {isProtectedPayload, parsePayloadEnvelope, protectPayload, readProtectedPayload, type PayloadContext} from "../../../../../src/platform/transport/payloadProtection";
import {readRedditJson, REDDIT_REQUEST_BYTES, REDDIT_RESPONSE_BYTES, redditProtectedWireBytes, serializeRedditPayload} from "../shared/redditPayloadTransport";

/** Decrypts browser API requests before domain validation and protects the complete final response. */
export const redditPayloadProtection: MiddlewareHandler = async (context, next) => {
  if (context.req.method !== "POST") return next();
  let payloadContext: PayloadContext | undefined;
  const reply = async (payload: unknown, status: number): Promise<Response> => Response.json(
    payloadContext ? await protectPayload(payload, {...payloadContext, direction: "response"}) : payload,
    {status, headers: {"cache-control": "no-store"}},
  );
  try {
    const wirePayload = context.req.raw.body
      ? await readRedditJson(context.req.raw.body, redditProtectedWireBytes(REDDIT_REQUEST_BYTES)) : {};
    let payload = wirePayload;
    if (isProtectedPayload(wirePayload)) {
      const envelope = parsePayloadEnvelope(wirePayload);
      payloadContext = {operation: context.req.path, direction: "request", requestId: envelope.requestId};
      payload = await readProtectedPayload(envelope, payloadContext);
    }
    const body = serializeRedditPayload(payload, REDDIT_REQUEST_BYTES);
    const headers = new Headers(context.req.raw.headers);
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    context.req.raw = new Request(context.req.raw, {headers, body});
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "reddit-payload-too-large";
    return reply({ok: false, error: tooLarge ? "request-too-large" : "invalid-json"}, tooLarge ? 413 : 400);
  }
  await next();
  if (!payloadContext) return;
  const original = context.res;
  let payload: unknown;
  try {
    payload = await readRedditJson(original.body, REDDIT_RESPONSE_BYTES);
  } catch {
    context.res = await reply({ok: false, error: "gateway-invalid-response"}, 502);
    return;
  }
  const headers = new Headers(original.headers);
  headers.set("content-type", "application/json");
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  headers.delete("etag");
  context.res = new Response(JSON.stringify(await protectPayload(payload, {...payloadContext, direction: "response"})), {
    status: original.status, headers,
  });
};
