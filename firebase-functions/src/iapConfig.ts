import iap from "in-app-purchase";
import fs from "fs";
import path from "path";

let appleSharedSecret: string | undefined;
let finalGoogleServiceAccountForIap: Record<string, unknown> | undefined; // This will be populated from process.env
let iapGoogleCredentials: {clientEmail: string; privateKey: string} | undefined;
let isIapInitialized = false;

export function initializeIapConfig(): void {
  const scriptVersion = "iapConfig_v1.0.1_env_vars"; // Added version log
  console.error(`[iapConfig Initialize] scriptVersion: ${scriptVersion}`); // Added version log

  const isJestEnvironment = !!process.env.JEST_WORKER_ID;

  if (isIapInitialized && !isJestEnvironment) {
    console.error("[iapConfig] Already initialized. Skipping re-initialization.");
    return;
  }

  appleSharedSecret = process.env.APPLE_SHARED_SECRET;

  const isEmulatorRunning = process.env.FUNCTIONS_EMULATOR === "true";
  const isFirebaseFunctionsTestEnv = process.env.IS_FIREBASE_FUNCTIONS_TEST === "true";
  const serviceAccountPathFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH; // For local tests primarily

  console.error(
    `[iapConfig Initialize] isEmulatorRunning: ${isEmulatorRunning}, isJestEnvironment: ${isJestEnvironment}, isFirebaseFunctionsTestEnv: ${isFirebaseFunctionsTestEnv}`,
  );
  console.error(`[iapConfig Initialize] serviceAccountPathFromEnv: ${serviceAccountPathFromEnv}`);
  console.error(`[iapConfig Initialize] GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

  // Logic for loading Google Service Account
  if (isFirebaseFunctionsTestEnv && serviceAccountPathFromEnv) {
    // This path is for firebase-functions-test integration tests if a local JSON file is preferred
    console.error(
      `[iapConfig Firebase Functions Test Env] Attempting to load service account from local path: ${serviceAccountPathFromEnv}`,
    );
    try {
      const fullPath = path.resolve(process.cwd(), serviceAccountPathFromEnv);
      if (fs.existsSync(fullPath)) {
        const fileContents = fs.readFileSync(fullPath, "utf8");
        const parsedFile = JSON.parse(fileContents);
        // Populate finalGoogleServiceAccountForIap directly for this test scenario
        finalGoogleServiceAccountForIap = {
          client_email: parsedFile.client_email,
          private_key: parsedFile.private_key, // Raw private key from file
        };
        console.error(
          `[iapConfig Firebase Functions Test Env] Successfully loaded and parsed service account from ${fullPath}.`,
        );
      } else {
        console.error(
          `[iapConfig Firebase Functions Test Env] Service account file NOT FOUND at resolved path: ${fullPath}.`,
        );
        finalGoogleServiceAccountForIap = {privateKey: "TEST_KEY_FILE_NOT_FOUND"}; // Indicate error
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      console.error(
        `[iapConfig Firebase Functions Test Env] Error reading/parsing service account from file: ${errorMessage}`,
      );
      finalGoogleServiceAccountForIap = {privateKey: "TEST_KEY_PARSE_ERROR"}; // Indicate error
    }
  } else if (!isJestEnvironment) {
    // Deployed/production environment or emulator without local file path override
    // Attempt to parse GOOGLE_SERVICE_ACCOUNT from process.env, which should contain the JSON string.
    console.error("[iapConfig Prod/Deployed Env] Attempting to parse GOOGLE_SERVICE_ACCOUNT from process.env.");
    const googleServiceAccountJsonString = process.env.GOOGLE_SERVICE_ACCOUNT;

    if (googleServiceAccountJsonString) {
      try {
        const parsedServiceAccount = JSON.parse(googleServiceAccountJsonString);
        if (parsedServiceAccount.client_email && parsedServiceAccount.private_key) {
          finalGoogleServiceAccountForIap = {
            client_email: parsedServiceAccount.client_email,
            private_key: parsedServiceAccount.private_key, // Will be processed below
          };
          console.error("[iapConfig Prod/Deployed Env] Successfully parsed GOOGLE_SERVICE_ACCOUNT from process.env.");
        } else {
          console.error(
            "[iapConfig Prod/Deployed Env] Parsed GOOGLE_SERVICE_ACCOUNT is missing client_email or private_key.",
          );
          finalGoogleServiceAccountForIap = undefined;
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        console.error(
          `[iapConfig Prod/Deployed Env] Error parsing GOOGLE_SERVICE_ACCOUNT JSON string: ${errorMessage}`,
        );
        finalGoogleServiceAccountForIap = undefined;
      }
    } else {
      console.error("[iapConfig Prod/Deployed Env] GOOGLE_SERVICE_ACCOUNT is missing in process.env.");
      finalGoogleServiceAccountForIap = undefined;
    }
  } else if (isJestEnvironment && !serviceAccountPathFromEnv) {
    // Jest unit tests - iap.config() will be skipped/mocked.
    console.error(
      "[iapConfig Jest Unit Test] GOOGLE_SERVICE_ACCOUNT_JSON_PATH not set. This is okay for unit tests as iap.config() is skipped.",
    );
    finalGoogleServiceAccountForIap = {privateKey: "JEST_UNIT_TEST_PLACEHOLDER_KEY"};
  }

  if (!appleSharedSecret && !isJestEnvironment) {
    // Also check !isJestEnvironment here
    console.warn(
      // Changed to warn as it might not be critical if only Google Play is used
      "[iapConfig] Missing APPLE_SHARED_SECRET from process.env. IAP validation for Apple will not work.",
    );
  }

  let processedPrivateKey = finalGoogleServiceAccountForIap?.private_key as string | undefined;

  if (finalGoogleServiceAccountForIap && processedPrivateKey) {
    // The private_key from service account JSON often has literal \n.
    // If GOOGLE_PRIVATE_KEY is set directly in Firebase env vars, newlines should be actual newlines.
    // This processing step standardizes it.
    // If already processed (e.g. from a file read for tests), this might be redundant but harmless.
    processedPrivateKey = String(processedPrivateKey).replace(/\\n/g, "\n");
    console.error("[iapConfig Shared] Processed private key (standardized newlines).");
  }

  iapGoogleCredentials =
    finalGoogleServiceAccountForIap?.client_email && processedPrivateKey
      ? {
          clientEmail: finalGoogleServiceAccountForIap.client_email as string,
          privateKey: processedPrivateKey as string, // Use the processed one
        }
      : undefined;

  if (!iapGoogleCredentials) {
    console.error(
      "[iapConfig Shared] iapGoogleCredentials object is UNDEFINED. This will likely cause iap.config to fail for Google Play.",
    );
    if (finalGoogleServiceAccountForIap) {
      console.error(
        `[iapConfig Shared] Details of finalGoogleServiceAccountForIap: client_email exists? ${!!finalGoogleServiceAccountForIap.client_email}, privateKey exists? ${!!finalGoogleServiceAccountForIap.private_key}`,
      );
    } else {
      console.error(
        "[iapConfig Shared] finalGoogleServiceAccountForIap was also undefined (no env vars or test file found).",
      );
    }
  } else {
    console.error(
      `[iapConfig Shared] iapGoogleCredentials CONSTRUCTED. Client Email: ${iapGoogleCredentials.clientEmail}`,
    );
  }

  if (!isJestEnvironment) {
    try {
      console.error("[iapConfig Attempting iap.config()] Test mode for iap.config: ", isFirebaseFunctionsTestEnv);
      iap.config({
        test: isFirebaseFunctionsTestEnv,
        applePassword: appleSharedSecret, // from process.env
        googleServiceAccount: iapGoogleCredentials, // from process.env or test file
      });
      console.error("[iapConfig] iap.config() called successfully.");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[iapConfig] CRITICAL: Error calling iap.config(): ${errorMessage}. Stack: ${error instanceof Error ? error.stack : "N/A"}`,
      );
    }
  } else {
    console.error("[iapConfig Jest Unit Test] SKIPPING iap.config() call as module should be mocked by test.");
  }

  isIapInitialized = true;
}

// Product Definitions (these are fine as top-level exports)
export const NO_ADS_PRODUCT_ID = "com.qwordly.no_ads";
export const BACKEND_COIN_PRODUCT_DETAILS: {
  [key: string]: {id: string; coins: number};
} = {
  COIN_PACK_SMALL: {id: "com.qwordly.coinpack.small", coins: 100},
  COIN_PACK_MEDIUM: {id: "com.qwordly.coinpack.medium", coins: 500},
  COIN_PACK_LARGE: {id: "com.qwordly.coinpack.large", coins: 1200},
};

// Automatically initialize if not in a Jest test environment
if (process.env.JEST_WORKER_ID === undefined) {
  console.error("[iapConfig] Not in Jest environment, auto-initializing.");
  initializeIapConfig();
} else {
  // For Jest, initialization is expected to be called explicitly by test setup if needed,
  // but iap.config() itself will be skipped as per logic above / mocked by tests.
  console.error(
    "[iapConfig] In Jest environment, explicit initializeIapConfig() call needed by tests (iap.config() will be skipped/mocked).",
  );
}

// Export a getter for iapGoogleCredentials if other modules need it after init
export function getIapGoogleCredentials() {
  if (!isIapInitialized) console.warn("[iapConfig] getIapGoogleCredentials called before initialization!");
  return iapGoogleCredentials;
}

export function getAppleSharedSecret() {
  if (!isIapInitialized) console.warn("[iapConfig] getAppleSharedSecret called before initialization!");
  return appleSharedSecret;
}
