import {contentProtectionRequest, protectContent} from "@riddle-quest/core/contentProtection";
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
import {isJestAccountDeletedError, runWithJestAccountOperationLease} from "../jest/jestAccountDeletion";
import {captureException, flushSentry} from "./sentry";

/**
 * Browsers cache a CORS preflight for only five seconds without this header,
 * so every guess spaced further apart paid an extra OPTIONS round trip.
 * Matches the Jest and Facebook identity endpoints.
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
  skipJestAccountOperationLease?: boolean | ((request: CallableRequest<unknown>) => boolean);
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
    /** Negotiates only the transport format before domain validation. */
    const negotiation = contentProtectionRequest(request.data);
    /** Preserves authentication and request metadata. */
    const decodedRequest = negotiation.protected ? {...request, data: negotiation.data} : request;
    /** Validates and authorizes domain actions before wrapping their response. */
    const invoke = async (): Promise<Result> => {
      /** Domain response never trusted back from the client. */
      const result = await invokeWithSentry(functionName, handler, [decodedRequest, response]);
      // Transport wrapping happens after handler validation and never changes authoritative state.
      return negotiation.protected ? await protectContent(result) as Result : result;
    };
    /** Only a caller-declared pure observer may skip the mutation lease for a streaming request. */
    const skipLease = typeof boundaryOptions.skipJestAccountOperationLease === "function"
      ? boundaryOptions.skipJestAccountOperationLease(request) : boundaryOptions.skipJestAccountOperationLease;
    if (skipLease || !request.auth) {
      return invoke();
    }
    /** Provides timeout seconds behavior. */
    const timeoutSeconds =
      typeof options.timeoutSeconds === "number" ? options.timeoutSeconds : BROWSER_CALLABLE_TIMEOUT_SECONDS;
    try {
      return await runWithJestAccountOperationLease(request.auth.uid, timeoutSeconds, invoke);
    } catch (error) {
      if (isJestAccountDeletedError(error)) {
        throw new HttpsError("failed-precondition", "This account was permanently deleted.");
      }
      throw error;
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
