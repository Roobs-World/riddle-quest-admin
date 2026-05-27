import {getFunctions, httpsCallable} from "@react-native-firebase/functions";
import {getApp} from "@react-native-firebase/app";
import {ZodError, type ZodType} from "zod";
import {withSentrySpan} from "./sentry";

/**
 * Get Firebase Functions instance configured for the correct region.
 * All our functions are deployed to us-central1.
 */
export const getFirebaseFunctions = () => {
  return getFunctions(getApp(), "us-central1");
};

/**
 * Create an https callable function with the correct region configuration.
 * @param functionName - The name of the Firebase Function to call
 * @returns A callable function instance
 */
export const getCallableFunction = (functionName: string) => {
  const functions = getFirebaseFunctions();
  const callable = httpsCallable(functions, functionName);

  // Note: Timeout handling for riddle generation functions is configured
  // server-side in Firebase Functions (540 seconds = 9 minutes)
  // Client-side timeout will be handled by the calling code with appropriate retry logic

  return callable;
};

const summarizeZodIssues = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

export class FirebaseCallableValidationError extends Error {
  constructor(
    public readonly functionName: string,
    public readonly direction: "request" | "response",
    public readonly zodError: ZodError,
  ) {
    super(`Invalid ${direction} payload for ${functionName}: ${summarizeZodIssues(zodError)}`);
    this.name = "FirebaseCallableValidationError";
  }

  get issues(): ZodError["issues"] {
    return this.zodError.issues;
  }
}

const parseWithSchema = <T>(schema: ZodType<T>, data: unknown): T => {
  if (typeof schema.safeParse === "function") {
    const validation = schema.safeParse(data);
    if (!validation.success) {
      throw validation.error;
    }
    return validation.data;
  }

  return schema.parse(data);
};

export const getValidatedCallableFunction = <Input, Output>(
  functionName: string,
  inputSchema: ZodType<Input>,
  outputSchema: ZodType<Output>,
) => {
  const callable = getCallableFunction(functionName);

  return async (input: Input): Promise<Output> => {
    let validatedInput: Input;
    try {
      validatedInput = parseWithSchema(inputSchema, input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new FirebaseCallableValidationError(functionName, "request", error);
      }
      throw error;
    }

    return withSentrySpan(
      `firebase.callable.${functionName}`,
      "firebase.callable",
      async () => {
        const result = await callable(validatedInput);
        try {
          return parseWithSchema(outputSchema, result.data);
        } catch (error) {
          if (error instanceof ZodError) {
            throw new FirebaseCallableValidationError(functionName, "response", error);
          }
          throw error;
        }
      },
      {functionName},
    );
  };
};

export const callValidatedFunction = <Input, Output>(
  functionName: string,
  input: Input,
  inputSchema: ZodType<Input>,
  outputSchema: ZodType<Output>,
): Promise<Output> => getValidatedCallableFunction(functionName, inputSchema, outputSchema)(input);
