import {contentProtectionRequest, protectContent} from "../../../src/content/transport/contentProtection.js";
import {
  isProtectedPayload, parsePayloadEnvelope, protectPayload, readProtectedPayload,
} from "../../../src/platform/transport/payloadProtection.js";
import type {
  CallableFunction,
  CallableOptions,
  CallableRequest,
  CallableResponse,
  HttpsFunction,
  HttpsOptions,
  Request,
} from "firebase-functions/v2/https";
import {HttpsError, onCall, onRequest} from "firebase-functions/v2/https";
import type {ScheduleFunction, ScheduleOptions, ScheduledEvent} from "firebase-functions/v2/scheduler";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {BROWSER_CALLABLE_TIMEOUT_SECONDS} from "./callableSecurity";
import {isAccountDeletedError, runWithAccountOperationLease} from "./accountDeletion";
import {captureException, flushSentry} from "./sentry";

/**
 * Browsers cache a CORS preflight for only five seconds without this header,
 * so every guess spaced further apart paid an extra OPTIONS round trip.
 * Matches the Facebook identity endpoint.
 */
const CALLABLE_PREFLIGHT_MAX_AGE_SECONDS = "3600";

/**
 * Lets browsers reuse one callable preflight instead of repeating it per request.
 *
 * @param callable Deployable callable produced by the Firebase SDK.
 * @returns The same callable, with its deployment metadata, advertising a preflight cache lifetime.
 */
function withCachedPreflight<Callable extends object>(callable: Callable): Callable {
  if (typeof callable !== "function") return callable;
  /** Forwards every request after marking preflight responses cacheable. */
  const cached = (request: Request, response: Parameters<HttpsFunction>[1]) => {
    if (request.method === "OPTIONS") response.setHeader("Access-Control-Max-Age", CALLABLE_PREFLIGHT_MAX_AGE_SECONDS);
    return (callable as unknown as HttpsFunction)(request, response);
  };
  return Object.defineProperties(cached, Object.getOwnPropertyDescriptors(callable)) as unknown as Callable;
}

/** Internal controls that are never forwarded to the Firebase runtime. */
interface CallableBoundaryOptions {
  /** Deletion and explicitly declared pure observers do not acquire the mutation lease. */
  skipAccountOperationLease?: boolean | ((request: CallableRequest<unknown>) => boolean);
}

/**
 * Executes a deployed handler and reports every thrown or rejected value.
 *
 * @param functionName Stable deployed function name used for issue triage.
 * @param handler Original Firebase handler.
 * @param args Invocation arguments supplied by the Firebase runtime.
 * @returns The original handler result.
 */
async function invokeWithSentry<Args extends unknown[], Result>(
  functionName: string,
  handler: (...args: Args) => Result | Promise<Result>,
  args: Args,
): Promise<Result> {
  try {
    return await handler(...args);
  } catch (error) {
    captureException(error, {firebaseFunction: functionName});
    await flushSentry();
    throw error;
  }
}

/**
 * Creates a Firebase callable whose handler failures are always sent to Sentry.
 *
 * @param functionName Stable deployed function name.
 * @param options Firebase callable deployment and security options.
 * @param handler Callable implementation.
 * @returns Deployable Firebase callable function.
 */
export function onCallWithSentry<T = unknown, Result = unknown, Stream = unknown>(
  functionName: string,
  options: CallableOptions<T>,
  handler: (request: CallableRequest<T>, response?: CallableResponse<Stream>) => Result | Promise<Result>,
  boundaryOptions: CallableBoundaryOptions = {},
): CallableFunction<T, Promise<Result>, Stream> {
  return withCachedPreflight(onCall<T, Promise<Result>, Stream>(options, async (request, response) => {
    let requestId: string | undefined;
    if (isProtectedPayload(request.data)) {
      try {requestId = parsePayloadEnvelope(request.data).requestId;}
      catch {throw new HttpsError("invalid-argument", "Invalid protected request.");}
    }
    try {
      let input = request.data;
      if (requestId) {
        try {
          input = await readProtectedPayload(input, {operation: functionName, direction: "request", requestId}) as T;
        } catch {throw new HttpsError("invalid-argument", "Invalid protected request.");}
      }
      // Older published clients retain their response-only content negotiation.
      const negotiation = contentProtectionRequest(input);
      const decodedRequest = {...request, data: negotiation.data};
      const protectedResponse = response && requestId ? {
        signal: response.signal,
        sendChunk: async (chunk: Stream) => response.sendChunk(await protectPayload(chunk,
          {operation: functionName, direction: "chunk", requestId}) as Stream),
      } satisfies CallableResponse<Stream> : response;
      const invoke = () => invokeWithSentry(functionName, handler, [decodedRequest, protectedResponse]);
      const skipLease = typeof boundaryOptions.skipAccountOperationLease === "function"
        ? boundaryOptions.skipAccountOperationLease(decodedRequest) : boundaryOptions.skipAccountOperationLease;
      const timeoutSeconds = typeof options.timeoutSeconds === "number" ? options.timeoutSeconds : BROWSER_CALLABLE_TIMEOUT_SECONDS;
      const result = skipLease || !decodedRequest.auth ? await invoke()
        : await runWithAccountOperationLease(decodedRequest.auth.uid, timeoutSeconds, invoke);
      if (requestId) return await protectPayload(result, {operation: functionName, direction: "response", requestId}) as Result;
      return negotiation.protected ? await protectContent(result) as Result : result;
    } catch (error) {
      const failure = isAccountDeletedError(error)
        ? new HttpsError("failed-precondition", "This account was permanently deleted.") : error;
      if (!requestId) throw failure;
      const callableFailure = failure instanceof HttpsError ? failure : new HttpsError("internal", "INTERNAL");
      const details = await protectPayload({code: callableFailure.code, message: callableFailure.message,
        details: callableFailure.details ?? null}, {operation: functionName, direction: "response", requestId});
      throw new HttpsError(callableFailure.code, "Protected game request failed.", details);
    }
  }));
}

/**
 * Creates an HTTP Firebase Function whose handler failures are always sent to Sentry.
 *
 * @param functionName Stable deployed function name.
 * @param options Firebase HTTP deployment and security options.
 * @param handler HTTP request implementation.
 * @returns Deployable Firebase HTTP function.
 */
export function onRequestWithSentry(
  functionName: string,
  options: HttpsOptions,
  handler: (request: Request, response: Parameters<HttpsFunction>[1]) => void | Promise<void>,
): HttpsFunction {
  return onRequest(options, (request, response) => invokeWithSentry(functionName, handler, [request, response]));
}

/**
 * Creates a scheduled Firebase Function whose handler failures are always sent to Sentry.
 *
 * @param functionName Stable deployed function name.
 * @param options Firebase scheduler deployment options.
 * @param handler Scheduled task implementation.
 * @returns Deployable Firebase scheduled function.
 */
export function onScheduleWithSentry(
  functionName: string,
  options: ScheduleOptions,
  handler: (event: ScheduledEvent) => void | Promise<void>,
): ScheduleFunction {
  return onSchedule(options, (event) => invokeWithSentry(functionName, handler, [event]));
}
