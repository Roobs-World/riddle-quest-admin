import {firebaseEnvironment} from "../firebaseEnvironment";
import {initializeBrowserSentry} from "./sentry";
import {isBrowserTelemetryRuntimeAllowed} from "./telemetryRuntime";

/** Initializes browser telemetry from Vite's production environment. */
export function initializeBrowserSentryFromEnvironment(): boolean {
  if (!isBrowserTelemetryRuntimeAllowed()) return false;
  return initializeBrowserSentry({
    dsn: firebaseEnvironment.sentryDsn,
    environment: firebaseEnvironment.sentryEnvironment,
    production: firebaseEnvironment.production,
    release: firebaseEnvironment.sentryRelease,
  });
}
