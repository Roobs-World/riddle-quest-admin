/**
 * Tests for OfflineQueueService.
 *
 * Validates enqueue/drain lifecycle, retry limits, stale-call pruning,
 * and AppState-triggered draining.
 */

import { OfflineQueueService } from "../OfflineQueueService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockCallable = jest.fn().mockResolvedValue({ data: { ok: true } });
const mockHttpsCallableFn = jest.fn().mockReturnValue(mockCallable);

jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: jest.fn().mockReturnValue({}),
  httpsCallable: (...args: unknown[]) => mockHttpsCallableFn(...args),
}));
jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn().mockReturnValue({}),
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("../../utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createService(): OfflineQueueService {
  return new (OfflineQueueService as unknown as new () => OfflineQueueService)();
}

function makeNetworkError(message = "Network request failed"): Error {
  const e = new Error(message);
  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("OfflineQueueService", () => {
  let service: OfflineQueueService;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    service = createService();
  });

  afterEach(() => {
    service.teardown();
  });

  // ── enqueue / queueSize ───────────────────────────────────────────────────

  describe("enqueue", () => {
    it("adds a call to the queue", async () => {
      await service.enqueue("submitGuess", { guess: "APPLE" });
      expect(await service.queueSize()).toBe(1);
    });

    it("adds multiple calls in order", async () => {
      await service.enqueue("submitGuess", { guess: "APPLE" });
      await service.enqueue("updateStats", { score: 100 });
      expect(await service.queueSize()).toBe(2);
    });
  });

  // ── call (success path) ───────────────────────────────────────────────────

  describe("call", () => {
    it("invokes the firebase callable and returns data", async () => {
      mockCallable.mockResolvedValueOnce({ data: { result: "ok" } });
      const result = await service.call("myFunction", { foo: "bar" });
      expect(result).toEqual({ result: "ok" });
      expect(mockHttpsCallableFn).toHaveBeenCalledWith(expect.any(Object), "myFunction");
    });

    it("queues the call when a network error is thrown", async () => {
      mockCallable.mockRejectedValueOnce(makeNetworkError());
      const result = await service.call("submitGuess", { guess: "HELLO" });
      expect(result).toBeNull();
      expect(await service.queueSize()).toBe(1);
    });

    it("re-throws non-network errors", async () => {
      const authError = Object.assign(new Error("Permission denied"), {
        code: "permission-denied",
      });
      mockCallable.mockRejectedValueOnce(authError);
      await expect(service.call("submitGuess", {})).rejects.toThrow(
        "Permission denied"
      );
    });
  });

  // ── drain ─────────────────────────────────────────────────────────────────

  describe("drain", () => {
    it("replays queued calls successfully", async () => {
      await service.enqueue("submitGuess", { guess: "APPLE" });
      mockCallable.mockResolvedValueOnce({ data: {} });
      await service.drain();
      expect(await service.queueSize()).toBe(0);
      expect(mockCallable).toHaveBeenCalledTimes(1);
    });

    it("keeps items in queue when drain fails with network error", async () => {
      await service.enqueue("submitGuess", { guess: "APPLE" });
      mockCallable.mockRejectedValueOnce(makeNetworkError());
      await service.drain();
      expect(await service.queueSize()).toBe(1);
    });

    it("increments attempt count after each failed drain", async () => {
      await service.enqueue("submitGuess", { guess: "APPLE" });
      mockCallable.mockRejectedValue(makeNetworkError());
      await service.drain();
      const raw = await AsyncStorage.getItem("@offline_queue");
      const queue = JSON.parse(raw!);
      expect(queue[0].attempts).toBe(1);
    });

    it("discards a call after MAX_ATTEMPTS (5) failed drains", async () => {
      await service.enqueue("submitGuess", { guess: "APPLE" });
      mockCallable.mockRejectedValue(makeNetworkError());
      // Run drain 5 times to exhaust attempts
      for (let i = 0; i < 5; i++) {
        await service.drain();
      }
      // On 6th drain the item has attempts=5 and should be discarded
      await service.drain();
      expect(await service.queueSize()).toBe(0);
    });

    it("discards items older than 24 hours", async () => {
      await service.enqueue("oldCall", {});
      // Mutate the stored item to be 25 hours old
      const raw = await AsyncStorage.getItem("@offline_queue");
      const queue = JSON.parse(raw!);
      queue[0].enqueuedAt = Date.now() - 25 * 60 * 60 * 1000;
      await AsyncStorage.setItem("@offline_queue", JSON.stringify(queue));

      await service.drain();
      expect(await service.queueSize()).toBe(0);
      expect(mockCallable).not.toHaveBeenCalled();
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

    it("does not run concurrently (isDraining guard)", async () => {
      await service.enqueue("submitGuess", {});
      // Start two drains simultaneously
      const p1 = service.drain();
      const p2 = service.drain(); // should short-circuit
      await Promise.all([p1, p2]);
      // callable should only be called once
      expect(mockCallable).toHaveBeenCalledTimes(1);
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
        .mockReturnValue({ remove: mockRemove } as ReturnType<
          typeof AppState.addEventListener
        >);
      service.initialize();
      service.teardown();
      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
