import {afterEach, beforeEach, expect, it, jest} from "@jest/globals";
import type {ShopSubscriptionContext} from "../../play/modalPages/commerce/ShopSubscriptionContext";
import type {ContextType} from "react";

/** Controlled subscription effects expose refresh and cancellation calls. */
const mockEffects: Array<() => (() => void) | void> = [];
/** Controlled provider subscriptions supply deterministic renewal state. */
let mockSubscriptions: ContextType<typeof ShopSubscriptionContext>;
jest.mock("react", () => ({
  ...jest.requireActual<typeof import("react")>("react"),
  useContext: () => mockSubscriptions,
  useEffect: (effect: () => (() => void) | void) => mockEffects.push(effect),
  useRef: (current: unknown) => ({current}),
  useState: (initial: unknown) => [initial, jest.fn()],
}));
import {useSubscriptionManagement} from "../../play/modalPages/commerce/useSubscriptionManagement";

/** Original global browser surface is restored after each fixture. */
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
/** Original document surface is restored after each fixture. */
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
/** Captured focus handler allows deterministic subscription refresh. */
let focus: (() => void) | undefined;
/** Captured visibility handler allows deterministic subscription refresh. */
let visibility = "visible";
/** Registered cleanup disposes the current subscription observation. */
let cleanup: (() => void) | void;
/** Controlled refresh result determines the current provider entitlement. */
const refresh = jest.fn<() => Promise<void>>();
/** Controlled cancellation result cannot revoke access before confirmation. */
const cancel = jest.fn<(sku: string) => Promise<"success" | "cancelled" | "error">>();
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockEffects.length = 0;
  focus = undefined;
  visibility = "visible";
  refresh.mockResolvedValue(undefined);
  mockSubscriptions = {products: [], refresh, cancel};
  Object.defineProperty(globalThis, "window", {configurable: true, value: {
    setInterval, clearInterval,
    addEventListener: (_event: string, callback: () => void) => { focus = callback; },
    removeEventListener: () => { focus = undefined; },
  }});
  Object.defineProperty(globalThis, "document", {configurable: true, value: {
    /** Fixture visibility controls background refresh behavior. */
    get visibilityState() { return visibility; },
  }});
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  jest.useRealTimers();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

it("keeps a visible modal comfortably below the backend’s 30 requests per minute", async () => {
  useSubscriptionManagement();
  cleanup = mockEffects[0]();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(refresh.mock.calls.length).toBeGreaterThan(1);
  expect(refresh.mock.calls.length).toBeLessThanOrEqual(12);
  /** Refresh count before focus distinguishes newly requested updates. */
  const beforeFocus = refresh.mock.calls.length;
  focus?.();
  await Promise.resolve();
  expect(refresh).toHaveBeenCalledTimes(beforeFocus + 1);
});

it("does not poll a hidden or closed modal", async () => {
  useSubscriptionManagement();
  cleanup = mockEffects[0]();
  await Promise.resolve();
  visibility = "hidden";
  await jest.advanceTimersByTimeAsync(60_000);
  expect(refresh).toHaveBeenCalledTimes(1);
  cleanup?.();
  cleanup = undefined;
  visibility = "visible";
  await jest.advanceTimersByTimeAsync(60_000);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("avoids competing refreshes while a cancellation is awaiting the provider", async () => {
  /** Controlled settlement releases the pending cancellation. */
  let finish!: (result: "success") => void;
  cancel.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  /** Authoritative or observed state used to verify the current transition. */
  const state = useSubscriptionManagement();
  cleanup = mockEffects[0]();
  await Promise.resolve();
  /** In-flight operation remains observable until its controlled settlement. */
  const pending = state.cancel("premium");
  focus?.();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(refresh).toHaveBeenCalledTimes(1);
  finish("success");
  await pending;
  await jest.advanceTimersByTimeAsync(10_000);
  expect(refresh).toHaveBeenCalledTimes(2);
});
