import type {HttpsFunction, HttpsOptions, Request} from "firebase-functions/v2/https";
import {isProtectedPayload, MAX_PAYLOAD_BYTES, parsePayloadEnvelope, protectPayload, readProtectedPayload} from "../../../src/platform/transport/payloadProtection.js";
import {onRequestWithSentry} from "./sentryHandlers";

type HttpHandler = (request: Request, response: Parameters<HttpsFunction>[1]) => void | Promise<void>;
type ProtectedJsonBoundary = Readonly<{
  maxDecodedBodyBytes: number;
  acceptRequest: (request: Request, response: Parameters<HttpsFunction>[1], maxRawBodyBytes: number) => boolean;
}>;

/** Encrypts only opted-in game-client JSON bodies and preserves legacy provider contracts. */
export function onProtectedJsonRequestWithSentry(
  functionName: string,
  options: HttpsOptions,
  handler: HttpHandler,
  boundary: ProtectedJsonBoundary,
): HttpsFunction {
  if (!Number.isSafeInteger(boundary.maxDecodedBodyBytes) || boundary.maxDecodedBodyBytes < 1 ||
      boundary.maxDecodedBodyBytes > MAX_PAYLOAD_BYTES) throw new Error("Invalid protected HTTP body limit.");
  const maxWireBodyBytes = Math.ceil((boundary.maxDecodedBodyBytes + 16) / 3) * 4 + 256;
  return onRequestWithSentry(functionName, options, async (request, response) => {
    const protectedRequest = isProtectedPayload(request.body);
    // Admission and its quota run once before parsing or decrypting untrusted envelopes.
    if (!boundary.acceptRequest(request, response, protectedRequest ? maxWireBodyBytes : boundary.maxDecodedBodyBytes)) return;
    if (!protectedRequest) {
      await handler(request, response);
      return;
    }
    let envelope: ReturnType<typeof parsePayloadEnvelope>;
    try {
      envelope = parsePayloadEnvelope(request.body);
    } catch {
      response.status(400).json({error: "invalid-request"});
      return;
    }
    const context = {operation: functionName, requestId: envelope.requestId};
    const send = async (body: unknown): Promise<void> => {
      response.json(await protectPayload(body, {...context, direction: "response"}));
    };
    let body: unknown;
    let rawBody: Buffer;
    try {
      body = await readProtectedPayload(envelope, {...context, direction: "request"});
      const serialized = JSON.stringify(body);
      if (serialized === undefined) throw new Error("invalid-request");
      rawBody = Buffer.from(serialized, "utf8");
    } catch {
      response.status(400);
      await send({error: "invalid-request"});
      return;
    }
    if (rawBody.byteLength > boundary.maxDecodedBodyBytes) {
      response.status(413);
      await send({error: "payload-too-large"});
      return;
    }
    const originalBody: unknown = request.body;
    const originalRawBody = request.rawBody;
    const originalJson = response.json;
    let captured = false;
    let responseBody: unknown;
    request.body = body;
    request.rawBody = rawBody;
    response.json = value => {
      captured = true;
      responseBody = value;
      return response;
    };
    try {
      await handler(request, response);
      response.json = originalJson;
      if (captured) await send(responseBody);
    } catch (error) {
      response.json = originalJson;
      if (!response.headersSent) {
        response.status(500);
        await send({error: "internal"});
      }
      throw error;
    } finally {
      response.json = originalJson;
      request.body = originalBody;
      request.rawBody = originalRawBody;
    }
  });
}
