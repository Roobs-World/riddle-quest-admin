import {readProtectedContent} from "@qwordly/core/contentProtection";
import {jest} from "@jest/globals";

/** Captures exceptions routed through the handler wrappers. */
const captureException = jest.fn();
/** Flushes queued events routed through the handler wrappers. */
const flushSentry = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
/** Account-operation lease used by authenticated Jest callable tests. */
const runWithJestAccountOperationLease = jest.fn(
  async (_userId: string, _timeoutSeconds: number, operation: () => Promise<unknown>) => operation(),
);

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
    /** Provides callable behavior. */
    const callable = onCallWithSentry(
      "callable",
      {},
      async (request: {
        /** Stores data. */
        data: {
          /** Stores value. */
          value: number;
        };
      }) => request.data.value,
    );
    await expect(callable.run({data: {value: 7}} as never)).resolves.toBe(7);
    expect(runWithJestAccountOperationLease).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
    expect(flushSentry).not.toHaveBeenCalled();
  });

  it("strips encryption negotiation before validation and protects answers and hints after authority execution", async () => {
    /** Strict domain handler observes no transport fields. */
    const handler = jest.fn(async (request: {
      /** Original domain request. */ data: unknown;
    }) => {
      expect(request.data).toEqual({riddleId: "one"});
      return {evaluation: {answer: "piano", locale: "en"}, hint: {index: 0, letter: "p"}};
    });
    /** Actual protected callable boundary. */
    const callable = onCallWithSentry("getHint", {}, handler);
    /** Response sent over either provider transport. */
    const result = await callable.run({auth: {uid: "owner"}, data: {riddleId: "one", contentProtection: 1}} as never);
    expect(JSON.stringify(result)).not.toContain("piano");
    expect(await readProtectedContent(result)).toEqual({evaluation: {answer: "piano", locale: "en"}, hint: {index: 0, letter: "p"}});
    expect(handler).toHaveBeenCalledTimes(1);
    expect(runWithJestAccountOperationLease).toHaveBeenCalledWith("owner", 60, expect.any(Function));
  });

  it("skips the mutation lease only for an explicitly declared read-only stream", async () => {
    /** Provides callable behavior. */
    const callable = onCallWithSentry("observer", {}, async () => "done", {
      skipJestAccountOperationLease: request => request.acceptsStreaming === true,
    });
    await callable.run({auth: {uid: "owner"}, data: {}, acceptsStreaming: true} as never);
    expect(runWithJestAccountOperationLease).not.toHaveBeenCalled();
    await callable.run({auth: {uid: "owner"}, data: {}, acceptsStreaming: false} as never);
    expect(runWithJestAccountOperationLease).toHaveBeenCalledTimes(1);
  });

  it("serializes an authenticated legacy Firebase callable by UID", async () => {
    /** Provides callable behavior. */
    const callable = onCallWithSentry("callable", {}, async () => "done");
    await expect(callable.run({auth: {uid: "firebase-uid"}, data: {}} as never)).resolves.toBe("done");
    expect(runWithJestAccountOperationLease).toHaveBeenCalledWith("firebase-uid", 60, expect.any(Function));
  });

  it("serializes every authenticated Jest callable with account deletion", async () => {
    /** Provides callable behavior. */
    const callable = onCallWithSentry("callable", {timeoutSeconds: 45}, async () => "done");
    await expect(
      callable.run({
        auth: {uid: "jest-uid", token: {jestPlayerId: "jest-player"}},
        data: {},
      } as never),
    ).resolves.toBe("done");
    expect(runWithJestAccountOperationLease).toHaveBeenCalledWith("jest-uid", 45, expect.any(Function));
  });

  it("serializes deterministic Jest UIDs even when an older token lacks the Jest claim", async () => {
    /** Provides uid behavior. */
    const uid = `jest_${"a".repeat(40)}`;
    /** Provides callable behavior. */
    const callable = onCallWithSentry("callable", {}, async () => "done");
    await expect(callable.run({auth: {uid}, data: {}} as never)).resolves.toBe("done");
    expect(runWithJestAccountOperationLease).toHaveBeenCalledWith(uid, 60, expect.any(Function));
  });

  it("keeps account deletion outside the shared operation lease", async () => {
    /** Provides uid behavior. */
    const uid = `jest_${"b".repeat(40)}`;
    /** Provides callable behavior. */
    const callable = onCallWithSentry("deleteAccount", {}, async () => "deleted", {
      skipJestAccountOperationLease: true,
    });
    await expect(callable.run({auth: {uid}, data: {}} as never)).resolves.toBe("deleted");
    expect(runWithJestAccountOperationLease).not.toHaveBeenCalled();
  });

  it("maps a permanent Jest deletion guard to a stable callable error", async () => {
    runWithJestAccountOperationLease.mockRejectedValueOnce(new Error("account-deleted"));
    /** Provides callable behavior. */
    const callable = onCallWithSentry("callable", {}, async () => "unreachable");
    await expect(
      callable.run({
        auth: {uid: "jest-uid", token: {jestPlayerId: "jest-player"}},
        data: {},
      } as never),
    ).rejects.toMatchObject({code: "failed-precondition"});
  });

  it("reports, flushes, and rethrows callable failures", async () => {
    /** Provides error behavior. */
    const error = new Error("callable failed");
    /** Provides callable behavior. */
    const callable = onCallWithSentry("callable", {}, async () => {
      throw error;
    });
    await expect(callable.run({data: {}} as never)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledWith(error, {firebaseFunction: "callable"});
    expect(flushSentry).toHaveBeenCalledTimes(1);
  });

  it("wraps HTTP and scheduled handlers", async () => {
    /** Requests handler. */
    const requestHandler = onRequestWithSentry("http", {}, async () => undefined);
    await expect(requestHandler({} as never, {} as never)).resolves.toBeUndefined();

    /** Provides error behavior. */
    const error = new Error("schedule failed");
    /** Provides scheduled behavior. */
    const scheduled = onScheduleWithSentry("scheduler", {schedule: "0 0 * * *"}, async () => {
      throw error;
    });
    await expect(scheduled.run({} as never)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledWith(error, {firebaseFunction: "scheduler"});
    expect(flushSentry).toHaveBeenCalledTimes(1);
  });
});
