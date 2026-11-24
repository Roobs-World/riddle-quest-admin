import {trackEvent, currentAnalyticsScreen} from "./eventsRuntime";
export * from "./eventsRuntime";

const CLIENT_ERROR_REPORT_LIMIT = 5;
const compact = (value: string, fallback: string) => value.normalize("NFKD")
  .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase().slice(0, 40) || fallback;

/** Gets button id. */
const getButtonId = (button: HTMLElement) => {
  /** Provides explicit behavior. */
  const explicit = button.dataset.analyticsId || button.dataset.tooltip;
  if (explicit) return compact(explicit, "button");
  if (button.classList.contains("key"))
    return button.classList.contains("utility") ? "keyboard_delete" : "keyboard_letter";
  if (button.classList.contains("guess-cell")) return "guess_slot";
  /** Provides class name behavior. */
  const className = Array.from(button.classList).find(
    (name) => !name.startsWith("active") && !name.startsWith("disabled"),
  );
  if (className) return compact(className, "button");
  return "button";
};

/** Provides install button analytics behavior. */
export const installButtonAnalytics = (root: Document = document) => {
  /** Provides on click behavior. */
  const onClick = (event: MouseEvent) => {
    /** Provides target behavior. */
    const target = event.target;
    if (!(target instanceof Element)) return;
    /** Provides button behavior. */
    const button = target.closest<HTMLElement>("button, [role='button']");
    if (!button || button.matches(":disabled, [aria-disabled='true']")) return;
    /** Provides screen behavior. */
    const screen = button.closest<HTMLElement>("[data-analytics-screen]")?.dataset.analyticsScreen;
    trackEvent("button_press", {
      button_id: getButtonId(button),
      screen_name: screen ? compact(screen, "unknown_screen") : currentAnalyticsScreen() || "unknown_screen",
    });
  };
  root.addEventListener("click", onClick, true);
  return () => root.removeEventListener("click", onClick, true);
};

/**
 * Reports bounded, privacy-safe browser failures without transmitting messages,
 * stack traces, URLs, player identifiers, or rejected values.
 */
export const installGlobalErrorAnalytics = (target: Window = window) => {
  /** Provides remaining reports behavior. */
  let remainingReports = CLIENT_ERROR_REPORT_LIMIT;
  /** Provides report behavior. */
  const report = (errorKind: "uncaught_error" | "unhandled_rejection") => {
    if (remainingReports <= 0) return;
    remainingReports -= 1;
    trackEvent("client_error", {error_kind: errorKind});
  };
  /** Provides on error behavior. */
  const onError = () => report("uncaught_error");
  /** Provides on unhandled rejection behavior. */
  const onUnhandledRejection = () => report("unhandled_rejection");
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onUnhandledRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
};
