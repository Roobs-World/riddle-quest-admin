import {createDecorativeInitialization} from "../decorativeInitialization";

/** Models visibility events including callbacks retained after removal. */
function installVisibility() {
  /** Current subscriptions owned by the initialization gate. */
  const listeners = new Set<() => void>();
  /** Browser callbacks retained after they were removed. */
  const retained = new Set<() => void>();
  /** Mutable visibility exposed to the gate. */
  const documentMock = {
    hidden: false,
    addEventListener: (_type: string, callback: () => void) => { listeners.add(callback); retained.add(callback); },
    removeEventListener: (_type: string, callback: () => void) => listeners.delete(callback),
  };
  Object.defineProperty(globalThis, "document", {configurable: true, value: documentMock});
  return {listeners, retained, documentMock, visibility: (hidden: boolean) => {
    documentMock.hidden = hidden;
    [...listeners].forEach((callback) => callback());
  }};
}

afterEach(() => { Reflect.deleteProperty(globalThis, "document"); });

it("waits for both visibility and host resume, then constructs once without polling", () => {
  /** Browser visibility and subscription state. */
  const browser = installVisibility();
  browser.documentMock.hidden = true;
  /** Current host eligibility. */
  let unpaused = false;
  /** Counts actual resource construction. */
  const initialize = jest.fn();
  /** Initialization owner whose current eligibility changes during play. */
  const gate = createDecorativeInitialization({canInitialize: () => unpaused, initialize, onError: jest.fn()});
  expect(initialize).not.toHaveBeenCalled();
  expect(browser.listeners.size).toBe(1);
  browser.visibility(false);
  expect(initialize).not.toHaveBeenCalled();
  unpaused = true;
  gate.refresh();
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(browser.listeners.size).toBe(0);
  for (let count = 0; count < 20; count++) { gate.refresh(); browser.visibility(count % 2 === 0); }
  browser.retained.forEach((callback) => callback());
  expect(initialize).toHaveBeenCalledTimes(1);
  gate.dispose();
});

it("retirement removes its listener and prevents retained callbacks from allocating", () => {
  /** Browser subscriptions with retained removed callbacks. */
  const browser = installVisibility();
  browser.documentMock.hidden = true;
  /** Resource construction must never occur after retirement. */
  const initialize = jest.fn();
  /** Pending owner retired before its eligibility changes. */
  const gate = createDecorativeInitialization({canInitialize: () => true, initialize, onError: jest.fn()});
  gate.dispose();
  gate.dispose();
  browser.visibility(false);
  gate.refresh();
  browser.retained.forEach((callback) => callback());
  expect(browser.listeners.size).toBe(0);
  expect(initialize).not.toHaveBeenCalled();
});

it("contains deferred setup and diagnostic failures and never retries a failed setup", () => {
  /** Hidden browser makes the setup failure occur inside a visibility callback. */
  const browser = installVisibility();
  browser.documentMock.hidden = true;
  /** Failed driver setup. */
  const initialize = jest.fn(() => { throw new Error("driver setup failed"); });
  /** Failing diagnostics must not escape into gameplay. */
  const onError = jest.fn(() => { throw new Error("reporter failed"); });
  /** Owner that retires its failed first construction. */
  const gate = createDecorativeInitialization({canInitialize: () => true, initialize, onError});
  expect(() => browser.visibility(false)).not.toThrow();
  gate.refresh();
  browser.retained.forEach((callback) => callback());
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(browser.listeners.size).toBe(0);
});

it("guards reentrant refresh during the first resource construction", () => {
  /** Browser starts hidden so the owner exists before the callback starts. */
  const browser = installVisibility();
  browser.documentMock.hidden = true;
  /** Reentrant construction callback invokes its own owner. */
  const initialize = jest.fn(() => gate.refresh());
  /** Resource owner whose started flag must precede the callback. */
  const gate = createDecorativeInitialization({canInitialize: () => true, initialize, onError: jest.fn()});
  browser.visibility(false);
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(browser.listeners.size).toBe(0);
  gate.dispose();
});
