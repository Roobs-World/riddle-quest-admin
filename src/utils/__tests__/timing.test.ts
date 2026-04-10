/**
 * @fileoverview Unit tests for timing utility functions.
 *
 * Tests safeDelay and safeTimeout which use requestAnimationFrame
 * for thread-safe delays compatible with React Native Reanimated.
 */

import { safeDelay, safeTimeout } from "../timing";

// Mock requestAnimationFrame and performance.now for testing
const originalRAF = global.requestAnimationFrame;
const originalPerformanceNow = global.performance?.now;

describe("timing utilities", () => {
  let rafCallbacks: Array<() => void> = [];
  let currentTime = 0;

  beforeEach(() => {
    rafCallbacks = [];
    currentTime = 0;

    // Mock requestAnimationFrame to capture callbacks
    global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(() => callback(currentTime));
      return rafCallbacks.length;
    });

    // Mock performance.now
    global.performance = {
      ...global.performance,
      now: jest.fn(() => currentTime),
    } as Performance;
  });

  afterEach(() => {
    global.requestAnimationFrame = originalRAF;
    if (originalPerformanceNow) {
      global.performance.now = originalPerformanceNow;
    }
    jest.clearAllMocks();
  });

  // Helper to flush RAF callbacks and advance time
  const advanceTime = (ms: number) => {
    currentTime += ms;
    const callbacks = [...rafCallbacks];
    rafCallbacks = [];
    callbacks.forEach((cb) => cb());
  };

  describe("safeDelay", () => {
    it("should return a promise", () => {
      const result = safeDelay(100);
      expect(result).toBeInstanceOf(Promise);
    });

    it("should call requestAnimationFrame", () => {
      safeDelay(100);
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    it("should resolve after the specified delay", async () => {
      let resolved = false;
      const promise = safeDelay(100).then(() => {
        resolved = true;
      });

      // Should not be resolved yet
      expect(resolved).toBe(false);

      // Advance time past delay
      advanceTime(50);
      await Promise.resolve(); // Let microtasks run
      expect(resolved).toBe(false);

      advanceTime(60);
      await Promise.resolve();
      expect(resolved).toBe(true);

      await promise;
    });

    it("should handle 0ms delay", async () => {
      let resolved = false;
      const promise = safeDelay(0).then(() => {
        resolved = true;
      });

      // First RAF tick should resolve immediately since elapsed >= 0
      advanceTime(0);
      await Promise.resolve();
      expect(resolved).toBe(true);

      await promise;
    });

    it("should not resolve until time has elapsed", async () => {
      let resolved = false;
      safeDelay(500).then(() => {
        resolved = true;
      });

      // Advance less than delay
      advanceTime(100);
      await Promise.resolve();
      expect(resolved).toBe(false);

      advanceTime(100);
      await Promise.resolve();
      expect(resolved).toBe(false);
    });
  });

  describe("safeTimeout", () => {
    it("should return a cleanup function", () => {
      const cleanup = safeTimeout(jest.fn(), 100);
      expect(typeof cleanup).toBe("function");
    });

    it("should call requestAnimationFrame", () => {
      safeTimeout(jest.fn(), 100);
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    it("should execute callback after delay", () => {
      const callback = jest.fn();
      safeTimeout(callback, 100);

      // Callback should not be called yet
      expect(callback).not.toHaveBeenCalled();

      // Advance time past delay
      advanceTime(50);
      expect(callback).not.toHaveBeenCalled();

      advanceTime(60);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should not execute callback if cancelled before delay", () => {
      const callback = jest.fn();
      const cancel = safeTimeout(callback, 100);

      // Cancel before delay
      advanceTime(50);
      cancel();

      // Advance past delay
      advanceTime(100);
      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle immediate cancellation", () => {
      const callback = jest.fn();
      const cancel = safeTimeout(callback, 100);
      cancel();

      advanceTime(200);
      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle 0ms delay", () => {
      const callback = jest.fn();
      safeTimeout(callback, 0);

      advanceTime(0);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should only call callback once", () => {
      const callback = jest.fn();
      safeTimeout(callback, 50);

      advanceTime(50);
      expect(callback).toHaveBeenCalledTimes(1);

      // Further RAF cycles should not call again
      advanceTime(50);
      advanceTime(50);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should allow multiple independent timeouts", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      safeTimeout(callback1, 50);
      safeTimeout(callback2, 100);
      safeTimeout(callback3, 150);

      advanceTime(60);
      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      advanceTime(50);
      expect(callback2).toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      advanceTime(50);
      expect(callback3).toHaveBeenCalled();
    });

    it("should cancel only the intended timeout", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const cancel1 = safeTimeout(callback1, 100);
      safeTimeout(callback2, 100);

      cancel1();
      advanceTime(150);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
});
