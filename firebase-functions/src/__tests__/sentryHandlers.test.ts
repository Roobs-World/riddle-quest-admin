import {jest} from "@jest/globals";

/** Captures exceptions routed through the handler wrappers. */
const captureException = jest.fn();
/** Flushes queued events routed through the handler wrappers. */
const flushSentry = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);

jest.mock("../shared/sentry", () => ({captureException, flushSentry}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_options, handler) => ({run: handler})),
  onRequest: jest.fn((_options, handler) => handler),
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_options, handler) => ({run: handler})),
}));

import {onCallWithSentry, onRequestWithSentry, onScheduleWithSentry} from "../shared/sentryHandlers";

describe("Sentry Firebase handler wrappers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns successful callable results without reporting", async () => {
    const callable = onCallWithSentry("callable", {}, async (request: {data: {value: number}}) => request.data.value);
    await expect(callable.run({data: {value: 7}} as never)).resolves.toBe(7);
    expect(captureException).not.toHaveBeenCalled();
    expect(flushSentry).not.toHaveBeenCalled();
  });

  it("reports, flushes, and rethrows callable failures", async () => {
    const error = new Error("callable failed");
    const callable = onCallWithSentry("callable", {}, async () => { throw error; });
    await expect(callable.run({data: {}} as never)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledWith(error, {firebaseFunction: "callable"});
    expect(flushSentry).toHaveBeenCalledTimes(1);
  });

  it("wraps HTTP and scheduled handlers", async () => {
    const requestHandler = onRequestWithSentry("http", {}, async () => undefined);
    await expect(requestHandler({} as never, {} as never)).resolves.toBeUndefined();

    const error = new Error("schedule failed");
    const scheduled = onScheduleWithSentry("scheduler", {schedule: "0 0 * * *"}, async () => { throw error; });
    await expect(scheduled.run({} as never)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledWith(error, {firebaseFunction: "scheduler"});
    expect(flushSentry).toHaveBeenCalledTimes(1);
  });
});
