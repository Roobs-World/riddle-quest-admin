import {createDecorativeAnimation} from "../game/decorativeAnimation";

/** Models retained cancelled callbacks and a monotonic browser clock. */
function installBrowser() {
  /** Controllable monotonic time for active-time assertions. */
  let now = 0;
  /** Next request ID, beginning at zero to test valid falsy handles. */
  let nextFrame = 0;
  /** Callbacks still scheduled by the fake browser. */
  const pending = new Map<number, FrameRequestCallback>();
  /** Callbacks retained even after cancellation to exercise ownership guards. */
  const retained = new Map<number, FrameRequestCallback>();
  /** Owned visibility callbacks, inspected for lifecycle leaks. */
  const visibilityListeners = new Set<() => void>();
  /** Controllable visibility and subscription state. */
  const documentMock = {
    hidden: false,
    addEventListener: (_type: string, callback: () => void) => visibilityListeners.add(callback),
    removeEventListener: (_type: string, callback: () => void) => visibilityListeners.delete(callback),
  };
  /** Cancels a scheduled request without erasing the retained callback. */
  const cancel = jest.fn((id: number) => pending.delete(id));
  /** Allocates one browser frame and retains it for stale-callback tests. */
  const request = jest.fn((callback: FrameRequestCallback) => {
    /** Allocated request handle, including zero. */
    const id = nextFrame++;
    pending.set(id, callback);
    retained.set(id, callback);
    return id;
  });
  Object.defineProperty(globalThis, "document", {configurable: true, value: documentMock});
  Object.defineProperty(globalThis, "window", {configurable: true, value: {requestAnimationFrame: request, cancelAnimationFrame: cancel}});
  jest.spyOn(performance, "now").mockImplementation(() => now);
  return {
    pending, retained, cancel, request, visibilityListeners,
    elapse: (milliseconds: number) => { now += milliseconds; },
    frame: (milliseconds = 16) => {
      now += milliseconds;
      /** Current scheduled batch; newly scheduled frames belong to the next batch. */
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback(now));
    },
    visibility: (hidden: boolean) => {
      documentMock.hidden = hidden;
      [...visibilityListeners].forEach((callback) => callback());
    },
  };
}

describe("decorative animation ownership", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "window");
  });

  it("consumes no frames before layout and keeps one chain across repeated readiness updates", () => {
    /** Browser scheduler and clock controlled by this test. */
    const browser = installBrowser();
    /** Current layout or host eligibility, changed between callbacks. */
    let ready = false;
    /** Records active drawing deltas or injects a drawing failure. */
    const render = jest.fn();
    /** Animation controller whose lifetime the test exercises. */
    const loop = createDecorativeAnimation({canRender: () => ready, render, onError: jest.fn()});
    expect(browser.pending.size).toBe(0);
    ready = true;
    for (let i = 0; i < 20; i++) loop.refresh();
    expect(browser.pending.size).toBe(1);
    browser.frame();
    expect(render).toHaveBeenCalledWith(0.016);
    expect(browser.pending.size).toBe(1);
    loop.dispose();
  });

  it("cancels frame zero and rejects a retained callback after pause and resume", () => {
    /** Browser scheduler and clock controlled by this test. */
    const browser = installBrowser();
    /** Current layout or host eligibility, changed between callbacks. */
    let ready = true;
    /** Records active drawing deltas or injects a drawing failure. */
    const render = jest.fn();
    /** Animation controller whose lifetime the test exercises. */
    const loop = createDecorativeAnimation({canRender: () => ready, render, onError: jest.fn()});
    ready = false;
    loop.refresh();
    expect(browser.cancel).toHaveBeenCalledWith(0);
    expect(browser.pending.size).toBe(0);
    ready = true;
    loop.refresh();
    browser.retained.get(0)?.(16);
    expect(render).not.toHaveBeenCalled();
    expect(browser.pending.size).toBe(1);
    browser.frame();
    expect(render).toHaveBeenCalledTimes(1);
    expect(browser.pending.size).toBe(1);
    loop.dispose();
  });

  it("resets active time across visibility suspension and clamps a long active frame", () => {
    /** Browser scheduler and clock controlled by this test. */
    const browser = installBrowser();
    /** Records active drawing deltas or injects a drawing failure. */
    const render = jest.fn();
    /** Animation controller whose lifetime the test exercises. */
    const loop = createDecorativeAnimation({canRender: () => true, render, onError: jest.fn()});
    browser.frame();
    browser.visibility(true);
    expect(browser.pending.size).toBe(0);
    browser.elapse(60_000);
    browser.visibility(false);
    browser.frame();
    expect(render.mock.calls.map(([delta]) => delta)).toEqual([0.016, 0.016]);
    browser.frame(1000);
    expect(render).toHaveBeenLastCalledWith(0.1);
    loop.dispose();
  });

  it("rechecks readiness at callback entry even before the pause effect runs", () => {
    /** Browser scheduler and clock controlled by this test. */
    const browser = installBrowser();
    /** Current layout or host eligibility, changed between callbacks. */
    let ready = true;
    /** Records active drawing deltas or injects a drawing failure. */
    const render = jest.fn();
    /** Animation controller whose lifetime the test exercises. */
    const loop = createDecorativeAnimation({canRender: () => ready, render, onError: jest.fn()});
    ready = false;
    browser.frame();
    expect(render).not.toHaveBeenCalled();
    expect(browser.pending.size).toBe(0);
    loop.dispose();
  });

  it("retirement removes listeners and makes old callbacks and refreshes inert", () => {
    /** Browser scheduler and clock controlled by this test. */
    const browser = installBrowser();
    /** Records active drawing deltas or injects a drawing failure. */
    const render = jest.fn();
    /** Animation controller whose lifetime the test exercises. */
    const loop = createDecorativeAnimation({canRender: () => true, render, onError: jest.fn()});
    loop.dispose();
    loop.dispose();
    browser.retained.get(0)?.(16);
    loop.refresh();
    browser.visibility(false);
    expect(render).not.toHaveBeenCalled();
    expect(browser.pending.size).toBe(0);
    expect(browser.visibilityListeners.size).toBe(0);
    expect(browser.cancel).toHaveBeenCalledTimes(1);
  });

  it("contains a rendering failure and a throwing recovery callback exactly once", () => {
    /** Browser scheduler and clock controlled by this test. */
    const browser = installBrowser();
    /** Original driver exception that recovery must receive. */
    const failure = Error("driver draw failed");
    /** Records active drawing deltas or injects a drawing failure. */
    const render = jest.fn(() => { throw failure; });
    /** Recovery callback intentionally throwing to test containment. */
    const onError = jest.fn(() => { throw Error("optional reporting failed"); });
    /** Animation controller whose lifetime the test exercises. */
    const loop = createDecorativeAnimation({canRender: () => true, render, onError});
    expect(() => browser.frame()).not.toThrow();
    browser.retained.get(0)?.(16);
    loop.refresh();
    browser.visibility(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(render).toHaveBeenCalledTimes(1);
    expect(browser.pending.size).toBe(0);
    expect(browser.visibilityListeners.size).toBe(0);
  });

  it("does not reschedule when rendering itself disposes the loop", () => {
    /** Browser scheduler and clock controlled by this test. */
    const browser = installBrowser();
    /** Records active drawing deltas or injects a drawing failure. */
    const render = jest.fn(() => loop.dispose());
    /** Animation controller whose lifetime the test exercises. */
    const loop = createDecorativeAnimation({canRender: () => true, render, onError: jest.fn()});
    browser.frame();
    expect(render).toHaveBeenCalledTimes(1);
    expect(browser.pending.size).toBe(0);
    expect(browser.visibilityListeners.size).toBe(0);
  });

  it("caps drawing to the configured interval on fast displays while keeping active time", () => {
    /** Browser scheduler and clock controlled by this test. */
    const browser = installBrowser();
    /** Records drawn deltas. */
    const render = jest.fn();
    /** 30 fps decorative loop. */
    const loop = createDecorativeAnimation({canRender: () => true, render, onError: jest.fn(), frameIntervalMs: 1000 / 30});
    for (let i = 0; i < 12; i++) browser.frame(1000 / 120);
    // The first refresh draws immediately; afterwards every fourth 120 Hz refresh is drawn.
    expect(render).toHaveBeenCalledTimes(3);
    expect(render.mock.calls[1][0]).toBeCloseTo(4 / 120, 5);
    expect(browser.pending.size).toBe(1);
    loop.dispose();
  });

  it("draws every other refresh at 60 Hz despite timer jitter", () => {
    /** Browser scheduler and clock controlled by this test. */
    const browser = installBrowser();
    /** Records drawn deltas. */
    const render = jest.fn();
    /** 30 fps decorative loop. */
    const loop = createDecorativeAnimation({canRender: () => true, render, onError: jest.fn(), frameIntervalMs: 1000 / 30});
    for (const delay of [16.7, 16.4, 16.5, 16.9, 16.3, 16.6]) browser.frame(delay);
    expect(render).toHaveBeenCalledTimes(3);
    loop.dispose();
  });
});
