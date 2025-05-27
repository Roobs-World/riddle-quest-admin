require("dotenv").config({path: __dirname + "/.env", override: true});

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

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
