import * as functions from "firebase-functions";
import iap from "in-app-purchase";
import fs from "fs";
import path from "path";

const appleSharedSecret = functions.config().apple?.shared_secret;
let finalGoogleServiceAccountForIap: Record<string, unknown> | undefined;

// Check for emulator environment (set by `firebase emulators:exec`)
// and specific test environment variable set by our test script.
const isEmulatorRunning = process.env.FUNCTIONS_EMULATOR === "true";
const isJestTestEnv = process.env.IS_FIREBASE_FUNCTIONS_TEST === "true"; // From jest:with-env
const isTestEnvironment = isEmulatorRunning && isJestTestEnv;

const serviceAccountPathFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;

console.error(
  `[iapConfig Pre-check] isEmulatorRunning: ${isEmulatorRunning}, isJestTestEnv: ${isJestTestEnv}, isTestEnvironment: ${isTestEnvironment}`,
);
console.error(`[iapConfig Pre-check] serviceAccountPathFromEnv: ${serviceAccountPathFromEnv}`);
console.error(`[iapConfig Pre-check] GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

if (isTestEnvironment && serviceAccountPathFromEnv) {
  console.error(`[iapConfig Test Env] Attempting to load service account from: ${serviceAccountPathFromEnv}`);
  try {
    // Assume serviceAccountPathFromEnv is relative to the CWD of the test script,
    // which should be the 'firebase-functions' directory.
    const fullPath = path.resolve(process.cwd(), serviceAccountPathFromEnv);
    console.error(`[iapConfig Test Env] Resolved fullPath: ${fullPath}`);
    console.error(`[iapConfig Test Env] Current CWD (process.cwd()): ${process.cwd()}`);

    if (fs.existsSync(fullPath)) {
      const fileContents = fs.readFileSync(fullPath, "utf8");
      finalGoogleServiceAccountForIap = JSON.parse(fileContents);
      console.error(
        `[iapConfig Test Env] Successfully loaded and parsed service account from ${fullPath}. Client email: ${finalGoogleServiceAccountForIap?.client_email}`,
      );
    } else {
      console.error(
        `[iapConfig Test Env] Service account file NOT FOUND at resolved path: ${fullPath}. GOOGLE_SERVICE_ACCOUNT_JSON_PATH was ${serviceAccountPathFromEnv}. CWD: ${process.cwd()}`,
      );
      // Use a clearly identifiable placeholder that would cause iap.config to fail if clientEmail is essential
      finalGoogleServiceAccountForIap = {
        // No clientEmail here to force a failure if this path is taken
        privateKey: "-----BEGIN PRIVATE KEY-----\\nTEST_KEY_FILE_NOT_FOUND\\n-----END PRIVATE KEY-----\\n",
      };
      console.error("[iapConfig Test Env] Using placeholder Google config (file not found).");
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(
      `[iapConfig Test Env] Error reading/parsing service account from GOOGLE_SERVICE_ACCOUNT_JSON_PATH (${serviceAccountPathFromEnv}): ${errorMessage}`,
    );
    finalGoogleServiceAccountForIap = {
      // No clientEmail here
      privateKey: "-----BEGIN PRIVATE KEY-----\\nTEST_KEY_PARSE_ERROR\\n-----END PRIVATE KEY-----\\n",
    };
    console.error("[iapConfig Test Env] Using placeholder Google config (error reading/parsing).");
  }
} else if (!isTestEnvironment) {
  // In non-test environments, rely on functions.config()
  console.error("[iapConfig Prod Env] Using functions.config() for service account.");
  finalGoogleServiceAccountForIap = functions.config().google?.service_account;
  if (!finalGoogleServiceAccountForIap?.client_email || !finalGoogleServiceAccountForIap?.private_key) {
    console.error(
      "[iapConfig Prod Env] Google Service Account details missing/incomplete from functions.config(). This is a critical error for production.",
    );
    // For production, this is a critical failure.
    // For safety, do not proceed with a faulty config.
    finalGoogleServiceAccountForIap = undefined;
  } else {
    console.error("[iapConfig Prod Env] Loaded service account from functions.config().");
  }
} else {
  // This case means isTestEnvironment is true BUT serviceAccountPathFromEnv is NOT set.
  console.error(
    "[iapConfig Test Env] Test environment detected, but GOOGLE_SERVICE_ACCOUNT_JSON_PATH is not set. This is an error for tests requiring IAP.",
  );
  finalGoogleServiceAccountForIap = {
    // No clientEmail
    privateKey: "-----BEGIN PRIVATE KEY-----\\nTEST_KEY_NO_ENV_PATH\\n-----END PRIVATE KEY-----\\n",
  };
  console.error("[iapConfig Test Env] Using placeholder due to missing GOOGLE_SERVICE_ACCOUNT_JSON_PATH.");
}

if (!appleSharedSecret && isTestEnvironment) {
  console.error(
    "[iapConfig Shared] Missing Apple Shared Secret. IAP validation for Apple might not be fully testable.",
  );
}

let processedPrivateKey = finalGoogleServiceAccountForIap?.privateKey;
if (processedPrivateKey && typeof processedPrivateKey === "string") {
  processedPrivateKey = processedPrivateKey.replace(/\\\\n/g, "\\n");
  console.error("[iapConfig Shared] Processed private key (replaced \\\\n with \\n).");
}

const iapGoogleCredentials =
  finalGoogleServiceAccountForIap?.client_email && processedPrivateKey
    ? {
        clientEmail: finalGoogleServiceAccountForIap.client_email as string,
        privateKey: processedPrivateKey as string,
      }
    : undefined;

if (!iapGoogleCredentials) {
  console.error(
    "[iapConfig Shared] iapGoogleCredentials object is UNDEFINED. This will likely cause iap.config to fail for Google Play.",
  );
  if (finalGoogleServiceAccountForIap) {
    console.error(
      `[iapConfig Shared] Details of finalGoogleServiceAccountForIap: client_email exists? ${!!finalGoogleServiceAccountForIap.client_email}, privateKey exists? ${!!finalGoogleServiceAccountForIap.privateKey}`,
    );
  } else {
    console.error("[iapConfig Shared] finalGoogleServiceAccountForIap was also undefined.");
  }
} else {
  console.error(
    `[iapConfig Shared] iapGoogleCredentials CONSTRUCTED. Client Email: ${iapGoogleCredentials.clientEmail}`,
  );
}

try {
  console.error("[iapConfig Shared] Attempting to call iap.config(). Test mode: ", isTestEnvironment);
  iap.config({
    test: isTestEnvironment, // Important for tests
    applePassword: appleSharedSecret, // from functions.config() or undefined
    googleServiceAccount: iapGoogleCredentials, // from file or functions.config() or undefined
    // verbose: true, // some iap libraries support this
  });
  console.error(
    "[iapConfig Shared] iap.config() called successfully. This is unexpected if there were prior credential errors.",
  );
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  console.error(
    `[iapConfig Shared] CRITICAL: Error calling iap.config(): ${errorMessage}. Stack: ${error instanceof Error ? error.stack : "N/A"}`,
  );
  // Do not re-throw in a library file; allow the importing module to handle or fail.
  // However, this error is the likely source of "Failed to load function definition".
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
