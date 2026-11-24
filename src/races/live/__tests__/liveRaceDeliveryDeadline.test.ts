import {liveRaceDeliveryDeadline, liveRaceCommandRejected, LiveRaceDeliveryTimeout, LIVE_RACE_POLL_DEADLINE_MS, LIVE_RACE_SEARCH_DEADLINE_MS, LIVE_RACE_COMMAND_DEADLINE_MS} from "../liveRaceDeliveryDeadline";

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
  it("allows a searching observation past the racing deadline and bounds its recovery wait", async () => {
    /** The authoritative search can remain pending beyond the racing observation budget. */
    const request = deferred();
    /** Searching explicitly selects the longer polling budget. */
    const delivery = liveRaceDeliveryDeadline(request.promise, true, undefined, undefined, undefined, LIVE_RACE_SEARCH_DEADLINE_MS);
    /** Public promise settlement remains pending until the selected search deadline. */
    let outcome = "pending";
    void delivery.then(() => {outcome = "accepted";}, () => {outcome = "expired";});
    /** Timeout classification is observable before recovery begins another delivery. */
    const expired = expect(delivery).rejects.toThrow(LiveRaceDeliveryTimeout);
    await jest.advanceTimersByTimeAsync(2_000);
    expect(outcome).toBe("pending");
    await jest.advanceTimersByTimeAsync(7_999);
    expect(outcome).toBe("pending");
    await jest.advanceTimersByTimeAsync(1);
    await expired;
    expect(outcome).toBe("expired");
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

it("releases a retired local wait immediately without cancelling its adapter", async () => {
  jest.useFakeTimers();
  try {
    /** The original SDK can still deliver after its local owner retires. */
    const request = deferred(), owner = new AbortController(), late = jest.fn();
    /** Cancellation is observed before retiring the local wait. */
    const delivery = liveRaceDeliveryDeadline(request.promise, false, late, owner.signal);
    /** Only presentation delivery is cancelled, not the server mutation. */
    const cancelled = expect(delivery).rejects.toThrow("cancelled");
    owner.abort(); await cancelled;
    expect(jest.getTimerCount()).toBe(0);
    request.resolve("late-authority"); await Promise.resolve();
    expect(late).toHaveBeenCalledWith("late-authority");
    await expect(delivery).rejects.toThrow("cancelled");
  } finally {jest.useRealTimers();}
});
it("observes an adapter failure after local cancellation", async () => {
  jest.useFakeTimers();
  try {
    /** Retired wait still owns an error handler for its original SDK promise. */
    const request = deferred(), owner = new AbortController();
    /** Delivery rejection retains cancellation independently of a later network failure. */
    const delivery = liveRaceDeliveryDeadline(request.promise, false, undefined, owner.signal);
    /** Observe cancellation before triggering the ownership transition. */
    const cancelled = expect(delivery).rejects.toThrow("cancelled");
    owner.abort(); await cancelled;
    request.reject(new Error("late network failure")); await Promise.resolve();
    expect(jest.getTimerCount()).toBe(0);
    await expect(delivery).rejects.toThrow("cancelled");
  } finally {jest.useRealTimers();}
});
it("does not allocate a deadline for an already retired wait", async () => {
  jest.useFakeTimers();
  try {
    /** Owner was disposed before the selected adapter promise reached this boundary. */
    const owner = new AbortController(); owner.abort();
    await expect(liveRaceDeliveryDeadline(Promise.reject(new Error("late failure")), false, undefined, owner.signal)).rejects.toThrow("cancelled");
    expect(jest.getTimerCount()).toBe(0);
  } finally {jest.useRealTimers();}
});
it("removes cancellation listeners after timely acceptance", async () => {
  /** Listener cleanup prevents an accepted result retaining its abandoned owner. */
  const owner = new AbortController(), removed = jest.spyOn(owner.signal, "removeEventListener"), late = jest.fn();
  /** Timely delivery remains accepted even when the old owner later aborts. */
  const delivery = liveRaceDeliveryDeadline(Promise.resolve("accepted"), false, late, owner.signal);
  await expect(delivery).resolves.toBe("accepted");
  expect(removed).toHaveBeenCalledWith("abort", expect.any(Function));
  owner.abort(); await expect(delivery).resolves.toBe("accepted"); expect(late).not.toHaveBeenCalled();
});
it("removes cancellation listeners after deadline expiry", async () => {
  jest.useFakeTimers();
  try {
    /** Expired owners do not retain abort listeners while an adapter stays unavailable. */
    const owner = new AbortController(), removed = jest.spyOn(owner.signal, "removeEventListener");
    /** The pending adapter remains separate from local deadline ownership. */
    const delivery = liveRaceDeliveryDeadline(new Promise(() => {}), false, undefined, owner.signal);
    /** Observe expiry before advancing the deterministic command deadline. */
    const expired = expect(delivery).rejects.toThrow("timed out");
    await jest.advanceTimersByTimeAsync(LIVE_RACE_COMMAND_DEADLINE_MS); await expired;
    expect(jest.getTimerCount()).toBe(0); expect(removed).toHaveBeenCalledWith("abort", expect.any(Function));
    owner.abort(); await expect(delivery).rejects.toThrow("timed out");
  } finally {jest.useRealTimers();}
});
