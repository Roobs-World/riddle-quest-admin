import * as functions from "firebase-functions";
import iap from "in-app-purchase";
import fs from "fs";
import path from "path";

const appleSharedSecret = functions.config().apple?.shared_secret;
let finalGoogleServiceAccountForIap: Record<string, unknown> | undefined;

const isTestEnvironment = process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "test";
const serviceAccountPathFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;

if (isTestEnvironment && serviceAccountPathFromEnv) {
  try {
    // Attempt to resolve the path relative to the functions directory if it's a relative path
    const fullPath = path.resolve(__dirname, "..", serviceAccountPathFromEnv); // Assumes iapConfig.ts is in src/

    if (fs.existsSync(fullPath)) {
      const fileContents = fs.readFileSync(fullPath, "utf8");
      finalGoogleServiceAccountForIap = JSON.parse(fileContents);
      functions.logger.info(
        `Successfully loaded service account from ${fullPath} in test environment via GOOGLE_SERVICE_ACCOUNT_JSON_PATH.`,
      );
    } else {
      // Fallback if path.resolve doesn't work as expected or if path is truly wrong
      const directPath = serviceAccountPathFromEnv; // Try direct path
      if (fs.existsSync(directPath)) {
        const fileContents = fs.readFileSync(directPath, "utf8");
        finalGoogleServiceAccountForIap = JSON.parse(fileContents);
        functions.logger.info(
          `Successfully loaded service account from ${directPath} (direct path) in test environment via GOOGLE_SERVICE_ACCOUNT_JSON_PATH.`,
        );
      } else {
        functions.logger.error(
          `Service account file not found at resolved path: ${fullPath} or direct path: ${directPath} (from env var ${serviceAccountPathFromEnv}).`,
        );
        finalGoogleServiceAccountForIap = {
          clientEmail: "test-file-not-found@example.com",
          privateKey: "-----BEGIN PRIVATE KEY-----\nTEST_KEY_FILE_NOT_FOUND\n-----END PRIVATE KEY-----\n",
        };
        functions.logger.warn("Using placeholder Google config due to file not found in test env.");
      }
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    functions.logger.error(
      `Error reading/parsing service account from GOOGLE_SERVICE_ACCOUNT_JSON_PATH (${serviceAccountPathFromEnv}) in test: ${errorMessage}`,
    );
    finalGoogleServiceAccountForIap = {
      clientEmail: "test-parse-error@example.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nTEST_KEY_PARSE_ERROR\n-----END PRIVATE KEY-----\n",
    };
    functions.logger.warn("Using placeholder Google config due to error reading/parsing file in test env.");
  }
} else {
  // In non-test environments, or if GOOGLE_SERVICE_ACCOUNT_JSON_PATH is not set, rely on functions.config()
  finalGoogleServiceAccountForIap = functions.config().google?.service_account;
  if (!finalGoogleServiceAccountForIap?.client_email || !finalGoogleServiceAccountForIap?.private_key) {
    functions.logger.warn(
      "Google Service Account details missing/incomplete from functions.config(). Attempting to use placeholder for testing if applicable.",
    );
    if (isTestEnvironment) {
      finalGoogleServiceAccountForIap = {
        clientEmail: "test-no-path-or-config-issue@example.com",
        privateKey: "-----BEGIN PRIVATE KEY-----\nTEST_KEY_NO_PATH_OR_CONFIG_ISSUE\n-----END PRIVATE KEY-----\n",
      };
      functions.logger.warn(
        "Using placeholder Google config in test env (GOOGLE_SERVICE_ACCOUNT_JSON_PATH not set or functions.config() load failed).",
      );
    }
  }
}

if (!appleSharedSecret && isTestEnvironment) {
  // Only warn if missing in test env, as it's optional
  functions.logger.warn("Missing Apple Shared Secret. IAP validation for Apple might not be fully testable.");
}

let processedPrivateKey = finalGoogleServiceAccountForIap?.privateKey;
if (processedPrivateKey && typeof processedPrivateKey === "string") {
  processedPrivateKey = processedPrivateKey.replace(/\\n/g, "\n");
}

const iapGoogleCredentials =
  finalGoogleServiceAccountForIap?.client_email && processedPrivateKey
    ? {
        clientEmail: finalGoogleServiceAccountForIap.client_email as string,
        privateKey: processedPrivateKey as string,
      }
    : undefined;

if (isTestEnvironment && !iapGoogleCredentials && finalGoogleServiceAccountForIap) {
  // This condition means we parsed/got a service account, but it was still incomplete for iapGoogleCredentials
  functions.logger.warn(
    "Constructed iapGoogleCredentials object is undefined in test environment despite having a service account object. This implies missing client_email or private_key in the parsed/retrieved object.",
  );
} else if (isTestEnvironment && !finalGoogleServiceAccountForIap) {
  functions.logger.warn(
    "finalGoogleServiceAccountForIap was undefined before constructing iapGoogleCredentials. No dummy file loaded and no config from functions.config().",
  );
}

try {
  iap.config({
    test: isTestEnvironment,
    applePassword: appleSharedSecret,
    googleServiceAccount: iapGoogleCredentials,
  });
  if (isTestEnvironment) {
    functions.logger.info("iap.config() called successfully in iapConfig.ts (test environment).");
  }
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  functions.logger.error(
    `Error calling iap.config() in iapConfig.ts: ${errorMessage}. This might be acceptable in a test environment if in-app-purchase is mocked for tests.`,
  );
  // Do not re-throw; allow module to load so tests can use mocks.
}

// Product Definitions
export const NO_ADS_PRODUCT_ID = "com.qwordly.no_ads";

export const BACKEND_COIN_PRODUCT_DETAILS: {
  [key: string]: {id: string; coins: number};
} = {
  COIN_PACK_SMALL: {id: "com.qwordly.coinpack.small", coins: 100},
  COIN_PACK_MEDIUM: {id: "com.qwordly.coinpack.medium", coins: 500},
  COIN_PACK_LARGE: {id: "com.qwordly.coinpack.large", coins: 1200},
};
