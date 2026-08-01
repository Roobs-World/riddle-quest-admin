import {
  configureAnalytics,
  resetAnalyticsForTests,
  sanitizeAnalyticsParams,
  trackEvent,
  trackScreen,
} from "../googleAnalytics";

afterEach(resetAnalyticsForTests);

it("queues early events and flushes them when analytics becomes ready", () => {
  const sink = jest.fn();
  trackEvent("Session Started", {registered: true});

  configureAnalytics(sink);

  expect(sink).toHaveBeenCalledWith("session_started", {registered: true});
});

it("deduplicates consecutive screen views", () => {
  const sink = jest.fn();
  configureAnalytics(sink);

  trackScreen("Game Classic");
  trackScreen("Game Classic");
  trackScreen("Shop");

  expect(sink).toHaveBeenCalledTimes(2);
  expect(sink).toHaveBeenLastCalledWith("screen_view", expect.objectContaining({firebase_screen: "shop"}));
});

it("drops unsupported values and bounds strings", () => {
  expect(sanitizeAnalyticsParams({
    "Product ID": "x".repeat(120),
    count: 3,
    available: false,
    missing: undefined,
    items: [{item_id: "coins", quantity: 1}],
  })).toEqual({
    product_id: "x".repeat(100),
    count: 3,
    available: false,
    items: [{item_id: "coins", quantity: 1}],
  });
});
