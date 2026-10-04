import {describe, expect, it, jest} from "@jest/globals";
import {createFacebookLifecycle} from "../createFacebookLifecycle";
import type {FacebookInstantSdk} from "../fbinstant";

describe("Facebook lifecycle fanout", () => {
  it("shares one native registration without dropping pause drains or presence resumes", async () => {
    /** Captured native callbacks emulate one-registration provider implementations. */
    let pause!: () => void, resume!: () => void;
    /** Records the sole native pause registration. */
    const onPause = jest.fn((callback: () => void) => {pause = callback;});
    /** Records the sole native resume registration. */
    const onResume = jest.fn((callback: () => void) => {resume = callback;});
    /** Actual fanout adapter connects independent view consumers. */
    const lifecycle = createFacebookLifecycle({onPause, onResume} as FacebookInstantSdk);
    /** Independent consumers count their own lifecycle deliveries. */
    const drain = jest.fn(), savePause = jest.fn(), presence = jest.fn(), recovery = jest.fn();
    /** Only this consumer is removed by its unsubscribe callback. */
    const stopDrain = lifecycle.onPause(drain);
    lifecycle.onPause(savePause);
    lifecycle.onResume!(presence);
    /** Storage cleanup cannot unsubscribe presence. */
    const stopRecovery = lifecycle.onResume!(recovery);
    pause(); resume();
    expect([onPause.mock.calls.length, onResume.mock.calls.length]).toEqual([1, 1]);
    expect([drain.mock.calls.length, savePause.mock.calls.length, presence.mock.calls.length, recovery.mock.calls.length]).toEqual([1, 1, 1, 1]);
    stopDrain(); stopRecovery(); pause(); resume();
    expect([drain.mock.calls.length, savePause.mock.calls.length, presence.mock.calls.length, recovery.mock.calls.length]).toEqual([1, 2, 2, 1]);
  });

  it("isolates synchronous and asynchronous listener failures", async () => {
    /** Captured native callbacks emulate one-registration provider implementations. */
    let pause!: () => void;
    /** Actual fanout adapter connects independent view consumers. */
    const lifecycle = createFacebookLifecycle({onPause: callback => {pause = callback;}} as FacebookInstantSdk);
    lifecycle.onPause(() => {throw new Error("failed-consumer");});
    lifecycle.onPause(async () => {throw new Error("rejected-consumer");});
    /** Newest accepted write stays in flight ahead of automatic retry. */
    const healthy = jest.fn();
    lifecycle.onPause(healthy);
    expect(() => pause()).not.toThrow();
    await Promise.resolve();
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
