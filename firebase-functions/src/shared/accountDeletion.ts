import {randomUUID} from "node:crypto";
import type {DocumentSnapshot, Firestore} from "firebase-admin/firestore";
import {admin} from "../shared/firebaseAdmin";
import {BROWSER_CALLABLE_TIMEOUT_SECONDS} from "../shared/callableSecurity";

/** Permanent, pseudonymous guard records for deleted game identities. */
export const JEST_ACCOUNT_DELETION_COLLECTION = "jestAccountDeletionTombstones";
/** Ephemeral leases that serialize authenticated mutations with deletion. */
export const JEST_ACCOUNT_OPERATION_COLLECTION = "activeOperations";
/** Diagnostic margin beyond the callable's expected runtime limit. */
const JEST_ACCOUNT_OPERATION_LEASE_MARGIN_MS = 30_000;

/** Expected error used to stop a deleted platform identity from being recreated. */
export class JestAccountDeletedError extends Error {
  /** Creates one deleted-account boundary error. */
  constructor() {
    super("account-deleted");
    this.name = "JestAccountDeletedError";
  }
}

/** Expected retryable error while an older authenticated operation drains. */
export class JestAccountDeletionBusyError extends Error {
  /** Creates one deletion-in-progress boundary error. */
  constructor() {
    super("account-deletion-in-progress");
    this.name = "JestAccountDeletionBusyError";
  }
}

/** Resolves the permanent deletion guard for one Firebase UID. */
export const getJestAccountDeletionRef = (db: Firestore, userId: string) =>
  db.collection(JEST_ACCOUNT_DELETION_COLLECTION).doc(userId);

/**
 * Creates an operation lease atomically with the permanent deletion guard check.
 *
 * A deletion that commits first makes this transaction retry and fail. A lease
 * that commits first is observed after the deletion guard is written, so the
 * destructive sweep waits for the older operation to drain.
 */
export async function runWithJestAccountOperationLease<Result>(
  userId: string,
  timeoutSeconds: number,
  operation: () => Result | Promise<Result>,
  db: Firestore = admin.firestore(),
): Promise<Result> {
  /** Provides deletion ref behavior. */
  const deletionRef = getJestAccountDeletionRef(db, userId);
  /** Provides lease ref behavior. */
  const leaseRef = deletionRef.collection(JEST_ACCOUNT_OPERATION_COLLECTION).doc(randomUUID());
  /** Provides bounded timeout seconds behavior. */
  const boundedTimeoutSeconds =
    Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? timeoutSeconds : BROWSER_CALLABLE_TIMEOUT_SECONDS;
  /** Diagnostic deadline recorded on the lease. */
  const lease = {
    expiresAt: new Date(Date.now() + boundedTimeoutSeconds * 1_000 + JEST_ACCOUNT_OPERATION_LEASE_MARGIN_MS),
  };
  try {
    // One atomic commit instead of a read-then-commit transaction: the
    // `exists: false` no-op delete fails the whole batch once the deletion
    // guard exists, giving the same linearization with one fewer round trip.
    await db.batch().delete(deletionRef, {exists: false}).create(leaseRef, lease).commit();
  } catch {
    // Any failure, including an ambiguous commit, takes the authoritative
    // path. `set` keeps a lease the lost commit may already have written
    // idempotent instead of orphaning it.
    await db.runTransaction(async (transaction) => {
      /** Provides deletion snapshot behavior. */
      const deletionSnapshot = await transaction.get(deletionRef);
      assertJestAccountActive(deletionSnapshot);
      transaction.set(leaseRef, lease);
    });
  }
  try {
    return await operation();
  } finally {
    // A failed release intentionally leaves a fail-closed lease. A callable's
    // expected deadline is not proof that its Cloud Run execution stopped.
    await leaseRef.delete().catch(() => undefined);
  }
}

/** Refuses deletion while any authenticated Jest operation could still write. */
export async function assertNoActiveJestAccountOperations(deletionRef: ReturnType<typeof getJestAccountDeletionRef>) {
  /** Provides snapshot behavior. */
  const snapshot = await deletionRef.collection(JEST_ACCOUNT_OPERATION_COLLECTION).limit(1).get();
  if (!snapshot.empty) throw new JestAccountDeletionBusyError();
}

/** Throws when a transaction observed a permanent deletion guard. */
export function assertJestAccountActive(snapshot: Pick<DocumentSnapshot, "exists">): void {
  if (snapshot.exists) throw new JestAccountDeletedError();
}

/** Identifies the expected deleted-account error without exposing other failures. */
export const isJestAccountDeletedError = (error: unknown): error is JestAccountDeletedError =>
  error instanceof JestAccountDeletedError || (error instanceof Error && error.message === "account-deleted");

/** Identifies the expected retryable operation-drain condition. */
export const isJestAccountDeletionBusyError = (error: unknown): error is JestAccountDeletionBusyError =>
  error instanceof JestAccountDeletionBusyError ||
  (error instanceof Error && error.message === "account-deletion-in-progress");

/** Emits the stable browser response for a valid signed identity that was deleted. */
export function respondToDeletedJestAccount(
  error: unknown,
  response: {
    /** Provides status behavior. */
    status(code: number): {
      /** Provides json behavior. */
      json(body: unknown): unknown;
    };
  },
): boolean {
  if (!isJestAccountDeletedError(error)) return false;
  response.status(409).json({error: "account-deleted"});
  return true;
}
