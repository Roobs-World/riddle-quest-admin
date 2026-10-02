import {liveRaceDeliveryDeadline, liveRaceCommandRejected, LIVE_RACE_POLL_DEADLINE_MS, LIVE_RACE_COMMAND_DEADLINE_MS} from "../logic/liveRaceDeliveryDeadline";

/** Deferred adapter exposes transport settlement independently of browser deadlines. */
const deferred = () => {
  /** Resolves the original request after the timeout or accepted response. */
  let resolve!: (value: string) => void;
  /** Rejects the original request after an adapter failure. */
  let reject!: (error: Error) => void;
  /** Original adapter delivery remains live after a presentation timeout. */
  const promise = new Promise<string>((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
};

describe("live PvP delivery deadlines", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it.each([true, false])("releases a never-settling transport (poll=%s)", async poll => {
    /** Timeout observation attaches before advancing the fake clock. */
    const result = expect(liveRaceDeliveryDeadline(new Promise<string>(() => {}), poll)).rejects.toThrow("timed out");
    await jest.advanceTimersByTimeAsync(poll ? LIVE_RACE_POLL_DEADLINE_MS : LIVE_RACE_COMMAND_DEADLINE_MS);
    await result;
    expect(jest.getTimerCount()).toBe(0);
  });
  it("accepts a timely response and removes its deadline", async () => {
    /** Controlled timely adapter response. */
    const request = deferred();
    /** Accepted delivery result follows its original transport. */
    const result = liveRaceDeliveryDeadline(request.promise, false);
    request.resolve("accepted");
    await expect(result).resolves.toBe("accepted");
    expect(jest.getTimerCount()).toBe(0);
  });
  it("keeps a late receipt out of accepted state and permits cleanup", async () => {
    /** Original request can establish a seat after local timeout. */
    const request = deferred();
    /** Late cleanup is separate from acceptance and cannot revive the wait. */
    const cleanup = jest.fn(() => {throw new Error("cleanup failed");});
    /** Timed-out wait never resolves with the late receipt. */
    const result = liveRaceDeliveryDeadline(request.promise, false, cleanup);
    /** Rejection observation prevents an unhandled timeout. */
    const rejected = expect(result).rejects.toThrow("timed out");
    await jest.advanceTimersByTimeAsync(LIVE_RACE_COMMAND_DEADLINE_MS);
    await rejected;
    request.resolve("late");
    await Promise.resolve();
    expect(cleanup).toHaveBeenCalledWith("late");
    await expect(result).rejects.toThrow("timed out");
  });
  it("observes a late adapter rejection without reviving the expired wait", async () => {
    /** Adapter rejection can arrive after the polling budget. */
    const request = deferred();
    /** Original timeout remains the delivery result. */
    const result = liveRaceDeliveryDeadline(request.promise, true);
    /** Observe timeout before advancing browser time. */
    const rejected = expect(result).rejects.toThrow("timed out");
    await jest.advanceTimersByTimeAsync(LIVE_RACE_POLL_DEADLINE_MS);
    await rejected;
    request.reject(new Error("late network error"));
    await Promise.resolve();
    await expect(result).rejects.toThrow("timed out");
    expect(jest.getTimerCount()).toBe(0);
  });
});

it.each(["failed-precondition", "functions/failed-precondition", "invalid-argument", "functions/invalid-argument"])("reconciles a definitive %s rejection", code => {
  expect(liveRaceCommandRejected({code})).toBe(true);
});
it.each([null, {}, {code: 409}, {code: "unavailable"}, {code: "functions/deadline-exceeded"}, {code: "resource-exhausted"}, {code: "permission-denied"}])("retains uncertain or unavailable commands: %p", error => {
  expect(liveRaceCommandRejected(error)).toBe(false);
});
