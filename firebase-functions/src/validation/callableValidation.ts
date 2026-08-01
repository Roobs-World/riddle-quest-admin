import {HttpsError} from "firebase-functions/v2/https";
import {ZodError, ZodType} from "zod";

const summarizeZodIssues = (error: ZodError): string =>
  error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");

const omitUndefinedFields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(omitUndefinedFields);
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [key, omitUndefinedFields(nested)]),
  );
};

type InvalidRequestMessage = string | ((error: ZodError) => string);

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

export function validateCallableRequest<T>(
  schema: ZodType<T>,
  data: unknown,
  functionName: string,
  invalidMessage?: InvalidRequestMessage,
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  throw new HttpsError("invalid-argument", getInvalidRequestMessage(result.error, functionName, invalidMessage));
}

export function validateCallableResponse<T>(schema: ZodType<T>, data: unknown, functionName: string): T {
  const result = schema.safeParse(data);
  if (result.success) {
    // Firebase callable transport converts object properties containing
    // `undefined` to `null`. Optional schema fields must be omitted before the
    // payload crosses the wire so the client receives the same shape that was
    // validated here.
    return omitUndefinedFields(result.data) as T;
  }

  throw new HttpsError("internal", `Invalid response payload from ${functionName}: ${summarizeZodIssues(result.error)}`);
}
