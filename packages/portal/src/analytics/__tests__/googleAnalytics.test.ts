import {
  configureAnalytics,
  installButtonAnalytics,
  installGlobalErrorAnalytics,
  resetAnalyticsForTests,
  sanitizeAnalyticsParams,
  setAnalyticsCollectionEnabled,
  trackEvent,
  trackPurchase,
  trackScreen,
} from "../googleAnalytics";

afterEach(resetAnalyticsForTests);

it("queues early events and flushes them when analytics becomes ready", () => {
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  trackEvent("Session Started", {registered: true});

  configureAnalytics(sink);

  expect(sink).toHaveBeenCalledWith("session_started", {registered: true});
});

it("drops events while nonessential analytics collection is disabled", () => {
  const sink = jest.fn();
  trackEvent("Session Started", {registered: true});

  configureAnalytics(sink);
  trackEvent("Session Still Disabled", {registered: true});

  expect(sink).not.toHaveBeenCalled();
});

it("revokes collection, clears queued events, and disconnects the active sink", () => {
  const firstSink = jest.fn();
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
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
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

it("drops sensitive fields recursively before they reach an analytics sink", () => {
  expect(sanitizeAnalyticsParams({
    userId: "player-1",
    purchaseToken: "signed-token",
    answer: "secret",
    safe: "kept",
    items: [{item_id: "coins", email: "player@example.test"}],
  })).toEqual({safe: "kept", items: [{item_id: "coins"}]});
});

it("uses safe fallbacks and bounds queued event history", () => {
  setAnalyticsCollectionEnabled(true);
  for (let index = 0; index < 105; index += 1) {
    trackEvent(index === 104 ? "---" : `Event ${index}`, {"---": "value"});
  }
  const sink = jest.fn();

  configureAnalytics(sink);

  expect(sink).toHaveBeenCalledTimes(100);
  expect(sink).toHaveBeenLastCalledWith("game_event", {param: "value"});
  trackEvent("x".repeat(50));
  expect(sink).toHaveBeenLastCalledWith("x".repeat(40), {});
});

it("sanitizes nested item arrays and limits them to ten entries", () => {
  const items = Array.from({length: 12}, (_, index) => ({"Item ID": `item-${index}`}));

  expect(sanitizeAnalyticsParams({items}).items).toEqual(
    items.slice(0, 10).map((item) => ({item_id: item["Item ID"]})),
  );
  expect(sanitizeAnalyticsParams()).toEqual({});
});

type ClickHandler = (event: {target: unknown}) => void;

class TestElement {
  public constructor(private readonly button: TestButton | null) {}

  public closest(): TestButton | null {
    return this.button;
  }
}

class TestClassList implements Iterable<string> {
  private readonly values: Set<string>;

  public constructor(values: string[]) {
    this.values = new Set(values);
  }

  public contains(value: string): boolean {
    return this.values.has(value);
  }

  public [Symbol.iterator](): Iterator<string> {
    return this.values[Symbol.iterator]();
  }
}

class TestButton {
  public readonly dataset: Record<string, string | undefined>;
  public readonly classList: TestClassList;

  public constructor({
    classes = [],
    dataset = {},
    disabled = false,
    label = null,
    screen = null,
  }: {
    classes?: string[];
    dataset?: Record<string, string | undefined>;
    disabled?: boolean;
    label?: string | null;
    screen?: string | null;
  }) {
    this.classList = new TestClassList(classes);
    this.dataset = dataset;
    this.disabled = disabled;
    this.label = label;
    this.screen = screen;
  }

  private readonly disabled: boolean;
  private readonly label: string | null;
  private readonly screen: string | null;

  public matches(): boolean {
    return this.disabled;
  }

  public closest(selector: string): TestButton | {dataset: {analyticsScreen: string}} | null {
    if (selector === "[data-analytics-screen]") {
      return this.screen === null ? null : {dataset: {analyticsScreen: this.screen}};
    }
    return this;
  }

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
  [new TestButton({label: "Open Profile"}), "open_profile", "unknown_screen"],
  [new TestButton({}), "button", "unknown_screen"],
])("tracks delegated button identifiers", (button, buttonId, screenName) => {
  const originalElement = globalThis.Element;
  Object.defineProperty(globalThis, "Element", {configurable: true, value: TestElement});
  let clickHandler: ClickHandler | undefined;
  const root = {
    addEventListener: jest.fn((_name: string, handler: ClickHandler) => {
      clickHandler = handler;
    }),
    removeEventListener: jest.fn(),
  };
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  configureAnalytics(sink);

  const uninstall = installButtonAnalytics(root as unknown as Document);
  clickHandler?.({target: new TestElement(button)});
  uninstall();

  expect(sink).toHaveBeenCalledWith("button_press", {button_id: buttonId, screen_name: screenName});
  expect(root.removeEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
  Object.defineProperty(globalThis, "Element", {configurable: true, value: originalElement});
});

it("ignores non-elements, missing buttons, and disabled controls", () => {
  const originalElement = globalThis.Element;
  Object.defineProperty(globalThis, "Element", {configurable: true, value: TestElement});
  let clickHandler: ClickHandler | undefined;
  const root = {
    addEventListener: (_name: string, handler: ClickHandler) => {
      clickHandler = handler;
    },
    removeEventListener: jest.fn(),
  };
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
  const originalDocument = globalThis.document;
  const documentRoot = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(globalThis, "document", {configurable: true, value: documentRoot});

  const uninstall = installButtonAnalytics();
  uninstall();

  expect(documentRoot.addEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
  expect(documentRoot.removeEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
  Object.defineProperty(globalThis, "document", {configurable: true, value: originalDocument});
});

it("reports bounded client failures without including sensitive error details", () => {
  const handlers = new Map<string, () => void>();
  const target = {
    addEventListener: jest.fn((name: string, handler: () => void) => handlers.set(name, handler)),
    removeEventListener: jest.fn(),
  };
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  configureAnalytics(sink);

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
  const originalWindow = globalThis.window;
  const browserWindow = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(globalThis, "window", {configurable: true, value: browserWindow});

  const uninstall = installGlobalErrorAnalytics();
  uninstall();

  expect(browserWindow.addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
  expect(browserWindow.addEventListener).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  expect(browserWindow.removeEventListener).toHaveBeenCalledTimes(2);
  Object.defineProperty(globalThis, "window", {configurable: true, value: originalWindow});
});

it("tracks purchases with generated transaction identifiers and default prices", () => {
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  configureAnalytics(sink);

  trackPurchase({productId: "coins-100", purchaseType: "consumable", currency: "GBP"});

  expect(sink).toHaveBeenCalledWith("purchase", expect.objectContaining({
    transaction_id: expect.any(String),
    items: [{item_id: "coins-100", item_category: "consumable", price: 0, quantity: 1}],
  }));
});

it("falls back to a web transaction identifier where randomUUID is unavailable", () => {
  const originalCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", {configurable: true, value: {}});
  jest.spyOn(Date, "now").mockReturnValue(1234);
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  const sink = jest.fn();
  setAnalyticsCollectionEnabled(true);
  configureAnalytics(sink);

  trackPurchase({productId: "membership", purchaseType: "subscription", price: 3.99});

  expect(sink).toHaveBeenCalledWith("purchase", expect.objectContaining({
    transaction_id: expect.stringMatching(/^web-1234-/),
    value: 3.99,
  }));
  Object.defineProperty(globalThis, "crypto", {configurable: true, value: originalCrypto});
  jest.restoreAllMocks();
});
