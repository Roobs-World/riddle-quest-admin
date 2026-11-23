import {afterAll, beforeAll, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {JestPurchaseCoordinator} from "../purchases";
import {MockJestPlatform} from "../MockJestPlatform";
import {JestBackendClient} from "../backend";
import type {JestSession} from "../types";
import type {HostServices} from "@riddle-quest/hosted/hostTypes";

/** Captures the browser adapter lifetime without mounting unrelated game UI. */
const mockEffects: Array<() => (() => void) | undefined> = [];
/** Retains account ownership refs across explicit hook rerenders. */
const mockRefs: Array<{
  /** Value retained by one hook slot. */
  current: unknown;
}> = [];
/** Restarts hook slot selection for each render. */
let mockRefIndex = 0;
jest.mock("react", () => ({
  useEffect: (effect: () => (() => void) | undefined) => mockEffects.push(effect),
  useRef: (current: unknown) => mockRefs[mockRefIndex++] ?? (mockRefs[mockRefIndex - 1] = {current}),
}));
jest.mock("../../observability/browserErrorReporter", () => ({captureBrowserException: jest.fn()}));
import {useJestPurchaseRecovery} from "../useJestPurchaseRecovery";
import {captureBrowserException} from "../../observability/browserErrorReporter";

/** Real event targets exercise browser signal registration and cleanup. */
const browser = new EventTarget();
/** Visibility transitions are controlled independently of foreground signals. */
const page = Object.assign(new EventTarget(), {visibilityState: "visible"});
/** Original globals restored after the adapter tests. */
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
/** Original document restored after the adapter tests. */
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

beforeAll(() => {
  Object.defineProperty(globalThis, "window", {configurable: true, value: browser});
  Object.defineProperty(globalThis, "document", {configurable: true, value: page});
});
afterAll(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});
beforeEach(() => {mockEffects.length = 0; mockRefs.length = 0; mockRefIndex = 0; page.visibilityState = "visible"; jest.clearAllMocks();});

/** Lets the shared recovery drain finish after an event dispatch. */
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
/** Ready account whose initial recovery has already succeeded. */
const session = (): JestSession => ({
  player: {playerId: "player-1", registered: true}, profile: null, entryIntent: {},
  preferences: {}, playerData: null, firebaseUid: "jest:player-1", firebaseAuthenticated: true,
});

/** Installs the actual browser adapter against controllable provider/backend operations. */
function harness(current: JestSession | null = session()) {
  /** Current account checked by late recovery callbacks. */
  const sessionRef = {current};
  /** Provider receipts can settle or fail independently of browser signals. */
  const reconcile = jest.fn<JestPurchaseCoordinator["reconcile"]>().mockResolvedValue({status: "success", value: 1});
  /** Records catalog and entitlement refreshes after recovery. */
  const refreshProducts = jest.fn<() => Promise<void>>().mockResolvedValue();
  /** Routine browser wakes use the catalog's bounded background freshness policy. */
  const refreshBackgroundProducts = jest.fn<() => Promise<void>>().mockResolvedValue();
  /** Records authoritative profile publication for the owning account. */
  const loadProfile = jest.fn<HostServices["loadProfile"]>().mockResolvedValue(null);
  /** Closing the deletion gate retires later work. */
  let open = true;
  /** Disposes the previous committed effect before a replacement render. */
  let cleanup: (() => void) | undefined;
  /** Commits a session while preserving the hook's ownership refs. */
  const render = (next: JestSession | null) => {
    cleanup?.();
    sessionRef.current = next;
    mockRefIndex = 0;
    mockEffects.length = 0;
    useJestPurchaseRecovery({purchases: {reconcile}, session: next, sessionRef,
      gate: {isOpen: () => open, run: operation => operation()}, refreshProducts, refreshBackgroundProducts, hostServices: {loadProfile}});
    cleanup = mockEffects[0]();
  };
  render(current);
  return {sessionRef, reconcile, refreshProducts, refreshBackgroundProducts, loadProfile, cleanup: () => cleanup?.(),
    rerender: render, close: () => {open = false;}};
}

describe("Jest purchase recovery after startup", () => {
  it("keeps durable receipt recovery on every focus while using background catalog refresh", async () => {
    /** Empty receipt queues must not force a fresh signed subscription request on every focus. */
    const context = harness();
    context.reconcile.mockResolvedValue({status: "success", value: 0});
    for (let wake = 0; wake < 12; wake++) {
      browser.dispatchEvent(new Event("focus"));
      await settle();
    }
    expect(context.reconcile).toHaveBeenCalledTimes(12);
    expect(context.loadProfile).toHaveBeenCalledTimes(12);
    expect(context.refreshBackgroundProducts).toHaveBeenCalledTimes(12);
    expect(context.refreshProducts).not.toHaveBeenCalled();
    context.cleanup();
  });

  it.each(["online", "riddle-quest:registration-prompt-closed"])("forces fresh entitlement state after %s", async signal => {
    /** Empty receipt recovery does not hide the external identity or connectivity change. */
    const context = harness();
    context.reconcile.mockResolvedValue({status: "success", value: 0});
    browser.dispatchEvent(new Event(signal));
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(1);
    expect(context.refreshProducts).toHaveBeenCalledTimes(1);
    expect(context.refreshBackgroundProducts).not.toHaveBeenCalled();
    expect(context.loadProfile).toHaveBeenCalledTimes(1);
    context.cleanup();
  });

  it.each(["online", "riddle-quest:registration-prompt-closed"])("retains a hidden %s event's fresh-read requirement until foreground", async signal => {
    /** Recent ordinary recovery cannot consume an external-change freshness requirement. */
    const context = harness();
    context.reconcile.mockResolvedValue({status: "success", value: 0});
    browser.dispatchEvent(new Event("focus"));
    await settle();
    expect(context.refreshBackgroundProducts).toHaveBeenCalledTimes(1);
    page.visibilityState = "hidden";
    browser.dispatchEvent(new Event(signal));
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(1);
    expect(context.refreshProducts).not.toHaveBeenCalled();
    page.visibilityState = "visible";
    browser.dispatchEvent(new Event("focus"));
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(2);
    expect(context.refreshProducts).toHaveBeenCalledTimes(1);
    expect(context.refreshBackgroundProducts).toHaveBeenCalledTimes(1);
    context.cleanup();
  });

  it("finishes admitted receipt recovery while deferring hidden catalog work until foreground", async () => {
    /** Recovery starts while the account is visible. */
    const context = harness();
    /** Grants an admitted receipt after the player backgrounds the document. */
    let finish: ((result: Awaited<ReturnType<JestPurchaseCoordinator["reconcile"]>>) => void) | undefined;
    context.reconcile.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    browser.dispatchEvent(new Event("focus"));
    await settle();
    page.visibilityState = "hidden";
    if (!finish) throw new Error("Durable recovery did not start");
    finish({status: "success", value: 1});
    await settle();
    expect(context.loadProfile).toHaveBeenCalledTimes(1);
    expect(context.refreshProducts).not.toHaveBeenCalled();
    expect(context.refreshBackgroundProducts).not.toHaveBeenCalled();
    context.reconcile.mockResolvedValue({status: "success", value: 0});
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(2);
    expect(context.refreshProducts).toHaveBeenCalledTimes(1);
    expect(context.refreshBackgroundProducts).not.toHaveBeenCalled();
    expect(context.loadProfile).toHaveBeenCalledTimes(2);
    context.cleanup();
  });

  it("recovers after login and foreground signals without duplicating initial recovery", async () => {
    /** Ready session has already completed its startup reconciliation. */
    const context = harness();
    expect(context.reconcile).not.toHaveBeenCalled();
    page.visibilityState = "hidden";
    browser.dispatchEvent(new Event("focus"));
    await settle();
    expect(context.reconcile).not.toHaveBeenCalled();
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(context.reconcile).toHaveBeenCalledWith("player-1");
    expect(context.refreshProducts).toHaveBeenCalledTimes(1);
    expect(context.loadProfile).toHaveBeenCalledWith("jest:player-1");
    browser.dispatchEvent(new Event("riddle-quest:registration-prompt-closed"));
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(2);
    context.cleanup?.();
  });

  it("coalesces overlapping signals and never reconciles concurrently", async () => {
    /** Browser signals share one pending provider reconciliation. */
    const context = harness();
    /** Releases the first delayed receipt response. */
    let finish: ((result: Awaited<ReturnType<JestPurchaseCoordinator["reconcile"]>>) => void) | undefined;
    context.reconcile.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    browser.dispatchEvent(new Event("focus"));
    await settle();
    browser.dispatchEvent(new Event("online"));
    browser.dispatchEvent(new Event("pageshow"));
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(1);
    if (!finish) throw new Error("Recovery did not start");
    finish({status: "success", value: 1});
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(2);
    expect(context.refreshProducts).toHaveBeenCalledTimes(2);
    expect(context.loadProfile).toHaveBeenCalledTimes(2);
    context.cleanup?.();
  });

  it("leaves a failed grant recoverable and retries when connectivity returns", async () => {
    /** First provider response fails before connectivity returns. */
    const context = harness();
    context.reconcile.mockResolvedValueOnce({status: "retryable-failure", message: "offline"});
    browser.dispatchEvent(new Event("focus"));
    await settle();
    expect(context.refreshProducts).not.toHaveBeenCalled();
    expect(context.loadProfile).not.toHaveBeenCalled();
    browser.dispatchEvent(new Event("online"));
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(2);
    expect(context.loadProfile).toHaveBeenCalledTimes(1);
    context.cleanup?.();
  });

  it("reports a failed grant once and recovers its receipt on the next wake", async () => {
    /** Ready account owns recovery across the failed and successful browser wakes. */
    const context = harness();
    /** Provider keeps the receipt pending until its authoritative grant succeeds. */
    const platform = new MockJestPlatform();
    jest.spyOn(platform, "getIncompletePurchases").mockResolvedValue({status: "success", value: {
      purchases: [{purchaseToken: "pending-token", productSku: "coins"}],
      purchasesSigned: "signed-pending", hasMore: false,
    }});
    /** A failed grant must leave provider completion untouched. */
    const complete = jest.spyOn(platform, "completePurchase");
    /** Grant responses are controlled without issuing an external request. */
    const backend = new JestBackendClient("https://example.invalid");
    /** The original grant exception must reach telemetry exactly once. */
    const grantError = new Error("Grant temporarily unavailable");
    jest.spyOn(backend, "grantPurchase").mockRejectedValueOnce(grantError).mockResolvedValue({
      granted: true, purchaseToken: "pending-token", coinsAwarded: 250, newCoins: 550,
    });
    /** Real coordinator preserves reporting and grant-before-complete ordering. */
    const purchases = new JestPurchaseCoordinator(platform, backend);
    context.reconcile.mockImplementation(playerId => purchases.reconcile(playerId));
    try {
      browser.dispatchEvent(new Event("focus"));
      await settle();
      expect(captureBrowserException).toHaveBeenCalledTimes(1);
      expect(captureBrowserException).toHaveBeenCalledWith(grantError, {
        component: "jest_purchases", operation: "reconcile_purchase",
      });
      expect(complete).not.toHaveBeenCalled();
      expect(context.loadProfile).not.toHaveBeenCalled();
      browser.dispatchEvent(new Event("online"));
      await settle();
      expect(complete).toHaveBeenCalledWith("pending-token");
      expect(context.loadProfile).toHaveBeenCalledWith("jest:player-1");
      expect(captureBrowserException).toHaveBeenCalledTimes(1);
    } finally {context.cleanup();}
  });

  it.each(["player", "firebase", "both"])("recovers a committed %s identity replacement after login dispatched early", async change => {
    /** Old session still owns the listener when login dispatches its event. */
    const context = harness();
    browser.dispatchEvent(new Event("riddle-quest:registration-prompt-closed"));
    /** Replacement identity committed after the registration event. */
    const next = {...session(),
      player: {playerId: change === "firebase" ? "player-1" : "player-2", registered: true},
      firebaseUid: change === "player" ? "jest:player-1" : "jest:player-2"};
    context.rerender(next);
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(1);
    expect(context.reconcile).toHaveBeenCalledWith(next.player.playerId);
    expect(context.refreshProducts).toHaveBeenCalledTimes(1);
    expect(context.loadProfile).toHaveBeenCalledWith(next.firebaseUid);
    context.rerender({...next});
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(1);
    context.cleanup();
  });

  it("skips only the first initialized owner after startup finishes", async () => {
    /** Startup has not yet published its first ready identity. */
    const context = harness(null);
    context.rerender(session());
    await settle();
    expect(context.reconcile).not.toHaveBeenCalled();
    context.cleanup();
  });

  it.each(["cleanup", "replacement", "deletion"])("retires pending publication after %s", async reason => {
    /** Account recovery starts before its owner is retired. */
    const context = harness();
    /** Releases an admitted provider response after account retirement. */
    let finish: ((result: Awaited<ReturnType<JestPurchaseCoordinator["reconcile"]>>) => void) | undefined;
    context.reconcile.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    browser.dispatchEvent(new Event("focus"));
    await settle();
    browser.dispatchEvent(new Event("online"));
    if (reason === "cleanup") context.cleanup?.();
    if (reason === "replacement") context.sessionRef.current = {...session(), firebaseUid: "jest:another-player"};
    if (reason === "deletion") context.close();
    if (!finish) throw new Error("Recovery did not start");
    finish({status: "success", value: 1});
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(1);
    expect(context.refreshProducts).not.toHaveBeenCalled();
    expect(context.loadProfile).not.toHaveBeenCalled();
    browser.dispatchEvent(new Event("focus"));
    await settle();
    expect(context.reconcile).toHaveBeenCalledTimes(1);
    context.cleanup?.();
  });

  it.each([null, {...session(), firebaseUid: undefined}])("does not start without a confirmed account", async current => {
    /** Missing identity never admits provider recovery. */
    const context = harness(current);
    browser.dispatchEvent(new Event("focus"));
    await settle();
    expect(context.reconcile).not.toHaveBeenCalled();
    context.cleanup?.();
  });
});
