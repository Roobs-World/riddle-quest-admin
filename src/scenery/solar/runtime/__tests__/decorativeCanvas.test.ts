import {createDecorativeCanvas} from "../decorativeCanvas";

/** Supplies a native EventTarget with a canvas's style surface and retains installed wrappers. */
function installCanvas() {
  /** Actual event dispatch, once and abort handling supplied by the runtime. */
  const target = new EventTarget();
  /** Removed browser callbacks can still be exercised by the test. */
  const retained: EventListenerOrEventListenerObject[] = [];
  /** Native methods recorded before the owner installs its instance-level guard. */
  const add = target.addEventListener.bind(target);
  /** Registration-removal identity is independently observable. */
  const remove = target.removeEventListener.bind(target);
  target.addEventListener = jest.fn((type, callback, options) => {
    if (callback) retained.push(callback);
    add(type, callback, options);
  });
  target.removeEventListener = jest.fn(remove);
  Object.assign(target, {style: {display: ""}});
  Object.defineProperty(globalThis, "document", {configurable: true, value: {createElement: () => target}});
  return {target, retained};
}

afterEach(() => { Reflect.deleteProperty(globalThis, "document"); });

it("preserves function receiver, event cancellation and original-listener removal", () => {
  installCanvas();
  /** Driver errors belong to the scene rather than global browser dispatch. */
  const report = jest.fn();
  /** Owned canvas guarding context callbacks. */
  const owner = createDecorativeCanvas(report);
  /** Context loss must keep the driver's preventDefault behavior. */
  const listener = jest.fn(function(this: HTMLCanvasElement, event: Event) { event.preventDefault(); });
  owner.canvas.addEventListener("webglcontextlost", listener, false);
  owner.canvas.addEventListener("webglcontextlost", listener, {capture: false, once: true});
  /** Native cancelable browser loss event. */
  const event = new Event("webglcontextlost", {cancelable: true});
  expect(owner.canvas.dispatchEvent(event)).toBe(false);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.contexts[0]).toBe(owner.canvas);
  owner.canvas.removeEventListener("webglcontextlost", listener, false);
  owner.canvas.dispatchEvent(new Event("webglcontextlost"));
  expect(listener).toHaveBeenCalledTimes(1);
  expect(report).not.toHaveBeenCalled();
  owner.dispose();
});

it("retires all context callbacks on a driver failure and contains a failed diagnostic", () => {
  /** Browser-retained wrappers must remain harmless after the first failure. */
  const browser = installCanvas();
  /** Broken optional diagnostics must not escape the browser callback. */
  const report = jest.fn(() => { throw new Error("reporter failed"); });
  /** Scene-owned canvas. */
  const owner = createDecorativeCanvas(report);
  /** Context restoration fails during driver setup. */
  const driver = jest.fn(() => { throw new Error("driver restoration failed"); });
  /** Later scene callback must not treat the failed restoration as successful. */
  const afterRestore = jest.fn();
  owner.canvas.addEventListener("webglcontextrestored", driver);
  owner.canvas.addEventListener("webglcontextrestored", afterRestore);
  expect(() => owner.canvas.dispatchEvent(new Event("webglcontextrestored"))).not.toThrow();
  owner.canvas.dispatchEvent(new Event("webglcontextrestored"));
  for (const callback of browser.retained) {
    if (typeof callback === "function") callback(new Event("webglcontextrestored"));
    else callback.handleEvent(new Event("webglcontextrestored"));
  }
  expect(driver).toHaveBeenCalledTimes(1);
  expect(afterRestore).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledWith(new Error("driver restoration failed"), "webglcontextrestored");
});

it("preserves once and object callbacks, including re-registration inside a once callback", () => {
  installCanvas();
  /** Guarded context callback owner. */
  const owner = createDecorativeCanvas(jest.fn());
  /** Re-registering this original listener belongs to a new native registration. */
  const listener = {handleEvent: jest.fn(() => owner.canvas.addEventListener("webglcontextrestored", listener, {once: true}))};
  /** Native option conversion must snapshot once before the caller mutates it. */
  const options = {once: true};
  owner.canvas.addEventListener("webglcontextrestored", listener, options);
  options.once = false;
  owner.canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(listener.handleEvent).toHaveBeenCalledTimes(1);
  expect(listener.handleEvent.mock.contexts[0]).toBe(listener);
  owner.canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(listener.handleEvent).toHaveBeenCalledTimes(2);
  owner.dispose();
});

it("honors abort signals and permits a replacement registration after abort", () => {
  installCanvas();
  /** Canvas owner providing original-callback identity. */
  const owner = createDecorativeCanvas(jest.fn());
  /** Caller aborts an existing context subscription. */
  const abort = new AbortController();
  /** Restored listener can be registered again after its first subscription retires. */
  const listener = jest.fn();
  owner.canvas.addEventListener("webglcontextrestored", listener, {signal: abort.signal});
  abort.abort();
  owner.canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(listener).not.toHaveBeenCalled();
  owner.canvas.addEventListener("webglcontextrestored", listener, {signal: abort.signal});
  owner.canvas.addEventListener("webglcontextrestored", listener);
  owner.canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(listener).toHaveBeenCalledTimes(1);
  owner.dispose();
});

it("retirement blocks retained wrappers and add methods while leaving unrelated events native", () => {
  /** Retained callbacks include handlers removed by renderer disposal. */
  const browser = installCanvas();
  /** Owned canvas with an independent retirement lifetime. */
  const owner = createDecorativeCanvas(jest.fn());
  /** Context handler must never run after canvas retirement. */
  const context = jest.fn();
  /** Other browser events retain native registration semantics. */
  const click = jest.fn();
  /** Native constructor may retain an add method before disposing its canvas. */
  const retainedAdd = owner.canvas.addEventListener;
  owner.canvas.addEventListener("webglcontextrestored", context);
  owner.dispose();owner.dispose();
  retainedAdd("webglcontextrestored", context);
  owner.canvas.dispatchEvent(new Event("webglcontextrestored"));
  for (const callback of browser.retained) {
    if (typeof callback === "function") callback(new Event("webglcontextrestored"));
    else callback.handleEvent(new Event("webglcontextrestored"));
  }
  owner.canvas.addEventListener("click", click);
  owner.canvas.dispatchEvent(new Event("click"));
  expect(context).not.toHaveBeenCalled();
  expect(click).toHaveBeenCalledTimes(1);
});
