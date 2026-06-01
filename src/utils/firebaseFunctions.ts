import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from "@react-native-firebase/functions";
import {getApp} from "@react-native-firebase/app";
import {ZodError, type ZodType, type ZodTypeAny, z} from "zod";
import {withSentrySpan} from "./sentry";

const getFunctionsEmulatorMarker = (): string | null => {
  const host = process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST?.trim();
  const parsedPort = Number(process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT ?? "5001");

  if (!host) {
    return null;
  }

  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 5001;

  return `${host}:${port}`;
};

/**
 * Get Firebase Functions instance configured for the correct region.
 * All our functions are deployed to us-central1.
 */
export const getFirebaseFunctions = () => {
  const functions = getFunctions(getApp(), "us-central1") as Functions & {__connectedEmulatorMarker?: string};
  const emulatorMarker = getFunctionsEmulatorMarker();

  if (emulatorMarker && functions.__connectedEmulatorMarker !== emulatorMarker) {
    const [host, portString] = emulatorMarker.split(":");
    const port = Number(portString);
    connectFunctionsEmulator(functions, host, port);
    functions.__connectedEmulatorMarker = emulatorMarker;
  }

  return functions;
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

const parseWithSchema = <S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> => {
  const validation = schema.safeParse(data);
  if (!validation.success) {
    throw validation.error;
  }
  return validation.data as z.infer<S>;
};
export const getValidatedCallableFunction = <IS extends ZodTypeAny, OS extends ZodTypeAny>(
  functionName: string,
  inputSchema: IS,
  outputSchema: OS,
) => {
  const callable = getCallableFunction(functionName);

  return async (input: z.infer<IS>): Promise<z.infer<OS>> => {
    let validatedInput: z.infer<IS>;
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
        const result = await callable(validatedInput as any);
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

export const callValidatedFunction = <IS extends ZodTypeAny, OS extends ZodTypeAny>(
  functionName: string,
  input: z.infer<IS>,
  inputSchema: IS,
  outputSchema: OS,
): Promise<z.infer<OS>> => getValidatedCallableFunction(functionName, inputSchema, outputSchema)(input);
