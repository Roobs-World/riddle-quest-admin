import {jest} from "@jest/globals";

/** Captures exceptions routed through the handler wrappers. */
const captureException = jest.fn();
/** Flushes queued events routed through the handler wrappers. */
const flushSentry = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
/** Account-operation lease used by authenticated Jest callable tests. */
const runWithJestAccountOperationLease = jest.fn(async (
  _userId: string,
  _timeoutSeconds: number,
  operation: () => Promise<unknown>,
) => operation());

jest.mock("../shared/sentry", () => ({captureException, flushSentry}));
jest.mock("../jest/jestAccountDeletion", () => ({
  isJestAccountDeletedError: (error: unknown) => error instanceof Error && error.message === "account-deleted",
  runWithJestAccountOperationLease,
}));

jest.mock("firebase-functions/v2/https", () => ({
  ...jest.requireActual("firebase-functions/v2/https"),
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
    expect(runWithJestAccountOperationLease).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
    expect(flushSentry).not.toHaveBeenCalled();
  });

  it("serializes an authenticated legacy Firebase callable by UID", async () => {
    const callable = onCallWithSentry("callable", {}, async () => "done");
    await expect(callable.run({auth: {uid: "firebase-uid"}, data: {}} as never)).resolves.toBe("done");
    expect(runWithJestAccountOperationLease).toHaveBeenCalledWith("firebase-uid", 60, expect.any(Function));
  });

  it("serializes every authenticated Jest callable with account deletion", async () => {
    const callable = onCallWithSentry("callable", {timeoutSeconds: 45}, async () => "done");
    await expect(callable.run({
      auth: {uid: "jest-uid", token: {jestPlayerId: "jest-player"}},
      data: {},
    } as never)).resolves.toBe("done");
    expect(runWithJestAccountOperationLease).toHaveBeenCalledWith(
      "jest-uid",
      45,
      expect.any(Function),
    );
  });

  it("serializes deterministic Jest UIDs even when an older token lacks the Jest claim", async () => {
    const uid = `jest_${"a".repeat(40)}`;
    const callable = onCallWithSentry("callable", {}, async () => "done");
    await expect(callable.run({auth: {uid}, data: {}} as never)).resolves.toBe("done");
    expect(runWithJestAccountOperationLease).toHaveBeenCalledWith(uid, 60, expect.any(Function));
  });

  it("keeps account deletion outside the shared operation lease", async () => {
    const uid = `jest_${"b".repeat(40)}`;
    const callable = onCallWithSentry(
      "deleteAccount",
      {},
      async () => "deleted",
      {skipJestAccountOperationLease: true},
    );
    await expect(callable.run({auth: {uid}, data: {}} as never)).resolves.toBe("deleted");
    expect(runWithJestAccountOperationLease).not.toHaveBeenCalled();
  });

  it("maps a permanent Jest deletion guard to a stable callable error", async () => {
    runWithJestAccountOperationLease.mockRejectedValueOnce(new Error("account-deleted"));
    const callable = onCallWithSentry("callable", {}, async () => "unreachable");
    await expect(callable.run({
      auth: {uid: "jest-uid", token: {jestPlayerId: "jest-player"}},
      data: {},
    } as never)).rejects.toMatchObject({code: "failed-precondition"});
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
