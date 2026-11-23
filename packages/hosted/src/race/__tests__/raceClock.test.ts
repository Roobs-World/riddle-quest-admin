import {afterEach, describe, expect, it, jest} from "@jest/globals";
import {createRaceClock} from "../raceClock";

afterEach(() => jest.useRealTimers());

describe("portable race timers", () => {
  it("cancels only the owned handle and releases it before a reentrant callback", () => {
    jest.useFakeTimers();
    /** Native-compatible clock uses timer handles without a window object. */
    const clock = createRaceClock();
    /** Observable transitions have the same order in browser and native adapters. */
    const events: string[] = [];
    /** Cancelled ownership cannot affect a replacement timer. */
    const cancelled = clock.schedule(() => events.push("cancelled"), 5);
    clock.cancel(cancelled);
    /** The first callback can safely schedule the next transition. */
    const active = clock.schedule(() => {events.push("first"); clock.schedule(() => events.push("next"), 5);}, 5);
    expect(active).not.toBe(cancelled);
    jest.advanceTimersByTime(5);
    clock.cancel(active); clock.cancel(cancelled);
    jest.advanceTimersByTime(5);
    expect(events).toEqual(["first", "next"]);
    expect(Number.isFinite(clock.now())).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
