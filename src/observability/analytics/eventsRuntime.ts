export type AnalyticsValue = string | number | boolean;
export type AnalyticsItem = Record<string, AnalyticsValue>;
export type AnalyticsParams = Record<string, AnalyticsValue | AnalyticsItem[] | undefined>;
export type SanitizedAnalyticsParams = Record<string, AnalyticsValue | AnalyticsItem[]>;
export type AnalyticsSink = (eventName: string, params: SanitizedAnalyticsParams) => void | Promise<void>;

let platformSink: AnalyticsSink | null = null;
let sink: AnalyticsSink | null = null;
let collectionEnabled = false;
let lastScreen = "";
let lastScreenParams: SanitizedAnalyticsParams = {};
let context: SanitizedAnalyticsParams = {};
let pendingEvents: Array<{eventName: string; params: SanitizedAnalyticsParams}> = [];

const sensitiveField = /(?:answer|authorization|cookie|email|guess|imageDataUrl|password|playerId|secret|token|uid|userId|username|displayName|avatar|url|referrer|message)/i;
const compact = (value: string, fallback: string) => value.normalize("NFKD")
  .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase().slice(0, 40) || fallback;
const validName = (value: string, fallback: string) => {
  const name = compact(value, fallback);
  return (/^[a-z]/.test(name) && !/^(?:firebase|google|ga)_/.test(name) ? name : `game_${name}`).slice(0, 40);
};

const deliver = (destination: AnalyticsSink, name: string, params: SanitizedAnalyticsParams) => {
  try {
    void Promise.resolve(destination(name, params)).catch(() => {});
  } catch {
    // Optional analytics delivery cannot change a game operation's result.
  }
};

const sanitizeItem = (item: AnalyticsItem): AnalyticsItem => Object.fromEntries(Object.entries(item)
  .filter(([key, value]) => !sensitiveField.test(key) &&
    (typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)))
  .slice(0, 25)
  .map(([key, value]) => [validName(key, "param"), typeof value === "string" ? value.slice(0, 100) : value]));

/** Bounds GA event fields and removes identity, free text and credentials for every destination. */
export const sanitizeAnalyticsParams = (params: AnalyticsParams = {}): SanitizedAnalyticsParams => {
  const result: SanitizedAnalyticsParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (sensitiveField.test(key) || Object.keys(result).length >= 25) continue;
    const safeKey = validName(key, "param");
    if (Array.isArray(value)) result[safeKey] = value.slice(0, 10).map(sanitizeItem);
    else if (typeof value === "string") result[safeKey] = value.slice(0, 100);
    else if (typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) result[safeKey] = value;
  }
  return result;
};

/** Sets target-owned dimensions without importing a browser or a provider SDK. */
export const configureAnalyticsContext = (params: AnalyticsParams) => {
  const owned = sanitizeAnalyticsParams({...params, schema_version: 1});
  context = owned;
  return () => { if (context === owned) context = {}; };
};

export const currentAnalyticsScreen = () => lastScreen;

/** Connects provider-owned telemetry independently of external analytics consent. */
export const configurePlatformAnalytics = (destination: AnalyticsSink) => {
  platformSink = destination;
  if (lastScreen) deliver(destination, "screen_view", {...context, ...lastScreenParams});
  return () => { if (platformSink === destination) platformSink = null; };
};

/** Connects an external destination only while consent is active. Cleanup cannot retire a successor. */
export const configureAnalytics = (nextSink: AnalyticsSink | null): (() => void) => {
  if (!nextSink) {
    setAnalyticsCollectionEnabled(false);
    return () => {};
  }
  if (!collectionEnabled) return () => {};
  sink = nextSink;
  const queued = pendingEvents;
  pendingEvents = [];
  for (const event of queued) deliver(nextSink, event.eventName, event.params);
  if (lastScreen && !queued.some(event => event.eventName === "screen_view")) {
    deliver(nextSink, "screen_view", {...context, ...lastScreenParams});
  }
  return () => {
    if (sink === nextSink) setAnalyticsCollectionEnabled(false);
  };
};

/** Revocation discards queued events. Events before consent are never retained for replay. */
export const setAnalyticsCollectionEnabled = (enabled: boolean) => {
  collectionEnabled = enabled;
  if (!enabled) {
    sink = null;
    pendingEvents = [];
  }
};

export const trackEvent = (eventName: string, params: AnalyticsParams = {}, includePlatform = true) => {
  const safeName = validName(eventName, "game_event");
  const safeParams = sanitizeAnalyticsParams({...context, ...params});
  if (includePlatform && platformSink) deliver(platformSink, safeName, safeParams);
  if (!collectionEnabled) return;
  if (sink) deliver(sink, safeName, safeParams);
  else pendingEvents = [...pendingEvents.slice(-99), {eventName: safeName, params: safeParams}];
};

export const trackScreen = (screenName: string, params: AnalyticsParams = {}) => {
  const safeScreen = compact(screenName, "unknown_screen");
  if (safeScreen === lastScreen) return;
  lastScreen = safeScreen;
  lastScreenParams = sanitizeAnalyticsParams({screen_name: safeScreen, screen_class: context.screen_class ?? "RiddleQuestWeb", ...params});
  trackEvent("screen_view", lastScreenParams);
};

/** Call only after a server-confirmed grant. Revenue requires a stable opaque transaction ID. */
export const trackPurchase = (input: {
  productId: string;
  purchaseType: "consumable" | "subscription" | "durable";
  transactionId?: string;
  price?: number;
  currency?: string;
}) => {
  if (!input.transactionId) {
    trackEvent("purchase_confirmed", {product_id: input.productId, purchase_type: input.purchaseType});
    return;
  }
  trackEvent("purchase", {
    transaction_id: input.transactionId,
    value: input.price,
    currency: input.currency,
    items: [{item_id: input.productId, item_category: input.purchaseType, price: input.price ?? 0, quantity: 1}],
  });
};

export const resetAnalyticsForTests = () => {
  lastScreen = "";
  lastScreenParams = {};
  context = {};
  sink = null;
  platformSink = null;
  pendingEvents = [];
  collectionEnabled = false;
};
