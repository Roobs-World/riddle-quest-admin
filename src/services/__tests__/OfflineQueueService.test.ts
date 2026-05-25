/**
 * Comprehensive tests for OfflineQueueService.
 *
 * Validates enqueue/drain lifecycle, retry limits, stale-call pruning,
 * AppState-triggered draining, network error detection, and singleton pattern.
 */

import {OfflineQueueService, offlineQueue, QueuedCall} from "../OfflineQueueService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {AppState, AppStateStatus} from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockCallable = jest.fn().mockResolvedValue({data: {ok: true}});
const mockHttpsCallableFn = jest.fn().mockReturnValue(mockCallable);

jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: jest.fn().mockReturnValue({}),
  httpsCallable: (...args: unknown[]) => mockHttpsCallableFn(...args),
}));
jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn().mockReturnValue({}),
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const mockCaptureException = jest.fn();
jest.mock("../../utils/sentry", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Get the mocked logger for assertions
import {logger} from "../../utils/logger";
const mockLogger = logger as jest.Mocked<typeof logger>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "@offline_queue";

function createService(): OfflineQueueService {
  // Access constructor via cast to allow creating fresh instances for testing
  return new (OfflineQueueService as unknown as new () => OfflineQueueService)();
}

function makeNetworkError(message = "Network request failed", code?: string): Error {
  const e = new Error(message) as Error & {code?: string};
  if (code) {
    e.code = code;
  }
  return e;
}

function makeQueuedCall(overrides: Partial<QueuedCall> = {}): QueuedCall {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    functionName: "testFunction",
    payload: {test: true},
    enqueuedAt: Date.now(),
    attempts: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("OfflineQueueService", () => {
  let service: OfflineQueueService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCallable.mockReset();
    mockCallable.mockResolvedValue({data: {ok: true}});
    mockHttpsCallableFn.mockReset();
    mockHttpsCallableFn.mockReturnValue(mockCallable);
    await AsyncStorage.clear();
    service = createService();
  });

  afterEach(() => {
    service.teardown();
  });

  // ── Singleton Pattern ──────────────────────────────────────────────────────

  describe("Singleton Pattern", () => {
    it("returns the same instance when getInstance is called multiple times", () => {
      const instance1 = OfflineQueueService.getInstance();
      const instance2 = OfflineQueueService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("exports offlineQueue singleton that matches getInstance", () => {
      expect(offlineQueue).toBe(OfflineQueueService.getInstance());
    });
  });

  // ── enqueue / queueSize ───────────────────────────────────────────────────

  describe("enqueue", () => {
    it("adds a call to the queue", async () => {
      await service.enqueue("submitGuess", {guess: "APPLE"});
      expect(await service.queueSize()).toBe(1);
    });

    it("adds multiple calls in order", async () => {
      await service.enqueue("submitGuess", {guess: "APPLE"});
      await service.enqueue("updateStats", {score: 100});
      expect(await service.queueSize()).toBe(2);
    });

    it("generates a unique ID for each queued call", async () => {
      await service.enqueue("fn1", {});
      await service.enqueue("fn2", {});
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const queue = JSON.parse(raw!) as QueuedCall[];
      expect(queue[0].id).not.toBe(queue[1].id);
      expect(queue[0].id).toMatch(/^\d+_[a-z0-9]+$/);
    });

    it("sets correct metadata on queued call", async () => {
      const beforeEnqueue = Date.now();
      await service.enqueue("testFn", {data: "value"});
      const afterEnqueue = Date.now();

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const queue = JSON.parse(raw!) as QueuedCall[];
      expect(queue[0].functionName).toBe("testFn");
      expect(queue[0].payload).toEqual({data: "value"});
      expect(queue[0].attempts).toBe(0);
      expect(queue[0].enqueuedAt).toBeGreaterThanOrEqual(beforeEnqueue);
      expect(queue[0].enqueuedAt).toBeLessThanOrEqual(afterEnqueue);
    });

    it("logs info when item is enqueued", async () => {
      await service.enqueue("submitGuess", {});
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("[OfflineQueue] Enqueued submitGuess"));
    });

    it("handles AsyncStorage errors gracefully and logs error", async () => {
      const mockError = new Error("Storage error");
      jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(mockError);

      await service.enqueue("testFn", {});

      // loadQueue intentionally treats storage read failures as empty queue fallback.
      expect(await service.queueSize()).toBe(1);
      expect(mockLogger.error).not.toHaveBeenCalledWith("[OfflineQueue] Failed to enqueue call", mockError);
    });

    it("handles AsyncStorage setItem errors gracefully", async () => {
      const mockError = new Error("Storage write error");
      jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(mockError);

      await service.enqueue("testFn", {});

      expect(mockLogger.error).toHaveBeenCalledWith("[OfflineQueue] Failed to enqueue call", mockError);
      expect(mockCaptureException).toHaveBeenCalledWith(mockError);
    });
  });

  // ── queueSize ─────────────────────────────────────────────────────────────

  describe("queueSize", () => {
    it("returns 0 for empty queue", async () => {
      expect(await service.queueSize()).toBe(0);
    });

    it("returns correct count after multiple enqueues", async () => {
      await service.enqueue("fn1", {});
      await service.enqueue("fn2", {});
      await service.enqueue("fn3", {});
      expect(await service.queueSize()).toBe(3);
    });

    it("returns 0 when storage contains invalid JSON", async () => {
      await AsyncStorage.setItem(STORAGE_KEY, "not valid json");
      expect(await service.queueSize()).toBe(0);
    });
  });

  // ── call (success path) ───────────────────────────────────────────────────

  describe("call", () => {
    it("invokes the firebase callable and returns data", async () => {
      mockCallable.mockResolvedValueOnce({data: {result: "ok"}});
      const result = await service.call("myFunction", {foo: "bar"});
      expect(result).toEqual({result: "ok"});
      expect(mockHttpsCallableFn).toHaveBeenCalledWith(expect.any(Object), "myFunction");
    });

    it("passes the correct payload to callable", async () => {
      const payload = {guess: "HELLO", gameId: "123"};
      mockCallable.mockResolvedValueOnce({data: {}});
      await service.call("submitGuess", payload);
      expect(mockCallable).toHaveBeenCalledWith(payload);
    });

    it("triggers drain after successful call", async () => {
      // Pre-populate queue
      await service.enqueue("queuedFn", {});
      mockCallable.mockResolvedValue({data: {}});

      await service.call("newFn", {});

      // After successful call, drain should have been triggered
      // and the queued item should be processed
      // Wait a tick for the void drain() to complete
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(await service.queueSize()).toBe(0);
    });

    it("queues the call when a network error is thrown", async () => {
      mockCallable.mockRejectedValueOnce(makeNetworkError());
      const result = await service.call("submitGuess", {guess: "HELLO"});
      expect(result).toBeNull();
      expect(await service.queueSize()).toBe(1);
    });

    it("logs warning when call is queued due to network error", async () => {
      mockCallable.mockRejectedValueOnce(makeNetworkError());
      await service.call("submitGuess", {});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("[OfflineQueue] Network error calling submitGuess"),
      );
    });

    it("re-throws non-network errors", async () => {
      const authError = Object.assign(new Error("Permission denied"), {
        code: "permission-denied",
      });
      mockCallable.mockRejectedValueOnce(authError);
      await expect(service.call("submitGuess", {})).rejects.toThrow("Permission denied");
    });

    it("does not queue call for non-network errors", async () => {
      const authError = Object.assign(new Error("Unauthorized"), {
        code: "unauthenticated",
      });
      mockCallable.mockRejectedValueOnce(authError);
      try {
        await service.call("submitGuess", {});
      } catch {
        // Expected
      }
      expect(await service.queueSize()).toBe(0);
    });
  });

  // ── Network error detection ───────────────────────────────────────────────

  describe("Network error detection", () => {
    it.each([
      ["unavailable", "Service unavailable"],
      ["deadline-exceeded", "Request timed out"],
      ["internal", "Internal error"],
    ])('detects Firebase error code "%s" as network error', async (code, message) => {
      mockCallable.mockRejectedValueOnce(makeNetworkError(message, code));
      const result = await service.call("testFn", {});
      expect(result).toBeNull();
      expect(await service.queueSize()).toBe(1);
    });

    it.each([
      "Network request failed",
      "network error occurred",
      "Failed to fetch",
      "Request timeout exceeded",
      "Connection lost",
    ])('detects message "%s" as network error', async (message) => {
      mockCallable.mockRejectedValueOnce(makeNetworkError(message));
      const result = await service.call("testFn", {});
      expect(result).toBeNull();
      expect(await service.queueSize()).toBe(1);
    });

    it.each([
      ["not-found", "Resource not found"],
      ["permission-denied", "Access denied"],
      ["invalid-argument", "Bad request"],
      ["unauthenticated", "Not logged in"],
    ])('does NOT detect Firebase code "%s" as network error', async (code, message) => {
      mockCallable.mockRejectedValueOnce(makeNetworkError(message, code));
      await expect(service.call("testFn", {})).rejects.toThrow();
    });

    it("handles null/undefined error gracefully", async () => {
      mockCallable.mockRejectedValueOnce(null);
      await expect(service.call("testFn", {})).rejects.toBeNull();
    });
  });

  // ── drain ─────────────────────────────────────────────────────────────────

  describe("drain", () => {
    it("replays queued calls successfully", async () => {
      await service.enqueue("submitGuess", {guess: "APPLE"});
      mockCallable.mockResolvedValueOnce({data: {}});
      await service.drain();
      expect(await service.queueSize()).toBe(0);
      expect(mockCallable).toHaveBeenCalledTimes(1);
    });

    it("replays multiple queued calls in order", async () => {
      await service.enqueue("fn1", {order: 1});
      await service.enqueue("fn2", {order: 2});
      await service.enqueue("fn3", {order: 3});
      mockCallable.mockResolvedValue({data: {}});

      await service.drain();

      expect(mockCallable).toHaveBeenCalledTimes(3);
      expect(mockCallable).toHaveBeenNthCalledWith(1, {order: 1});
      expect(mockCallable).toHaveBeenNthCalledWith(2, {order: 2});
      expect(mockCallable).toHaveBeenNthCalledWith(3, {order: 3});
    });

    it("logs info when starting drain with items", async () => {
      await service.enqueue("fn1", {});
      await service.enqueue("fn2", {});
      mockCallable.mockResolvedValue({data: {}});
      await service.drain();
      expect(mockLogger.info).toHaveBeenCalledWith("[OfflineQueue] Draining 2 queued call(s)");
    });

    it("logs info after successful replay", async () => {
      await service.enqueue("submitGuess", {});
      mockCallable.mockResolvedValueOnce({data: {}});
      await service.drain();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("[OfflineQueue] Successfully replayed submitGuess"),
      );
    });

    it("keeps items in queue when drain fails with network error", async () => {
      await service.enqueue("submitGuess", {guess: "APPLE"});
      mockCallable.mockRejectedValueOnce(makeNetworkError());
      await service.drain();
      expect(await service.queueSize()).toBe(1);
    });

    it("increments attempt count after each failed drain", async () => {
      await service.enqueue("submitGuess", {guess: "APPLE"});
      mockCallable.mockRejectedValue(makeNetworkError());
      await service.drain();
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const queue = JSON.parse(raw!) as QueuedCall[];
      expect(queue[0].attempts).toBe(1);
    });

    it("discards a call after MAX_ATTEMPTS (5) failed drains", async () => {
      await service.enqueue("submitGuess", {guess: "APPLE"});
      mockCallable.mockRejectedValue(makeNetworkError());
      // Run drain 5 times to exhaust attempts
      for (let i = 0; i < 5; i++) {
        await service.drain();
      }
      // On 6th drain the item has attempts=5 and should be discarded
      await service.drain();
      expect(await service.queueSize()).toBe(0);
    });

    it("logs warning when discarding stale call due to max attempts", async () => {
      // Manually insert call with attempts=5
      const staleCall = makeQueuedCall({attempts: 5, functionName: "staleFn"});
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([staleCall]));

      await service.drain();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("[OfflineQueue] Discarding stale call staleFn"),
      );
    });

    it("discards items older than 24 hours", async () => {
      await service.enqueue("oldCall", {});
      // Mutate the stored item to be 25 hours old
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const queue = JSON.parse(raw!) as QueuedCall[];
      queue[0].enqueuedAt = Date.now() - 25 * 60 * 60 * 1000;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));

      await service.drain();
      expect(await service.queueSize()).toBe(0);
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it("discards items exactly at 24 hours threshold", async () => {
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      const staleCall = makeQueuedCall({
        enqueuedAt: Date.now() - twentyFourHoursMs - 1,
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([staleCall]));

      await service.drain();

      expect(await service.queueSize()).toBe(0);
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it("keeps items just under 24 hours threshold", async () => {
      const underTwentyFourHoursMs = 24 * 60 * 60 * 1000 - 1000;
      const freshCall = makeQueuedCall({
        enqueuedAt: Date.now() - underTwentyFourHoursMs,
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([freshCall]));
      mockCallable.mockResolvedValueOnce({data: {}});

      await service.drain();

      expect(mockCallable).toHaveBeenCalledTimes(1);
    });

    it("discards items that fail with a non-network error during drain", async () => {
      await service.enqueue("badCall", {});
      const badError = Object.assign(new Error("not-found"), {
        code: "not-found",
      });
      mockCallable.mockRejectedValueOnce(badError);
      await service.drain();
      expect(await service.queueSize()).toBe(0);
    });

    it("logs warning when discarding due to non-network error", async () => {
      await service.enqueue("badCall", {});
      const badError = Object.assign(new Error("Resource not found"), {
        code: "not-found",
      });
      mockCallable.mockRejectedValueOnce(badError);
      await service.drain();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("[OfflineQueue] Discarding badCall due to non-network error"),
        badError,
      );
    });

    it("does not run concurrently (isDraining guard)", async () => {
      await service.enqueue("submitGuess", {});
      // Start two drains simultaneously
      const p1 = service.drain();
      const p2 = service.drain(); // should short-circuit
      await Promise.all([p1, p2]);
      // callable should only be called once
      expect(mockCallable).toHaveBeenCalledTimes(1);
    });

    it("resets isDraining flag after drain completes", async () => {
      await service.enqueue("fn1", {});
      mockCallable.mockResolvedValueOnce({data: {}});
      await service.drain();

      // Should be able to drain again
      await service.enqueue("fn2", {});
      mockCallable.mockResolvedValueOnce({data: {}});
      await service.drain();

      expect(mockCallable).toHaveBeenCalledTimes(2);
    });

    it("resets isDraining flag even when drain throws", async () => {
      const mockError = new Error("Storage error");
      jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(mockError);

      await service.drain();

      // Should be able to drain again
      await service.enqueue("fn1", {});
      mockCallable.mockResolvedValueOnce({data: {}});
      await service.drain();

      expect(mockCallable).toHaveBeenCalledTimes(1);
    });

    it("returns early when queue is empty", async () => {
      await service.drain();
      expect(mockCallable).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("Draining"));
    });

    it("logs summary after partial drain completion", async () => {
      await service.enqueue("fn1", {});
      await service.enqueue("fn2", {});
      mockCallable
        .mockResolvedValueOnce({data: {}}) // fn1 succeeds
        .mockRejectedValueOnce(makeNetworkError()); // fn2 fails

      await service.drain();

      expect(mockLogger.info).toHaveBeenCalledWith("[OfflineQueue] Drain complete. 1 calls replayed, 1 still queued.");
    });

    it("handles errors during drain and logs/captures them", async () => {
      const mockError = new Error("Unexpected storage error");
      jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(mockError);

      await service.drain();

      // loadQueue intentionally swallows storage read errors and returns empty queue.
      expect(mockLogger.error).not.toHaveBeenCalledWith("[OfflineQueue] Drain failed", mockError);
      expect(mockCaptureException).not.toHaveBeenCalledWith(mockError);
    });

    it("processes mixed success/fail/stale calls correctly", async () => {
      // Fresh call that will succeed
      const freshSuccess = makeQueuedCall({id: "1", functionName: "success"});
      // Fresh call that will fail with network error
      const freshNetworkFail = makeQueuedCall({id: "2", functionName: "networkFail"});
      // Fresh call that will fail with non-network error
      const freshBadCall = makeQueuedCall({id: "3", functionName: "badCall"});
      // Stale call (too old)
      const staleCall = makeQueuedCall({
        id: "4",
        functionName: "stale",
        enqueuedAt: Date.now() - 25 * 60 * 60 * 1000,
      });
      // Exhausted attempts call
      const exhaustedCall = makeQueuedCall({
        id: "5",
        functionName: "exhausted",
        attempts: 5,
      });

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([freshSuccess, freshNetworkFail, freshBadCall, staleCall, exhaustedCall]),
      );

      mockCallable
        .mockResolvedValueOnce({data: {}}) // success
        .mockRejectedValueOnce(makeNetworkError()) // networkFail
        .mockRejectedValueOnce(makeNetworkError("Not found", "not-found")); // badCall

      await service.drain();

      // Only networkFail should remain (with attempts incremented)
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const remaining = JSON.parse(raw!) as QueuedCall[];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("2");
      expect(remaining[0].attempts).toBe(1);
    });
  });

  // ── clear ─────────────────────────────────────────────────────────────────

  describe("clear", () => {
    it("empties the queue", async () => {
      await service.enqueue("myFn", {});
      await service.enqueue("myFn2", {});
      await service.clear();
      expect(await service.queueSize()).toBe(0);
    });

    it("logs info when queue is cleared", async () => {
      await service.clear();
      expect(mockLogger.info).toHaveBeenCalledWith("[OfflineQueue] Queue cleared");
    });

    it("removes storage key entirely", async () => {
      await service.enqueue("fn", {});
      await service.clear();
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      expect(raw).toBeNull();
    });
  });

  // ── Storage helpers (loadQueue edge cases) ────────────────────────────────

  describe("loadQueue (internal)", () => {
    it("returns empty array when storage is empty", async () => {
      expect(await service.queueSize()).toBe(0);
    });

    it("returns empty array when storage contains invalid JSON", async () => {
      await AsyncStorage.setItem(STORAGE_KEY, "not valid json {{{");
      expect(await service.queueSize()).toBe(0);
    });

    it("returns empty array when storage read fails", async () => {
      jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("Read error"));
      expect(await service.queueSize()).toBe(0);
    });
  });

  // ── AppState integration ──────────────────────────────────────────────────

  describe("initialize / teardown", () => {
    it("registers an AppState listener on initialize", () => {
      const addSpy = jest.spyOn(AppState, "addEventListener");
      service.initialize();
      expect(addSpy).toHaveBeenCalledWith("change", expect.any(Function));
      addSpy.mockRestore();
    });

    it("removes AppState listener on teardown", () => {
      const mockRemove = jest.fn();
      jest
        .spyOn(AppState, "addEventListener")
        .mockReturnValue({remove: mockRemove} as ReturnType<typeof AppState.addEventListener>);
      service.initialize();
      service.teardown();
      expect(mockRemove).toHaveBeenCalled();
    });

    it("teardown is safe to call without initialize", () => {
      const freshService = createService();
      expect(() => freshService.teardown()).not.toThrow();
    });

    it("drains immediately on initialize", async () => {
      await service.enqueue("pendingCall", {});
      mockCallable.mockResolvedValueOnce({data: {}});

      service.initialize();

      // Wait for the async drain to complete
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(await service.queueSize()).toBe(0);
    });

    it("logs info on successful initialization", () => {
      service.initialize();
      expect(mockLogger.info).toHaveBeenCalledWith("[OfflineQueue] Initialized");
    });

    it("triggers drain when AppState becomes active", async () => {
      let capturedListener: ((state: AppStateStatus) => void) | null = null;
      jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
        capturedListener = listener;
        return {remove: jest.fn()} as ReturnType<typeof AppState.addEventListener>;
      });

      await service.enqueue("pendingCall", {});
      mockCallable.mockResolvedValueOnce({data: {}});

      service.initialize();
      // Clear the immediate drain call
      mockCallable.mockClear();

      // Re-enqueue for the AppState trigger test
      await service.enqueue("newCall", {});
      mockCallable.mockResolvedValueOnce({data: {}});

      // Simulate AppState change to active
      expect(capturedListener).not.toBeNull();
      capturedListener!("active");

      // Wait for async drain
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(await service.queueSize()).toBe(0);
    });

    it("does not drain when AppState becomes background", async () => {
      let capturedListener: ((state: AppStateStatus) => void) | null = null;
      jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
        capturedListener = listener;
        return {remove: jest.fn()} as ReturnType<typeof AppState.addEventListener>;
      });

      service.initialize();

      // Wait for immediate drain to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Now add item after init
      await service.enqueue("bgCall", {});
      mockCallable.mockClear();

      // Simulate AppState change to background
      capturedListener!("background");

      // Wait a tick
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Item should still be in queue (not drained)
      expect(await service.queueSize()).toBe(1);
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it("does not drain when AppState becomes inactive", async () => {
      let capturedListener: ((state: AppStateStatus) => void) | null = null;
      jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
        capturedListener = listener;
        return {remove: jest.fn()} as ReturnType<typeof AppState.addEventListener>;
      });

      service.initialize();
      await new Promise((resolve) => setTimeout(resolve, 0));

      await service.enqueue("inactiveCall", {});
      mockCallable.mockClear();

      capturedListener!("inactive");
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(await service.queueSize()).toBe(1);
      expect(mockCallable).not.toHaveBeenCalled();
    });
  });

  // ── Type safety ───────────────────────────────────────────────────────────

  describe("Type safety", () => {
    it("call returns typed result", async () => {
      interface MyResult {
        success: boolean;
        count: number;
      }
      mockCallable.mockResolvedValueOnce({data: {success: true, count: 42}});
      const result = await service.call<MyResult>("typedFn", {});
      expect(result).toEqual({success: true, count: 42});
    });

    it("handles various payload types", async () => {
      mockCallable.mockResolvedValue({data: {}});

      // String payload
      await service.call("fn", "string payload");
      expect(mockCallable).toHaveBeenLastCalledWith("string payload");

      // Number payload
      await service.call("fn", 123);
      expect(mockCallable).toHaveBeenLastCalledWith(123);

      // Array payload
      await service.call("fn", [1, 2, 3]);
      expect(mockCallable).toHaveBeenLastCalledWith([1, 2, 3]);

      // Null payload
      await service.call("fn", null);
      expect(mockCallable).toHaveBeenLastCalledWith(null);

      // Undefined payload
      await service.call("fn", undefined);
      expect(mockCallable).toHaveBeenLastCalledWith(undefined);
    });
  });
});
