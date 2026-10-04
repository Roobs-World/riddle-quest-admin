import {afterEach, beforeEach, expect, it, jest} from "@jest/globals";
import {PlayerSaveRecovery} from "../PlayerSaveRecovery";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("bounds persistent failure and allows another bounded episode after an online/resume signal", async () => {
  /** Observed retry calls establish bounded recovery behavior. */
  const retry = jest.fn<() => Promise<void>>().mockRejectedValue(new Error("offline"));
  /** One recovery owner spans the current view. */
  const recovery = new PlayerSaveRecovery(retry, () => true);
  recovery.attach();
  recovery.failed();
  await jest.advanceTimersByTimeAsync(999);
  expect(retry).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(retry).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(6000);
  expect(retry).toHaveBeenCalledTimes(3);
  await jest.advanceTimersByTimeAsync(60000);
  expect(retry).toHaveBeenCalledTimes(3);
  recovery.wake();
  await jest.advanceTimersByTimeAsync(6000);
  expect(retry).toHaveBeenCalledTimes(6);
  recovery.detach();
});

it("keeps offline or hidden failures pending without timers, then recovers on a real wake", async () => {
  /** Browser availability changes independently from failure state. */
  let available = false;
  /** Observed retry calls establish bounded recovery behavior. */
  const retry = jest.fn<() => Promise<void>>().mockImplementation(async () => recovery.recovered());
  /** One recovery owner spans the current view. */
  const recovery = new PlayerSaveRecovery(retry, () => available);
  recovery.attach();
  recovery.failed();
  await jest.advanceTimersByTimeAsync(60000);
  expect(retry).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  available = true;
  recovery.wake();
  await jest.advanceTimersByTimeAsync(0);
  expect(retry).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(60000);
  expect(retry).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  recovery.detach();
});

it("does not overlap retries when wake signals arrive during a held attempt", async () => {
  /** Releases the pending provider acknowledgement. */
  let release: () => void = () => undefined;
  /** Controlled acknowledgement keeps an entered save pending. */
  const held = new Promise<void>(resolve => {release = resolve;});
  /** Observed retry calls establish bounded recovery behavior. */
  const retry = jest.fn<() => Promise<void>>().mockReturnValue(held);
  /** One recovery owner spans the current view. */
  const recovery = new PlayerSaveRecovery(retry, () => true);
  recovery.attach();recovery.failed();
  await jest.advanceTimersByTimeAsync(1000);
  recovery.wake();recovery.wake();
  await jest.advanceTimersByTimeAsync(60000);
  expect(retry).toHaveBeenCalledTimes(1);
  recovery.recovered();release();
  await jest.advanceTimersByTimeAsync(60000);
  expect(retry).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  recovery.detach();
});

it("retires scheduled attempts and stale asynchronous failures when the view detaches", async () => {
  /** Rejects an entered retry after its lifetime ends. */
  let reject: (error: Error) => void = () => undefined;
  /** Controlled acknowledgement keeps an entered save pending. */
  const held = new Promise<void>((_, fail) => {reject = fail;});
  /** Observed retry calls establish bounded recovery behavior. */
  const retry = jest.fn<() => Promise<void>>().mockReturnValue(held);
  /** One recovery owner spans the current view. */
  const recovery = new PlayerSaveRecovery(retry, () => true);
  recovery.attach();recovery.failed();
  await jest.advanceTimersByTimeAsync(1000);
  recovery.detach();
  reject(new Error("retired failure"));
  await jest.advanceTimersByTimeAsync(60000);
  recovery.wake();
  await jest.advanceTimersByTimeAsync(60000);
  expect(retry).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("does not enter a scheduled operation after the browser becomes unavailable", async () => {
  /** Browser availability changes independently from failure state. */
  let available = true;
  /** Observed retry calls establish bounded recovery behavior. */
  const retry = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  /** One recovery owner spans the current view. */
  const recovery = new PlayerSaveRecovery(retry, () => available);
  recovery.attach();recovery.failed();available = false;
  await jest.advanceTimersByTimeAsync(1000);
  expect(retry).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  available = true;recovery.wake();
  await jest.advanceTimersByTimeAsync(0);
  expect(retry).toHaveBeenCalledTimes(1);
  recovery.detach();
});

it("stays quiet for transient failure and keeps manual recovery visible until acknowledged", async () => {
  /** Persistent provider rejection exhausts the automatic episode. */
  const retry = jest.fn<() => Promise<void>>().mockRejectedValue(new Error("flush failed"));
  /** Status observations use the same external-store interface as the live game view. */
  const recovery = new PlayerSaveRecovery(retry, () => true);
  /** Observer delivery must occur only when the visible status changes. */
  const statuses: string[] = [];
  /** View owns its observer lifetime. */
  const unsubscribe = recovery.subscribe(() => statuses.push(recovery.getSnapshot()));
  recovery.attach();recovery.failed();
  expect(recovery.getSnapshot()).toBe("quiet");
  await jest.advanceTimersByTimeAsync(7000);
  expect(recovery.getSnapshot()).toBe("unsaved");
  retry.mockImplementation(async () => recovery.recovered());
  recovery.wake();
  expect(recovery.getSnapshot()).toBe("saving");
  await jest.advanceTimersByTimeAsync(0);
  expect(recovery.getSnapshot()).toBe("quiet");
  recovery.recovered();
  expect(statuses).toEqual(["unsaved", "saving", "quiet"]);
  unsubscribe();recovery.detach();
});

it("exposes unavailable saves and clears visible health on retirement without leaking observer failures", async () => {
  /** Offline/hidden view does not attempt provider work. */
  const retry = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  /** Caller availability controls whether a retry can enter. */
  const recovery = new PlayerSaveRecovery(retry, () => false);
  /** A broken observer must not invalidate target acknowledgement or cleanup. */
  const unsubscribe = recovery.subscribe(() => {throw new Error("retired view");});
  recovery.attach();
  expect(() => recovery.failed()).not.toThrow();
  expect(recovery.getSnapshot()).toBe("unsaved");
  recovery.wake();
  expect(recovery.getSnapshot()).toBe("unsaved");
  await jest.advanceTimersByTimeAsync(60000);
  expect(retry).not.toHaveBeenCalled();
  expect(() => recovery.detach()).not.toThrow();
  expect(recovery.getSnapshot()).toBe("quiet");
  unsubscribe();
});
