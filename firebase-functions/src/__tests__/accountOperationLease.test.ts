/** Whether the permanent deletion guard exists in the current test. */
let deletionGuardExists = false;
/** Lease documents returned by the current deletion-drain query. */
let leaseDocuments: Array<{
  /** Stores ref. */
  ref: {
    /** Stores path. */
    path: string;
  };
  /** Provides data behavior. */
  data(): unknown;
}> = [];
/** Observable ordering across lease acquisition, work, and release. */
const events: string[] = [];
/** Creates the permanent deletion guard. */
const mockDeletionSet = jest.fn(async () => {
  events.push("guard");
});
/** Releases one active operation lease. */
const mockLeaseDelete = jest.fn(async () => {
  events.push("release");
});
/** Creates one active operation lease on the transactional fallback path. */
const mockTransactionCreate = jest.fn(() => {
  events.push("acquire");
});
/** Whether the next single-commit acquisition fails for a reason other than the guard. */
let batchCommitFailure: Error | null = null;
/** Records the writes staged by each single-commit acquisition. */
const mockBatchWrites = jest.fn();
/** Commits one staged acquisition, enforcing the `exists: false` guard precondition. */
const mockBatchCommit = jest.fn(async (writes: unknown[]) => {
  mockBatchWrites(writes);
  if (batchCommitFailure) throw batchCommitFailure;
  if (deletionGuardExists) throw Object.assign(new Error("FAILED_PRECONDITION"), {code: 9});
  events.push("acquire");
});

/** Permanent guard document used by the Firestore mock. */
const deletionRef = {
  path: "jestAccountDeletionTombstones/provider-user",
  set: mockDeletionSet,
  collection: () => ({
    doc: () => ({
      path: "jestAccountDeletionTombstones/provider-user/activeOperations/lease",
      delete: mockLeaseDelete,
    }),
    limit: () => ({
      get: async () => ({
        empty: leaseDocuments.length === 0,
        docs: leaseDocuments,
      }),
    }),
  }),
};

/** Firestore surface used by the deletion guard and operation lease. */
const firestore = Object.assign(
  () => ({
    collection: () => ({doc: () => deletionRef}),
    batch: () => {
      /** Writes staged on this batch. */
      const writes: unknown[] = [];
      /** Chainable batch surface. */
      const batch = {
        /** Stages a precondition-guarded delete. */
        delete: (ref: {
          /** Stores path. */
          path: string;
        }, precondition: unknown) => {
          writes.push(["delete", ref.path, precondition]);
          return batch;
        },
        /** Stages a lease creation. */
        create: (ref: {
          /** Stores path. */
          path: string;
        }, data: unknown) => {
          writes.push(["create", ref.path, data]);
          return batch;
        },
        /** Commits the staged writes atomically. */
        commit: () => mockBatchCommit(writes),
      };
      return batch;
    },
    runTransaction: async (operation: (transaction: unknown) => Promise<unknown>) =>
      operation({
        get: async () => ({exists: deletionGuardExists}),
        set: mockTransactionCreate,
      }),
  }),
  {FieldValue: {serverTimestamp: () => "server-timestamp"}},
);

jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore}}));

import {recordAccountDeletion} from "../shared/accountDeletion";
import {AccountDeletedError, AccountDeletionBusyError, runWithAccountOperationLease} from "../shared/accountDeletion";

describe("Account operation lease", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deletionGuardExists = false;
    batchCommitFailure = null;
    leaseDocuments = [];
    events.length = 0;
  });

  it("acquires before authenticated work and always releases afterward", async () => {
    await expect(
      runWithAccountOperationLease("provider-user", 60, async () => {
        events.push("operation");
        return "result";
      }),
    ).resolves.toBe("result");

    expect(events).toEqual(["acquire", "operation", "release"]);
    expect(mockBatchWrites).toHaveBeenCalledWith([
      ["delete", "jestAccountDeletionTombstones/provider-user", {exists: false}],
      ["create", expect.stringContaining("/activeOperations/"), {expiresAt: expect.any(Date)}],
    ]);
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });

  it("falls back to the authoritative transaction after an ambiguous single commit", async () => {
    batchCommitFailure = new Error("DEADLINE_EXCEEDED");

    await expect(runWithAccountOperationLease("provider-user", 60, async () => {
      events.push("operation");
      return "result";
    })).resolves.toBe("result");

    expect(events).toEqual(["acquire", "operation", "release"]);
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({path: expect.stringContaining("/activeOperations/")}),
      {expiresAt: expect.any(Date)},
    );
  });

  it("does not start work after the permanent deletion guard exists", async () => {
    deletionGuardExists = true;
    /** Provides operation behavior. */
    const operation = jest.fn();

    await expect(runWithAccountOperationLease("provider-user", 60, operation)).rejects.toBeInstanceOf(
      AccountDeletedError,
    );
    expect(operation).not.toHaveBeenCalled();
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });

  it("writes the guard first and refuses to sweep while an older lease is active", async () => {
    /** Provides deterministic jest uid behavior. */
    const deterministicProviderUid = `facebook_${"a".repeat(40)}`;
    leaseDocuments = [
      {
        ref: {path: "active-lease"},
        data: () => ({expiresAt: new Date(Date.now() + 60_000)}),
      },
    ];

    await expect(recordAccountDeletion(deterministicProviderUid)).rejects.toBeInstanceOf(AccountDeletionBusyError);
    expect(mockDeletionSet).toHaveBeenCalledWith(
      {
        schemaVersion: 1,
        recreationBlocked: true,
        deletedAt: "server-timestamp",
      },
      {merge: true},
    );
    expect(events).toEqual(["guard"]);
  });

  it.each([
    ["past its diagnostic deadline", {expiresAt: new Date(Date.now() - 1)}],
    ["malformed", {}],
  ])("keeps legacy deletion fail-closed when a remaining lease is %s", async (_label, leaseData) => {
    leaseDocuments = [
      {
        ref: {path: "orphaned-lease"},
        data: () => leaseData,
      },
    ];

    await expect(recordAccountDeletion("legacy-firebase-user")).rejects.toBeInstanceOf(
      AccountDeletionBusyError,
    );
    expect(mockDeletionSet).toHaveBeenCalledTimes(1);
  });
});
