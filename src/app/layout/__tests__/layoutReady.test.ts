import {runWhenLayoutReady} from "../layoutReady";

/** Provides install browser behavior. */
const installBrowser = (readyState: DocumentReadyState) => {
  /** Provides frame callback behavior. */
  let frameCallback: FrameRequestCallback | undefined;
  /** Lists eners. */
  const listeners = new Map<string, EventListenerOrEventListenerObject>();
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {readyState},
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      requestAnimationFrame: jest.fn((callback: FrameRequestCallback) => {
        frameCallback = callback;
        return 42;
      }),
      cancelAnimationFrame: jest.fn(),
      addEventListener: jest.fn((type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.set(type, listener);
      }),
      removeEventListener: jest.fn((type: string) => listeners.delete(type)),
    },
  });
  return {
    fireLoad: () => {
      /** Lists ener. */
      const listener = listeners.get("load");
      if (typeof listener === "function") listener(new Event("load"));
      else listener?.handleEvent(new Event("load"));
    },
    fireFrame: () => frameCallback?.(0),
  };
};

describe("layout readiness", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "window");
  });

  it("runs on the next animation frame when the document is complete", () => {
    /** Provides browser behavior. */
    const browser = installBrowser("complete");
    /** Provides callback behavior. */
    const callback = jest.fn();
    /** Provides cancel behavior. */
    const cancel = runWhenLayoutReady(callback);
    browser.fireFrame();
    expect(callback).toHaveBeenCalledTimes(1);
    cancel();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(window.removeEventListener).toHaveBeenCalledWith("load", expect.any(Function));
  });

  it("waits for load and suppresses a frame callback after cancellation", () => {
    /** Provides browser behavior. */
    const browser = installBrowser("loading");
    /** Provides callback behavior. */
    const callback = jest.fn();
    /** Provides cancel behavior. */
    const cancel = runWhenLayoutReady(callback);
    expect(window.addEventListener).toHaveBeenCalledWith("load", expect.any(Function), {once: true});
    browser.fireLoad();
    cancel();
    browser.fireFrame();
    expect(callback).not.toHaveBeenCalled();
  });
});
