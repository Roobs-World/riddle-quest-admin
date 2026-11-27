import {resetAnalyticsForTests, trackEvent, trackPurchase} from "../../../../../src/observability/analytics/events";
import {installFacebookAnalytics} from "../analytics";
import type {FacebookInstantSdk} from "../fbinstant";

afterEach(resetAnalyticsForTests);

it("sends supported native events with bounded primitive properties and purchase value", () => {
  /** Observes provider-bound calls. */
  const logEvent = jest.fn(() => null);
  /** Initialized host fixture advertising native analytics. */
  const sdk = {logEvent, getSupportedAPIs: () => ["logEvent"]} as unknown as FacebookInstantSdk;
  /** Simulates retirement and account deletion. */
  let active = true;
  /** Owns this session's native connection. */
  const stop = installFacebookAnalytics(sdk, () => active);
  trackEvent("game_won", {registered: true, guess: "SECRET"});
  trackPurchase({transactionId: "receipt-coins", productId: "coins", purchaseType: "consumable", price: 1.99, currency: "USD"});
  expect(logEvent).toHaveBeenCalledWith("session_started", null, {platform: "facebook"});
  expect(logEvent).toHaveBeenCalledWith("game_won", null, {registered: "true"});
  expect(logEvent).toHaveBeenCalledWith("purchase", 1.99, expect.objectContaining({currency: "USD", item_id: "coins", price: "1.99"}));
  active = false;
  trackEvent("retired");
  stop();
  trackEvent("disconnected");
  expect(logEvent).toHaveBeenCalledTimes(3);
});

it("skips unsupported SDKs and survives rejected events", () => {
  /** Simulates a native error returned instead of thrown. */
  const logEvent = jest.fn(() => ({code: "ANALYTICS_POST_EXCEPTION", message: "failed"}));
  installFacebookAnalytics({getSupportedAPIs: () => []} as unknown as FacebookInstantSdk, () => true)();
  installFacebookAnalytics({logEvent, getSupportedAPIs: () => []} as unknown as FacebookInstantSdk, () => true)();
  expect(logEvent).not.toHaveBeenCalled();
  installFacebookAnalytics({logEvent, getSupportedAPIs: () => ["logEvent"]} as unknown as FacebookInstantSdk, () => true);
  expect(() => trackEvent("game_won")).not.toThrow();
});
