/** Diagnostic fields that are safe for a configured browser error adapter to sanitize and report. */
export type BrowserErrorContext = Readonly<Record<string, unknown>>;

/** Target-provided adapter for reporting a caught browser failure. */
export type BrowserErrorReporter = (error: unknown, context?: BrowserErrorContext) => void | Promise<void>;

/** Default adapter used by Web Targets that deliberately ship without remote telemetry. */
const ignoreBrowserError: BrowserErrorReporter = () => undefined;

/** The active adapter is installed only by a target-owned entry point. */
let activeBrowserErrorReporter: BrowserErrorReporter = ignoreBrowserError;

/**
 * Installs a target-owned browser error adapter, or restores the no-op adapter.
 *
 * @param reporter Adapter selected by the active Web Target, or null when telemetry is unavailable.
 */
export function configureBrowserErrorReporter(reporter: BrowserErrorReporter | null): void {
  activeBrowserErrorReporter = reporter ?? ignoreBrowserError;
}

/**
 * Reports a caught browser failure through the adapter selected by the active Web Target.
 *
 * @param error Caught exception or rejected value.
 * @param context Non-sensitive fields describing the failed operation.
 */
export function captureBrowserException(error: unknown, context?: BrowserErrorContext): void {
  try {
    // Optional telemetry must not interrupt error recovery or reject an event handler.
    void Promise.resolve(activeBrowserErrorReporter(error, context)).catch(() => undefined);
  } catch {
    // Reporting failures cannot safely be reported through the same failing adapter.
  }
}

/** Restores the no-op adapter for deterministic unit tests. */
export function resetBrowserErrorReporterForTests(): void {
  activeBrowserErrorReporter = ignoreBrowserError;
}
