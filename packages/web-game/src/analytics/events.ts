/** Describes analytics value. */
export type AnalyticsValue = string | number | boolean;
/** Describes analytics item. */
export type AnalyticsItem = Record<string, AnalyticsValue>;
/** Describes analytics params. */
export type AnalyticsParams = Record<string, AnalyticsValue | AnalyticsItem[] | undefined>;
/** Describes sanitized analytics params. */
export type SanitizedAnalyticsParams = Record<string, AnalyticsValue | AnalyticsItem[]>;
/** Describes analytics sink. */
export type AnalyticsSink = (eventName: string, params: SanitizedAnalyticsParams) => void | Promise<void>;

/** Native host analytics is independent of the consent-gated external sink. */
let platformSink: AnalyticsSink | null = null;

/** Isolates optional delivery failures from game operations and browser error listeners. */
const deliver = (destination: AnalyticsSink, name: string, params: SanitizedAnalyticsParams) => {
  try {
    void Promise.resolve(destination(name, params)).catch(() => {});
  } catch {
    // Provider analytics must never interrupt gameplay.
  }
};

/** Connects an initialized target's native SDK and returns ownership-safe cleanup. */
export const configurePlatformAnalytics = (destination: AnalyticsSink) => {
  platformSink = destination;
  if (lastScreen) deliver(destination, "screen_view", {screen_name: lastScreen, screen_class: "RiddleQuestWeb"});
  return () => {
    if (platformSink === destination) platformSink = null;
  };
};

/** Provides sink behavior. */
let sink: AnalyticsSink | null = null;
/** Provides pending events behavior. */
let pendingEvents: Array<{
  /** Stores event name. */
  eventName: string; /** Stores params. */
  /** Stores params. */
  params: SanitizedAnalyticsParams;
}> = [];
/** External analytics is disabled until an explicit consent flow enables collection. */
let collectionEnabled = false;
/** Provides last screen behavior. */
let lastScreen = "";
/** Limits generic client-error signals to prevent recursive telemetry floods. */
const CLIENT_ERROR_REPORT_LIMIT = 5;

/** Fields that must never be forwarded to a target-owned analytics sink. */
const sensitiveAnalyticsFieldPattern =
  /(?:answer|authorization|cookie|email|guess|imageDataUrl|password|playerId|secret|token|uid|userId)/i;

/** Provides compact behavior. */
const compact = (value: string, fallback: string) => {
  /** Normalizes d. */
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return normalized || fallback;
};

/** Provides sanitize analytics params behavior. */
export const sanitizeAnalyticsParams = (params: AnalyticsParams = {}): SanitizedAnalyticsParams =>
  Object.entries(params).reduce<SanitizedAnalyticsParams>((result, [key, value]) => {
    if (sensitiveAnalyticsFieldPattern.test(key)) return result;
    /** Provides safe key behavior. */
    const safeKey = compact(key, "param");
    if (Array.isArray(value)) {
      result[safeKey] = value.slice(0, 10).map((item) => sanitizeAnalyticsParams(item) as AnalyticsItem);
      return result;
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return result;
    result[safeKey] = typeof value === "string" ? value.slice(0, 100) : value;
    return result;
  }, {});

/** Provides configure analytics behavior. */
export const configureAnalytics = (nextSink: AnalyticsSink | null) => {
  if (!nextSink) {
    sink = null;
    collectionEnabled = false;
    pendingEvents = [];
    return;
  }
  // Sink readiness is not consent. A late async SDK initialization must not
  // reconnect collection after the affirmative decision has been revoked.
  if (!collectionEnabled) {
    sink = null;
    pendingEvents = [];
    return;
  }
  sink = nextSink;
  for (const event of pendingEvents) deliver(sink, event.eventName, event.params);
  pendingEvents = [];
};

/** Enables or revokes external analytics collection before a remote sink is configured. */
export const setAnalyticsCollectionEnabled = (enabled: boolean) => {
  collectionEnabled = enabled;
  if (enabled) return;
  sink = null;
  pendingEvents = [];
};

/** Sends sanitized native events and, when enabled, the optional external copy.
 * Attributed provider funnels pass false because they own their native delivery.
 */
export const trackEvent = (eventName: string, params: AnalyticsParams = {}, includePlatform = true) => {
  /** Provides safe name behavior. */
  const safeName = compact(eventName, "game_event").slice(0, 40);
  /** Provides safe params behavior. */
  const safeParams = sanitizeAnalyticsParams(params);
  if (includePlatform && platformSink) deliver(platformSink, safeName, safeParams);
  if (!collectionEnabled) return;
  if (sink) deliver(sink, safeName, safeParams);
  else pendingEvents = [...pendingEvents.slice(-99), {eventName: safeName, params: safeParams}];
};

/** Tracks screen. */
export const trackScreen = (screenName: string, params: AnalyticsParams = {}) => {
  /** Provides safe screen behavior. */
  const safeScreen = compact(screenName, "unknown_screen");
  if (safeScreen === lastScreen) return;
  lastScreen = safeScreen;
  trackEvent("screen_view", {
    screen_name: safeScreen,
    screen_class: "RiddleQuestWeb",
    ...params,
  });
};

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
  /** Provides label behavior. */
  const label = button.getAttribute("aria-label");
  return label ? compact(label, "button") : "button";
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
      screen_name: screen ? compact(screen, "unknown_screen") : lastScreen || "unknown_screen",
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

/** Tracks purchase. */
export const trackPurchase = (input: {
  /** Stores product id. */
  productId: string;
  /** Stores purchase type. */
  purchaseType: "consumable" | "subscription";
  /** Stores price. */
  price?: number;
  /** Stores currency. */
  currency?: string;
}) => {
  trackEvent("purchase", {
    transaction_id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    value: input.price,
    currency: input.currency,
    items: [
      {
        item_id: input.productId,
        item_category: input.purchaseType,
        price: input.price ?? 0,
        quantity: 1,
      },
    ],
  });
};

/** Resets analytics for tests. */
export const resetAnalyticsForTests = () => {
  lastScreen = "";
  sink = null;
  pendingEvents = [];
  collectionEnabled = false;
  platformSink = null;
};
