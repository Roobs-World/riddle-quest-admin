import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {ACCOUNT_OPERATION_COLLECTION, AccountDeletedError, getAccountDeletionRef, runWithAccountOperationLease} from "../shared/accountDeletion";

/** Firestore emulator handle. */
let db: FirebaseFirestore.Firestore;

beforeAll(() => {
  if (getApps().length === 0) initializeApp({projectId: process.env.GCLOUD_PROJECT ?? "demo-riddle-quest-e2e"});
  db = getFirestore();
});

afterEach(async () => {
  await db.recursiveDelete(db.collection("jestAccountDeletionTombstones"));
});

it("holds a real lease during work and never creates the deletion guard", async () => {
  /** Guard for this player. */
  const deletionRef = getAccountDeletionRef(db, "lease-active-user");
  /** Proves the single-commit path succeeded without the transactional fallback. */
  const transaction = jest.spyOn(db, "runTransaction");
  /** Leases observed while the operation ran. */
  const during = await runWithAccountOperationLease("lease-active-user", 60, async () =>
    (await deletionRef.collection(ACCOUNT_OPERATION_COLLECTION).get()).size, db);

  expect(during).toBe(1);
  expect(transaction).not.toHaveBeenCalled();
  transaction.mockRestore();
  expect((await deletionRef.get()).exists).toBe(false);
  expect((await deletionRef.collection(ACCOUNT_OPERATION_COLLECTION).get()).size).toBe(0);
});

it("refuses work and writes no lease once the deletion guard exists", async () => {
  /** Guard for this player. */
  const deletionRef = getAccountDeletionRef(db, "lease-deleted-user");
  await deletionRef.set({recreationBlocked: true});
  /** Work that must never run. */
  const operation = jest.fn();

  await expect(runWithAccountOperationLease("lease-deleted-user", 60, operation, db))
    .rejects.toBeInstanceOf(AccountDeletedError);
  expect(operation).not.toHaveBeenCalled();
  expect((await deletionRef.collection(ACCOUNT_OPERATION_COLLECTION).get()).size).toBe(0);
  expect((await deletionRef.get()).data()).toEqual({recreationBlocked: true});
});
