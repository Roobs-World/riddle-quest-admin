import {HttpsError} from "firebase-functions/v2/https";
import {ZodError, ZodType} from "zod";

/** Formats payload-free schema diagnostics for callable error messages. */
const summarizeZodIssues = (error: ZodError): string =>
  error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");

/** Recursively removes undefined plain-object fields so Firebase transport cannot coerce them to null. */
const omitUndefinedFields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(omitUndefinedFields);
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [key, omitUndefinedFields(nested)]),
  );
};

/** Fixed or schema-aware public message used for an invalid callable request. */
type InvalidRequestMessage = string | ((error: ZodError) => string);

/** Resolves an explicit invalid-request message or a payload-free schema summary. */
const getInvalidRequestMessage = (
  error: ZodError,
  functionName: string,
  invalidMessage?: InvalidRequestMessage,
): string => {
  if (typeof invalidMessage === "function") {
    return invalidMessage(error);
  }
  if (invalidMessage) {
    return invalidMessage;
  }
  return `Invalid request payload for ${functionName}: ${summarizeZodIssues(error)}`;
};

/**
 * Parses untrusted callable input at the function boundary.
 *
 * Validation returns Zod's parsed value, including schema transformations, and
 * never exposes the rejected payload in the default error message.
 *
 * @typeParam T - Trusted value produced by the supplied schema.
 * @param schema - Zod schema defining the callable's accepted request shape.
 * @param data - Untrusted `request.data` received from Firebase callable transport.
 * @param functionName - Stable function name included in the default diagnostic.
 * @param invalidMessage - Optional fixed or schema-aware client-safe error message.
 * @returns The parsed and validated request value.
 * @throws An `HttpsError` with code `invalid-argument` when validation fails.
 */
export function validateCallableRequest<T>(
  schema: ZodType<T>,
  data: unknown,
  functionName: string,
  invalidMessage?: InvalidRequestMessage,
): T {
  /** Provides result behavior. */
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  throw new HttpsError("invalid-argument", getInvalidRequestMessage(result.error, functionName, invalidMessage));
}

/**
 * Validates a callable result before it crosses the Firebase transport boundary.
 *
 * After Zod parsing, undefined properties are removed recursively from plain
 * objects because callable serialization would otherwise turn them into null
 * and violate the shape that was just validated. Arrays retain their positions,
 * and class instances or other non-plain objects are left unchanged.
 *
 * @typeParam T - Transport-safe value produced by the supplied schema.
 * @param schema - Zod schema defining the callable's public response contract.
 * @param data - Internal result to validate before returning it to the client.
 * @param functionName - Stable function name included in internal diagnostics.
 * @returns The parsed response with undefined plain-object fields omitted.
 * @throws An `HttpsError` with code `internal` when the implementation produces
 * a response outside its declared schema.
 */
export function validateCallableResponse<T>(schema: ZodType<T>, data: unknown, functionName: string): T {
  /** Provides result behavior. */
  const result = schema.safeParse(data);
  if (result.success) {
    // Firebase callable transport converts object properties containing
    // `undefined` to `null`. Optional schema fields must be omitted before the
    // payload crosses the wire so the client receives the same shape that was
    // validated here.
    return omitUndefinedFields(result.data) as T;
  }

  throw new HttpsError(
    "internal",
    `Invalid response payload from ${functionName}: ${summarizeZodIssues(result.error)}`,
  );
}
