import * as Sentry from "@sentry/browser";
import {
  redactBrowserSentryEvent,
  redactBrowserTelemetry,
  resolveSecureBrowserSentryDsn,
} from "./sentryPrivacy";

/** Describes the build-time settings used to initialize browser telemetry. */
type BrowserSentryConfiguration = {
  /** Public HTTPS endpoint for the Sentry project. */
  dsn?: string;
  /** Deployment environment attached to every event. */
  environment?: string;
  /** Indicates whether this is a production build. */
  production: boolean;
  /** Immutable application release identifier. */
  release?: string;
};

/** Tracks whether the browser SDK has been initialized by this application. */
let initialized = false;

/** Sentry defaults that collect product/session context beyond an error itself. */
const nonEssentialBrowserIntegrations = new Set([
  "Breadcrumbs",
  "BrowserSession",
  "ConversationId",
  "CultureContext",
  "HttpContext",
]);

/**
 * Initializes privacy-safe browser error reporting once for production builds.
 *
 * Sentry's error integrations collect uncaught exceptions and unhandled
 * promise rejections. Product/session context and console-capture integrations
 * are deliberately excluded so this remains essential errors-only telemetry.
 *
 * @param configuration Build-time Sentry settings.
 * @returns Whether Sentry is configured and available for event capture.
 */
export function initializeBrowserSentry(configuration: BrowserSentryConfiguration): boolean {
  if (initialized) return true;
  const dsn = resolveSecureBrowserSentryDsn(configuration.dsn);
  if (!configuration.production || !dsn) return false;

  Sentry.init({
    dsn,
    enabled: true,
    environment: configuration.environment?.trim() || "production",
    release: configuration.release?.trim() || undefined,
    sampleRate: 1,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: (defaults) => defaults.filter(({name}) => !nonEssentialBrowserIntegrations.has(name)),
    beforeSend: (event) => redactBrowserSentryEvent(event),
    beforeSendTransaction: (event) => redactBrowserSentryEvent(event),
  });
  Sentry.setTag("runtime", "jest-html5");
  initialized = true;
  return true;
}

/**
 * Reports a caught browser exception with privacy-safe diagnostic context.
 *
 * @param error Caught exception or rejected value.
 * @param context Non-sensitive diagnostic fields describing the failed operation.
 */
export function captureBrowserException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(redactBrowserTelemetry(context) as Record<string, unknown>);
    Sentry.captureException(error);
  });
}

/** Resets module state for deterministic unit tests. */
export function resetBrowserSentryForTests(): void {
  initialized = false;
}
