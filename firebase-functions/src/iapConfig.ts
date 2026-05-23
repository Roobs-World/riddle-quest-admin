import fs from "fs";
import path from "path";
import { captureException } from "./sentry";

let appleSharedSecret: string | undefined;
let finalGoogleServiceAccountForIap: Record<string, unknown> | undefined; // This will be populated from process.env
let iapGoogleCredentials: {clientEmail: string; privateKey: string} | undefined;
let isIapInitialized = false;

export function initializeIapConfig(): void {
  const scriptVersion = "iapConfig_v1.0.1_env_vars"; // Added version log
  console.log(`[iapConfig Initialize] scriptVersion: ${scriptVersion}`); // Changed to console.log

  const isJestEnvironment = !!process.env.JEST_WORKER_ID;

  if (isIapInitialized && !isJestEnvironment) {
    console.log("[iapConfig] Already initialized. Skipping re-initialization."); // Changed to console.log
    return;
  }

  appleSharedSecret = process.env.APPLE_SHARED_SECRET;

  const isEmulatorRunning = process.env.FUNCTIONS_EMULATOR === "true";
  const isFirebaseFunctionsTestEnv = process.env.IS_FIREBASE_FUNCTIONS_TEST === "true";
  const serviceAccountPathFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH; // For local tests primarily

  console.log(
    `[iapConfig Initialize] isEmulatorRunning: ${isEmulatorRunning}, isJestEnvironment: ${isJestEnvironment}, isFirebaseFunctionsTestEnv: ${isFirebaseFunctionsTestEnv}`,
  ); // Changed to console.log
  console.log(`[iapConfig Initialize] serviceAccountPathFromEnv: ${serviceAccountPathFromEnv}`); // Changed to console.log
  console.log(`[iapConfig Initialize] GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`); // Changed to console.log

  // Logic for loading Google Service Account
  if (isFirebaseFunctionsTestEnv && serviceAccountPathFromEnv) {
    // This path is for firebase-functions-test integration tests if a local JSON file is preferred
    console.log(
      `[iapConfig Firebase Functions Test Env] Attempting to load service account from local path: ${serviceAccountPathFromEnv}`,
    ); // Changed to console.log
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
        console.log(
          `[iapConfig Firebase Functions Test Env] Successfully loaded and parsed service account from ${fullPath}.`,
        ); // Changed to console.log
      } else {
        console.error(
          `[iapConfig Firebase Functions Test Env] Service account file NOT FOUND at resolved path: ${fullPath}.`,
        ); // Keep as error - actual problem
        finalGoogleServiceAccountForIap = {privateKey: "TEST_KEY_FILE_NOT_FOUND"}; // Indicate error
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      console.error(
        `[iapConfig Firebase Functions Test Env] Error reading/parsing service account from file: ${errorMessage}`,
      ); // Keep as error - actual problem
      captureException(e);
      finalGoogleServiceAccountForIap = {privateKey: "TEST_KEY_PARSE_ERROR"}; // Indicate error
    }
  } else if (!isJestEnvironment) {
    // Deployed/production environment or emulator without local file path override
    // Attempt to parse GOOGLE_SERVICE_ACCOUNT from process.env, which should contain the JSON string.
    console.log("[iapConfig Prod/Deployed Env] Attempting to parse GOOGLE_SERVICE_ACCOUNT from process.env."); // Changed to console.log
    const googleServiceAccountJsonString = process.env.GOOGLE_SERVICE_ACCOUNT;

    if (googleServiceAccountJsonString) {
      try {
        const parsedServiceAccount = JSON.parse(googleServiceAccountJsonString);
        if (parsedServiceAccount.client_email && parsedServiceAccount.private_key) {
          finalGoogleServiceAccountForIap = {
            client_email: parsedServiceAccount.client_email,
            private_key: parsedServiceAccount.private_key, // Will be processed below
          };
          console.log("[iapConfig Prod/Deployed Env] Successfully parsed GOOGLE_SERVICE_ACCOUNT from process.env."); // Changed to console.log
        } else {
          console.error(
            "[iapConfig Prod/Deployed Env] Parsed GOOGLE_SERVICE_ACCOUNT is missing client_email or private_key.",
          ); // Keep as error - actual problem
          finalGoogleServiceAccountForIap = undefined;
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        console.error(
          `[iapConfig Prod/Deployed Env] Error parsing GOOGLE_SERVICE_ACCOUNT JSON string: ${errorMessage}`,
        ); // Keep as error - actual problem
        captureException(e);
        finalGoogleServiceAccountForIap = undefined;
      }
    } else {
      console.log("[iapConfig Prod/Deployed Env] GOOGLE_SERVICE_ACCOUNT is missing in process.env."); // Changed to console.log - expected in Jest
      finalGoogleServiceAccountForIap = undefined;
    }
  } else if (isJestEnvironment && !serviceAccountPathFromEnv) {
    // Jest unit tests can use placeholder credentials.
    console.log(
      "[iapConfig Jest Unit Test] GOOGLE_SERVICE_ACCOUNT_JSON_PATH not set. This is okay for unit tests.",
    ); // Changed to console.log
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
    console.log("[iapConfig Shared] Processed private key (standardized newlines)."); // Changed to console.log
  }

  iapGoogleCredentials =
    finalGoogleServiceAccountForIap?.client_email && processedPrivateKey
      ? {
          clientEmail: finalGoogleServiceAccountForIap.client_email as string,
          privateKey: processedPrivateKey as string, // Use the processed one
        }
      : undefined;

  if (!iapGoogleCredentials) {
    console.log(
      "[iapConfig Shared] iapGoogleCredentials object is UNDEFINED. Google Play validation will fail until configured.",
    ); // Changed to console.log - expected in Jest environment
    if (finalGoogleServiceAccountForIap) {
      console.log(
        `[iapConfig Shared] Details of finalGoogleServiceAccountForIap: client_email exists? ${!!finalGoogleServiceAccountForIap.client_email}, privateKey exists? ${!!finalGoogleServiceAccountForIap.private_key}`,
      ); // Changed to console.log
    } else {
      console.log(
        "[iapConfig Shared] finalGoogleServiceAccountForIap was also undefined (no env vars or test file found).",
      ); // Changed to console.log
    }
  } else {
    console.log(
      `[iapConfig Shared] iapGoogleCredentials CONSTRUCTED. Client Email: ${iapGoogleCredentials.clientEmail}`,
    ); // Changed to console.log
  }

  isIapInitialized = true;
}

// Product Definitions (these are fine as top-level exports)
export const NO_ADS_PRODUCT_ID = "com.roobsworld.riddlequest.no_ads";
export const BACKEND_COIN_PRODUCT_DETAILS: {
  [key: string]: {id: string; coins: number};
} = {
  COIN_PACK_TINY:  {id: "com.roobsworld.riddlequest.coinpack1", coins: 50},
  COIN_PACK_SMALL: {id: "com.roobsworld.riddlequest.coinpack2", coins: 100},
  COIN_PACK_MID:   {id: "com.roobsworld.riddlequest.coinpack3", coins: 250},
  COIN_PACK_LARGE: {id: "com.roobsworld.riddlequest.coinpack4", coins: 500},
  COIN_PACK_HUGE:  {id: "com.roobsworld.riddlequest.coinpack5", coins: 1000},
  COIN_PACK_MEGA:  {id: "com.roobsworld.riddlequest.coinpack6", coins: 2000},
};

// Automatically initialize if not in a Jest test environment
if (process.env.JEST_WORKER_ID === undefined) {
  console.log("[iapConfig] Not in Jest environment, auto-initializing."); // Changed to console.log
  initializeIapConfig();
} else {
  // For Jest, initialization is expected to be called explicitly by test setup if needed.
  console.log(
    "[iapConfig] In Jest environment, explicit initializeIapConfig() call needed by tests.",
  ); // Changed to console.log
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

// Export a reset function for testing purposes
export function resetIapConfig(): void {
  appleSharedSecret = undefined;
  finalGoogleServiceAccountForIap = undefined;
  iapGoogleCredentials = undefined;
  isIapInitialized = false;
}
