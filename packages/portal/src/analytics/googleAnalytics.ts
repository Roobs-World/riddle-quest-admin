export type AnalyticsValue = string | number | boolean;
export type AnalyticsItem = Record<string, AnalyticsValue>;
export type AnalyticsParams = Record<string, AnalyticsValue | AnalyticsItem[] | undefined>;
export type SanitizedAnalyticsParams = Record<string, AnalyticsValue | AnalyticsItem[]>;
export type AnalyticsSink = (eventName: string, params: SanitizedAnalyticsParams) => void;

let sink: AnalyticsSink | null = null;
let pendingEvents: Array<{eventName: string; params: SanitizedAnalyticsParams}> = [];
let lastScreen = "";

const compact = (value: string, fallback: string) => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return normalized || fallback;
};

export const sanitizeAnalyticsParams = (params: AnalyticsParams = {}): SanitizedAnalyticsParams =>
  Object.entries(params).reduce<SanitizedAnalyticsParams>((result, [key, value]) => {
    const safeKey = compact(key, "param");
    if (Array.isArray(value)) {
      result[safeKey] = value.slice(0, 10).map((item) => sanitizeAnalyticsParams(item) as AnalyticsItem);
      return result;
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return result;
    result[safeKey] = typeof value === "string" ? value.slice(0, 100) : value;
    return result;
  }, {});

export const configureAnalytics = (nextSink: AnalyticsSink | null) => {
  sink = nextSink;
  if (!sink) return;
  for (const event of pendingEvents) sink(event.eventName, event.params);
  pendingEvents = [];
};

export const trackEvent = (eventName: string, params: AnalyticsParams = {}) => {
  const safeName = compact(eventName, "game_event").slice(0, 40);
  const safeParams = sanitizeAnalyticsParams(params);
  if (sink) sink(safeName, safeParams);
  else pendingEvents = [...pendingEvents.slice(-99), {eventName: safeName, params: safeParams}];
};

export const trackScreen = (screenName: string, params: AnalyticsParams = {}) => {
  const safeScreen = compact(screenName, "unknown_screen");
  if (safeScreen === lastScreen) return;
  lastScreen = safeScreen;
  trackEvent("screen_view", {
    firebase_screen: safeScreen,
    firebase_screen_class: "RiddleQuestWeb",
    ...params,
  });
};

const getButtonId = (button: HTMLElement) => {
  const explicit = button.dataset.analyticsId || button.dataset.tooltip;
  if (explicit) return compact(explicit, "button");
  if (button.classList.contains("key")) return button.classList.contains("utility") ? "keyboard_delete" : "keyboard_letter";
  if (button.classList.contains("guess-cell")) return "guess_slot";
  const className = Array.from(button.classList).find((name) => !name.startsWith("active") && !name.startsWith("disabled"));
  if (className) return compact(className, "button");
  const label = button.getAttribute("aria-label");
  return label ? compact(label, "button") : "button";
};

export const installButtonAnalytics = (root: Document = document) => {
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>("button, [role='button']");
    if (!button || button.matches(":disabled, [aria-disabled='true']")) return;
    const screen = button.closest<HTMLElement>("[data-analytics-screen]")?.dataset.analyticsScreen;
    trackEvent("button_press", {
      button_id: getButtonId(button),
      screen_name: screen ? compact(screen, "unknown_screen") : lastScreen || "unknown_screen",
    });
  };
  root.addEventListener("click", onClick, true);
  return () => root.removeEventListener("click", onClick, true);
};

export const trackPurchase = (input: {
  productId: string;
  purchaseType: "consumable" | "subscription";
  price?: number;
  currency?: string;
}) => {
  trackEvent("purchase", {
    transaction_id: typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    value: input.price,
    currency: input.currency,
    items: [{
      item_id: input.productId,
      item_category: input.purchaseType,
      price: input.price ?? 0,
      quantity: 1,
    }],
  });
};

export const resetAnalyticsForTests = () => {
  lastScreen = "";
  sink = null;
  pendingEvents = [];
};
