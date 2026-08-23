import {firebaseEnvironment} from "../firebaseEnvironment";
import {configureBrowserErrorReporter} from "./browserErrorReporter";
import {captureBrowserException, initializeBrowserSentry} from "./sentry";
import {isBrowserTelemetryRuntimeAllowed} from "./telemetryRuntime";

/** Initializes browser telemetry from Vite's production environment. */
export function initializeBrowserSentryFromEnvironment(): boolean {
  const runtime = firebaseEnvironment.platformTarget;
  if ((runtime !== "jest" && runtime !== "facebook") || !isBrowserTelemetryRuntimeAllowed()) {
    configureBrowserErrorReporter(null);
    return false;
  }
  const initialized = initializeBrowserSentry({
    dsn: firebaseEnvironment.sentryDsn,
    environment: firebaseEnvironment.sentryEnvironment,
    production: firebaseEnvironment.production,
    release: firebaseEnvironment.sentryRelease,
    runtime,
  });
  configureBrowserErrorReporter(initialized ? captureBrowserException : null);
  return initialized;
}
