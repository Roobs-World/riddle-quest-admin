import {firebaseEnvironment} from "../firebaseEnvironment";
import {configureBrowserErrorReporter, type BrowserErrorContext} from "./browserErrorReporter";
import {resolveSecureBrowserSentryDsn} from "./sentryPrivacy";
import {isBrowserTelemetryRuntimeAllowed} from "./telemetryRuntime";

/** Optional SDK adapter remains outside the critical game entry graph. */
type SentryAdapter = Pick<typeof import("./sentry"), "captureBrowserException" | "initializeBrowserSentry">;
/** One startup owns loading and buffering, even if multiple consumers request initialization. */
let initialization: Promise<boolean> | null = null;
/** Replacement or test disposal invalidates late SDK delivery. */
let generation = 0;
/** Temporary global listeners and queued references are released on every terminal path. */
let cancelLoading = (): void => undefined;
/** Disallowed or replaced startup cannot retain listeners or install a late error adapter. */
const disposeBrowserSentryStartup = (): void => {
  generation++;
  cancelLoading();
  cancelLoading = () => undefined;
  initialization = null;
  configureBrowserErrorReporter(null);
};

/** Starts optional telemetry without delaying the game; early failures are buffered while its SDK loads. */
export function initializeBrowserSentryFromEnvironment(loadAdapter: () => Promise<SentryAdapter> = () => import("./sentry")): Promise<boolean> {
  /** Provides runtime behavior. */
  const runtime = firebaseEnvironment.platformTarget;
  if ((runtime !== "jest" && runtime !== "facebook") || !isBrowserTelemetryRuntimeAllowed() ||
    !firebaseEnvironment.production || !firebaseEnvironment.sentryDsn?.trim()) {
    disposeBrowserSentryStartup();
    return Promise.resolve(false);
  }
  if (initialization) return initialization;
  try {resolveSecureBrowserSentryDsn(firebaseEnvironment.sentryDsn);} catch {disposeBrowserSentryStartup(); return Promise.resolve(false);}
  /** This invocation alone may install or flush the error adapter. */
  const owner = ++generation;
  /** Bounded startup buffer retains caught errors without retaining unbounded gameplay state. */
  const buffered: Array<{
    /** Original startup failure, sanitized by the existing reporting adapter. */ error: unknown;
    /** Diagnostic fields supplied by the target. */ context?: BrowserErrorContext;
  }> = [];
  /** Uncaught and explicitly reported failures share the same bounded buffer. */
  const capture = (error: unknown, context?: BrowserErrorContext): void => {
    if (owner === generation && buffered.length < 20) buffered.push({error, context});
  };
  /** Capture startup errors before the optional SDK installs its own global handlers. */
  const onError = (event: ErrorEvent): void => capture(event.error ?? event.message, {error_kind: "uncaught_error"});
  /** Preserve rejected startup promises without producing a new unhandled rejection. */
  const onRejection = (event: PromiseRejectionEvent): void => capture(event.reason, {error_kind: "unhandled_rejection"});
  /** The same teardown runs after success, rejection and owner replacement. */
  const cleanup = (): void => {
    if (typeof window !== "undefined") {window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection);}
    buffered.length = 0;
  };
  cancelLoading = cleanup;
  configureBrowserErrorReporter(capture);
  if (typeof window !== "undefined") {window.addEventListener("error", onError); window.addEventListener("unhandledrejection", onRejection);}
  /** Delivery expiry permits an explicit retry while ignoring the original late chunk. */
  let timer: ReturnType<typeof setTimeout>;
  /** A stalled optional chunk cannot own startup reporting indefinitely. */
  const deadline = new Promise<boolean>(resolve => {timer = setTimeout(() => {
    if (owner === generation) disposeBrowserSentryStartup();
    resolve(false);
  }, 30000);});
  /** Actual delivery remains observed after expiry so rejection cannot escape to the game. */
  const delivery = Promise.resolve().then(loadAdapter).then(adapter => {
    if (owner !== generation) return false;
    if (!isBrowserTelemetryRuntimeAllowed()) {configureBrowserErrorReporter(null); return false;}
    /** Configuration still passes through the existing privacy-safe SDK initializer. */
    const enabled = adapter.initializeBrowserSentry({dsn: firebaseEnvironment.sentryDsn,
      environment: firebaseEnvironment.sentryEnvironment, production: firebaseEnvironment.production,
      release: firebaseEnvironment.sentryRelease, runtime});
    configureBrowserErrorReporter(enabled ? adapter.captureBrowserException : null);
    if (enabled) for (const {error, context} of buffered) {try {adapter.captureBrowserException(error, context);} catch {/* Optional reporting cannot reject game startup. */}}
    return enabled;
  }).catch(() => {if (owner === generation) configureBrowserErrorReporter(null); return false;});
  initialization = Promise.race([delivery, deadline])
    .then(enabled => {if (!enabled && owner === generation) initialization = null; return enabled;})
    .finally(() => {clearTimeout(timer); cleanup();});
  return initialization;
}

/** Releases optional startup ownership for deterministic tests and disabled runtimes. */
export function resetBrowserSentryEnvironmentForTests(): void {
  disposeBrowserSentryStartup();
}
