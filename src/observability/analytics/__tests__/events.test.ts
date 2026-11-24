import {
  configureAnalytics,
  configurePlatformAnalytics,
  installButtonAnalytics,
  installGlobalErrorAnalytics,
  resetAnalyticsForTests,
  sanitizeAnalyticsParams,
  setAnalyticsCollectionEnabled,
  trackEvent,
  trackPurchase,
  trackScreen,
} from "../events";

afterEach(resetAnalyticsForTests);

it("delivers native events independently of external collection and sanitizes purchases", () => {
  /** Observes native host delivery. */
  const native = jest.fn();
  /** Observes the disabled external destination. */
  const external = jest.fn();
  configureAnalytics(external);
  trackScreen("Startup");
  /** Retires the native owner. */
  const stop = configurePlatformAnalytics(native);
  trackEvent("Game Won", {playerId: "private", mode: "classic"});
  trackPurchase({transactionId: "receipt-coins", productId: "coins", purchaseType: "consumable", price: 1.99, currency: "USD"});
  expect(native).toHaveBeenCalledWith("screen_view", expect.objectContaining({screen_name: "startup"}));
  expect(native).toHaveBeenCalledWith("game_won", {mode: "classic"});
  expect(native).toHaveBeenCalledWith("purchase", expect.objectContaining({items: [{item_id: "coins", item_category: "consumable", price: 1.99, quantity: 1}]}));
  expect(external).not.toHaveBeenCalled();
  stop();
  trackEvent("retired");
  expect(native).toHaveBeenCalledTimes(3);
});

it("keeps replacement native sinks connected when an older owner cleans up", () => {
  /** Previous host connection. */
  const old = jest.fn();
  /** Successor host connection. */
  const current = jest.fn();
  /** Retires only the previous connection. */
  const stop = configurePlatformAnalytics(old);
  configurePlatformAnalytics(current);
  stop();
  trackEvent("current");
  trackEvent("direct_funnel", {}, false);
  expect(old).not.toHaveBeenCalled();
  expect(current).toHaveBeenCalledTimes(1);
});

it("isolates synchronous and asynchronous delivery failures", async () => {
  configurePlatformAnalytics(() => {throw new Error("provider unavailable");});
  expect(() => trackEvent("game_won")).not.toThrow();
  configurePlatformAnalytics(() => Promise.reject(new Error("provider unavailable")));
  trackEvent("game_won");
  setAnalyticsCollectionEnabled(true);
  trackEvent("queued");
  expect(() => configureAnalytics(() => {throw new Error("external unavailable");})).not.toThrow();
  await Promise.resolve();
});

it("queues early events and flushes them when analytics becomes ready", () => {
  /** Provides sink behavior. */
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  trackEvent("Session Started", {registered: true});

  configureAnalytics(sink);

  expect(sink).toHaveBeenCalledWith("session_started", {registered: true});
});

it("drops events while nonessential analytics collection is disabled", () => {
  /** Provides sink behavior. */
  const sink = jest.fn();
  trackEvent("Session Started", {registered: true});

  configureAnalytics(sink);
  trackEvent("Session Still Disabled", {registered: true});

  expect(sink).not.toHaveBeenCalled();
});

it("revokes collection, clears queued events, and disconnects the active sink", () => {
  /** Provides first sink behavior. */
  const firstSink = jest.fn();
  /** Provides next sink behavior. */
  const nextSink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  trackEvent("Queued Before Revocation");
  setAnalyticsCollectionEnabled(false);
  configureAnalytics(nextSink);

  expect(nextSink).not.toHaveBeenCalled();
  setAnalyticsCollectionEnabled(true);
  configureAnalytics(nextSink);
  trackEvent("Delivered After Explicit Re-enable");
  expect(nextSink).toHaveBeenCalledWith("delivered_after_explicit_re_enable", {});

  configureAnalytics(firstSink);
  configureAnalytics(null);
  trackEvent("Dropped After Revocation");
  expect(firstSink).not.toHaveBeenCalled();
});

it("deduplicates consecutive screen views", () => {
  /** Provides sink behavior. */
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  configureAnalytics(sink);

  trackScreen("Game Classic");
  trackScreen("Game Classic");
  trackScreen("Shop");

  expect(sink).toHaveBeenCalledTimes(2);
  expect(sink).toHaveBeenLastCalledWith("screen_view", expect.objectContaining({screen_name: "shop"}));
});

it("drops unsupported values and bounds strings", () => {
  expect(
    sanitizeAnalyticsParams({
      "Product ID": "x".repeat(120),
      count: 3,
      available: false,
      missing: undefined,
      items: [{item_id: "coins", quantity: 1}],
    }),
  ).toEqual({
    product_id: "x".repeat(100),
    count: 3,
    available: false,
    items: [{item_id: "coins", quantity: 1}],
  });
});

it("drops sensitive fields recursively before they reach an analytics sink", () => {
  expect(
    sanitizeAnalyticsParams({
      userId: "player-1",
      purchaseToken: "signed-token",
      answer: "secret",
      safe: "kept",
      items: [{item_id: "coins", email: "player@example.test"}],
    }),
  ).toEqual({safe: "kept", items: [{item_id: "coins"}]});
});

it("uses safe fallbacks and bounds queued event history", () => {
  setAnalyticsCollectionEnabled(true);
  for (let index = 0; index < 105; index += 1) {
    trackEvent(index === 104 ? "---" : `Event ${index}`, {"---": "value"});
  }
  /** Provides sink behavior. */
  const sink = jest.fn();

  configureAnalytics(sink);

  expect(sink).toHaveBeenCalledTimes(100);
  expect(sink).toHaveBeenLastCalledWith("game_event", {param: "value"});
  trackEvent("x".repeat(50));
  expect(sink).toHaveBeenLastCalledWith("x".repeat(40), {});
});

it("sanitizes nested item arrays and limits them to ten entries", () => {
  /** Provides items behavior. */
  const items = Array.from({length: 12}, (_, index) => ({"Item ID": `item-${index}`}));

  expect(sanitizeAnalyticsParams({items}).items).toEqual(
    items.slice(0, 10).map((item) => ({item_id: item["Item ID"]})),
  );
  expect(sanitizeAnalyticsParams()).toEqual({});
});

/** Describes click handler. */
type ClickHandler = (event: {
  /** Stores target. */
  /** Stores target. */
  target: unknown;
}) => void;

/** Provides test element behavior. */
class TestElement {
  /** Creates a test element instance. */
  public constructor(private readonly button: TestButton | null) {}

  /** Provides closest behavior. */
  public closest(): TestButton | null {
    return this.button;
  }
}

/** Provides test class list behavior. */
class TestClassList implements Iterable<string> {
  /** Stores values. */
  private readonly values: Set<string>;

  /** Creates a test class list instance. */
  public constructor(values: string[]) {
    this.values = new Set(values);
  }

  /** Provides contains behavior. */
  public contains(value: string): boolean {
    return this.values.has(value);
  }

  /** Provides [symbol.iterator] behavior. */
  public [Symbol.iterator](): Iterator<string> {
    return this.values[Symbol.iterator]();
  }
}

/** Provides test button behavior. */
class TestButton {
  /** Stores dataset. */
  public readonly dataset: Record<string, string | undefined>;
  /** Stores class list. */
  public readonly classList: TestClassList;

  /** Creates a test button instance. */
  public constructor({
    classes = [],
    dataset = {},
    disabled = false,
    label = null,
    screen = null,
  }: {
    /** Stores classes. */
    classes?: string[];
    /** Stores dataset. */
    dataset?: Record<string, string | undefined>;
    /** Stores disabled. */
    disabled?: boolean;
    /** Stores label. */
    label?: string | null;
    /** Stores screen. */
    screen?: string | null;
  }) {
    this.classList = new TestClassList(classes);
    this.dataset = dataset;
    this.disabled = disabled;
    this.label = label;
    this.screen = screen;
  }

  /** Stores disabled. */
  private readonly disabled: boolean;
  /** Stores label. */
  private readonly label: string | null;
  /** Stores screen. */
  private readonly screen: string | null;

  /** Provides matches behavior. */
  public matches(): boolean {
    return this.disabled;
  }

  /** Provides closest behavior. */
  public closest(selector: string):
    | TestButton
    | {
        /** Stores dataset. */
        /** Stores dataset. */
        dataset: {
          /** Stores analytics screen. */
          /** Stores analytics screen. */
          analyticsScreen: string;
        };
      }
    | null {
    if (selector === "[data-analytics-screen]") {
      return this.screen === null ? null : {dataset: {analyticsScreen: this.screen}};
    }
    return this;
  }

  /** Gets attribute. */
  public getAttribute(name: string): string | null {
    return name === "aria-label" ? this.label : null;
  }
}

it.each([
  [new TestButton({dataset: {analyticsId: "Shop Coins"}, screen: "Store"}), "shop_coins", "store"],
  [new TestButton({dataset: {tooltip: "Game Hint"}}), "game_hint", "unknown_screen"],
  [new TestButton({classes: ["key", "utility"]}), "keyboard_delete", "unknown_screen"],
  [new TestButton({classes: ["key"]}), "keyboard_letter", "unknown_screen"],
  [new TestButton({classes: ["guess-cell"]}), "guess_slot", "unknown_screen"],
  [new TestButton({classes: ["active-state", "primary-action"]}), "primary_action", "unknown_screen"],
  [new TestButton({label: "Open Profile"}), "button", "unknown_screen"],
  [new TestButton({}), "button", "unknown_screen"],
])("tracks delegated button identifiers", (button, buttonId, screenName) => {
  /** Provides original element behavior. */
  const originalElement = globalThis.Element;
  Object.defineProperty(globalThis, "Element", {configurable: true, value: TestElement});
  /** Provides click handler behavior. */
  let clickHandler: ClickHandler | undefined;
  /** Provides root behavior. */
  const root = {
    addEventListener: jest.fn((_name: string, handler: ClickHandler) => {
      clickHandler = handler;
    }),
    removeEventListener: jest.fn(),
  };
  /** Provides sink behavior. */
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  configureAnalytics(sink);

  /** Provides uninstall behavior. */
  const uninstall = installButtonAnalytics(root as unknown as Document);
  clickHandler?.({target: new TestElement(button)});
  uninstall();

  expect(sink).toHaveBeenCalledWith("button_press", {button_id: buttonId, screen_name: screenName});
  expect(root.removeEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
  Object.defineProperty(globalThis, "Element", {configurable: true, value: originalElement});
});

it("ignores non-elements, missing buttons, and disabled controls", () => {
  /** Provides original element behavior. */
  const originalElement = globalThis.Element;
  Object.defineProperty(globalThis, "Element", {configurable: true, value: TestElement});
  /** Provides click handler behavior. */
  let clickHandler: ClickHandler | undefined;
  /** Provides root behavior. */
  const root = {
    addEventListener: (_name: string, handler: ClickHandler) => {
      clickHandler = handler;
    },
    removeEventListener: jest.fn(),
  };
  /** Provides sink behavior. */
  const sink = jest.fn();
  configureAnalytics(sink);
  installButtonAnalytics(root as unknown as Document);

  clickHandler?.({target: {}});
  clickHandler?.({target: new TestElement(null)});
  clickHandler?.({target: new TestElement(new TestButton({disabled: true}))});

  expect(sink).not.toHaveBeenCalled();
  Object.defineProperty(globalThis, "Element", {configurable: true, value: originalElement});
});

it("installs on the default document when no root is supplied", () => {
  /** Provides original document behavior. */
  const originalDocument = globalThis.document;
  /** Provides document root behavior. */
  const documentRoot = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(globalThis, "document", {configurable: true, value: documentRoot});

  /** Provides uninstall behavior. */
  const uninstall = installButtonAnalytics();
  uninstall();

  expect(documentRoot.addEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
  expect(documentRoot.removeEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
  Object.defineProperty(globalThis, "document", {configurable: true, value: originalDocument});
});

it("reports bounded client failures without including sensitive error details", () => {
  /** Handles rs. */
  const handlers = new Map<string, () => void>();
  /** Provides target behavior. */
  const target = {
    addEventListener: jest.fn((name: string, handler: () => void) => handlers.set(name, handler)),
    removeEventListener: jest.fn(),
  };
  /** Provides sink behavior. */
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  configureAnalytics(sink);

  /** Provides uninstall behavior. */
  const uninstall = installGlobalErrorAnalytics(target as unknown as Window);
  handlers.get("error")?.();
  for (let index = 0; index < 6; index += 1) handlers.get("unhandledrejection")?.();
  uninstall();

  expect(sink).toHaveBeenCalledTimes(5);
  expect(sink).toHaveBeenNthCalledWith(1, "client_error", {error_kind: "uncaught_error"});
  expect(sink).toHaveBeenNthCalledWith(2, "client_error", {error_kind: "unhandled_rejection"});
  expect(target.removeEventListener).toHaveBeenCalledWith("error", handlers.get("error"));
  expect(target.removeEventListener).toHaveBeenCalledWith("unhandledrejection", handlers.get("unhandledrejection"));
});

it("installs global error analytics on the default window", () => {
  /** Provides original window behavior. */
  const originalWindow = globalThis.window;
  /** Provides browser window behavior. */
  const browserWindow = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(globalThis, "window", {configurable: true, value: browserWindow});

  /** Provides uninstall behavior. */
  const uninstall = installGlobalErrorAnalytics();
  uninstall();

  expect(browserWindow.addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
  expect(browserWindow.addEventListener).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  expect(browserWindow.removeEventListener).toHaveBeenCalledTimes(2);
  Object.defineProperty(globalThis, "window", {configurable: true, value: originalWindow});
});

it("tracks purchases with stable transaction identifiers and default prices", () => {
  /** Provides sink behavior. */
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  configureAnalytics(sink);

  trackPurchase({transactionId: "receipt-coins-100", productId: "coins-100", purchaseType: "consumable", currency: "GBP"});

  expect(sink).toHaveBeenCalledWith(
    "purchase",
    expect.objectContaining({
      transaction_id: "receipt-coins-100",
      items: [{item_id: "coins-100", item_category: "consumable", price: 0, quantity: 1}],
    }),
  );
});

it("records confirmation without revenue when a stable receipt identity is unavailable", () => {
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  configureAnalytics(sink);
  trackPurchase({productId: "membership", purchaseType: "subscription", price: 3.99});
  expect(sink).toHaveBeenCalledWith("purchase_confirmed", {product_id: "membership", purchase_type: "subscription"});
});
