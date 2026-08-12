/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({path: __dirname + "/.env", override: true});

// Ensure Jest environment is properly detected by iapConfig
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || "1";
process.env.NODE_ENV = "test";

// Unit tests that exercise the real purchase handler must opt in to the same
// trusted SKU boundary required in deployed environments.
if (!process.env.JEST_PRODUCT_SKUS) {
  process.env.JEST_PRODUCT_SKUS = "com.roobsworld.riddlequest.coinpack1";
}

// Set up Firebase credentials for integration tests
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Use the existing service account file for integration tests
  process.env.GOOGLE_APPLICATION_CREDENTIALS = __dirname + "/Riddle Quest-admin-sdk.json";
}

// Set Firebase project for integration tests - use test project for safety
if (!process.env.FIREBASE_PROJECT_ID) {
  process.env.FIREBASE_PROJECT_ID = "Riddle Quest-test-project"; // Use test project instead of production
}

// Ensure Firestore emulator is used for integration tests
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8099";
}

// Set OpenAI API key for tests
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "test-openai-api-key";
}

// Disable OpenTelemetry tracing in tests to avoid Firestore tracing issues
process.env.OTEL_SDK_DISABLED = "true";
process.env.GOOGLE_CLOUD_OPENTELEMETRY_ENABLED = "false";
process.env.OTEL_TRACES_EXPORTER = "none";
process.env.OTEL_METRICS_EXPORTER = "none";
process.env.OTEL_LOGS_EXPORTER = "none";
process.env.OTEL_RESOURCE_ATTRIBUTES = "";

// Disable Google Cloud tracing and profiling
process.env.GOOGLE_CLOUD_TRACE_ENABLED = "false";
process.env.GOOGLE_CLOUD_PROFILER_ENABLED = "false";

// Set up a global mock for functions.config() if it's accessed during module loading
if (typeof global !== "undefined") {
  global.mockFunctionsConfig = {};
}

// Suppress Firebase Functions logger console output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Store original methods globally so they can be restored if needed
global.originalConsoleMethods = {
  log: originalConsoleLog,
  error: originalConsoleError,
  warn: originalConsoleWarn,
  info: originalConsoleInfo,
};

// Override console methods to filter out Firebase Functions logger noise
console.log = (...args) => {
  const message = args.join(" ");
  // Allow test output but suppress Firebase logger noise
  if (
    !message.includes('{"severity":') &&
    !message.includes("beforeEach_") &&
    !message.includes("afterEach_") &&
    !message.includes("User testUserGameLogic") &&
    !message.includes("[iapConfig")
  ) {
    originalConsoleLog(...args);
  }
};

console.error = (...args) => {
  const message = args.join(" ");
  // Suppress Firebase logger JSON errors but allow actual test errors
  if (!message.includes('{"severity":"ERROR"')) {
    originalConsoleError(...args);
  }
};

console.warn = (...args) => {
  const message = args.join(" ");
  // Suppress Firebase logger JSON warnings and service account output
  if (
    !message.includes('{"severity":"WARNING"') &&
    !message.includes('{"client_email"') &&
    !message.includes('"private_key"')
  ) {
    originalConsoleWarn(...args);
  }
};

console.info = (...args) => {
  const message = args.join(" ");
  // Suppress Firebase logger JSON info messages
  if (!message.includes('{"severity":"INFO"')) {
    originalConsoleInfo(...args);
  }
};
