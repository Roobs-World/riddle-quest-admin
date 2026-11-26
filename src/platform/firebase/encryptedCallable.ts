import {
  FunctionsError, httpsCallable, type Functions, type HttpsCallable, type HttpsCallableOptions,
  type HttpsCallableStreamOptions, type HttpsCallableStreamResult,
} from "firebase/functions";
import {z} from "zod";
import {
  createPayloadRequestId, isProtectedPayload, protectPayload, readProtectedPayload,
  type PayloadContext, type PayloadEnvelope,
} from "../transport/payloadProtection";

const CallableFailure = z.object({
  code: z.enum(["cancelled", "unknown", "invalid-argument", "deadline-exceeded", "not-found", "already-exists",
    "permission-denied", "resource-exhausted", "failed-precondition", "aborted", "out-of-range", "unimplemented",
    "internal", "unavailable", "data-loss", "unauthenticated"]),
  message: z.string().max(4096),
  details: z.unknown(),
}).strict();

async function rethrowCallableError(error: unknown, context: PayloadContext): Promise<never> {
  if (error instanceof FunctionsError && isProtectedPayload(error.details)) {
    const decoded = CallableFailure.parse(await readProtectedPayload(error.details, context));
    throw new FunctionsError(decoded.code, decoded.message, decoded.details);
  }
  // Firebase owns failures that occur before the application handler, including auth and App Check.
  throw error;
}

/** Preserves Firebase authentication and streaming while protecting app-owned JSON bodies. */
export function encryptedHttpsCallable<Input = unknown, Output = unknown, Stream = unknown>(
  functions: Functions, name: string, options?: HttpsCallableOptions,
): HttpsCallable<Input, Output, Stream> {
  const call = httpsCallable<PayloadEnvelope, unknown, unknown>(functions, name, options);
  const invoke = async (input?: Input | null) => {
    const context = {operation: name, direction: "response", requestId: createPayloadRequestId()} satisfies PayloadContext;
    try {
      const result = await call(await protectPayload(input ?? null, {...context, direction: "request"}));
      // Domain callers retain their existing schema validation after transport authentication.
      return {data: await readProtectedPayload(result.data, context) as Output};
    } catch (error) {return rethrowCallableError(error, context);}
  };
  invoke.stream = async (input?: Input | null, streamOptions?: HttpsCallableStreamOptions): Promise<HttpsCallableStreamResult<Output, Stream>> => {
    const context = {operation: name, direction: "response", requestId: createPayloadRequestId()} satisfies PayloadContext;
    try {
      const result = await call.stream(await protectPayload(input ?? null, {...context, direction: "request"}), streamOptions);
      const data = result.data.then(async value => await readProtectedPayload(value, context) as Output)
        .catch(error => rethrowCallableError(error, context));
      // Stream consumers may observe the final result after consuming chunks.
      void data.catch(() => undefined);
      return {
        data,
        stream: {
          async *[Symbol.asyncIterator]() {
            try {
              for await (const chunk of result.stream) {
                yield await readProtectedPayload(chunk, {...context, direction: "chunk"}) as Stream;
              }
            } catch (error) {await rethrowCallableError(error, context);}
          },
        },
      };
    } catch (error) {return rethrowCallableError(error, context);}
  };
  return invoke;
}
