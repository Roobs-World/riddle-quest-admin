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

/** Internal controls that are never forwarded to the Firebase runtime. */
interface CallableBoundaryOptions {
  /** Deletion itself writes the guard and must not acquire a shared lease. */
  skipJestAccountOperationLease?: boolean;
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
  return onCall<T, Promise<Result>, Stream>(options, async (request, response) => {
    /** Provides invoke behavior. */
    const invoke = () => invokeWithSentry(functionName, handler, [request, response]);
    if (boundaryOptions.skipJestAccountOperationLease || !request.auth) {
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
  });
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
