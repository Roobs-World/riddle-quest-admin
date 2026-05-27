import {HttpsError} from "firebase-functions/v2/https";
import {ZodError, ZodType} from "zod";

const summarizeZodIssues = (error: ZodError): string =>
  error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");

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
    return result.data;
  }

  throw new HttpsError("internal", `Invalid response payload from ${functionName}: ${summarizeZodIssues(result.error)}`);
}
