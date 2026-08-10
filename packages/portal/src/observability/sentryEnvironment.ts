import {initializeBrowserSentry} from "./sentry";

/** Initializes browser telemetry from Vite's production environment. */
export function initializeBrowserSentryFromEnvironment(): boolean {
  return initializeBrowserSentry({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
    production: import.meta.env.PROD,
    release: import.meta.env.VITE_SENTRY_RELEASE,
  });
}
