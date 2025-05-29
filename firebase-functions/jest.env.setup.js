/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({path: __dirname + "/.env", override: true});

// Ensure Jest environment is properly detected by iapConfig
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || "1";
process.env.NODE_ENV = "test";

// Set up Firebase credentials for integration tests
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Use the existing service account file for integration tests
  process.env.GOOGLE_APPLICATION_CREDENTIALS = __dirname + "/qwordly-admin-sdk.json";
}

// Set Firebase project for integration tests
if (!process.env.FIREBASE_PROJECT_ID) {
  process.env.FIREBASE_PROJECT_ID = "qwordly-6ba44";
}

// Set OpenAI API key for tests
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "YnDnl1dSucAApjYEN019-6hGt2ufiedaq4HsP-h7";
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
