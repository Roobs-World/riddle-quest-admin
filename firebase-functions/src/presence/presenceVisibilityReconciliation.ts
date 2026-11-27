import type {Database} from "firebase-admin/database";
import type {Firestore} from "firebase-admin/firestore";
import {getAccountDeletionRef, ACCOUNT_OPERATION_COLLECTION} from "../shared/accountDeletion";
import {refreshPresenceVisibility} from "./presenceVisibility";

/** Explicit operator inventory identifies scope, never authorization. */
export interface PresenceVisibilityPair {
  /** Existing opaque viewer identity. */
  viewerUserId: string;
  /** Existing opaque target identity. */
  targetUserId: string;
}

/** Counts contain no player identifiers or presence states. */
export interface PresenceVisibilityReconciliationResult {
  /** Number of entries whose reconciliation completed. */
  processed: number;
  /** Entries whose current legacy permission was observed. */
  legacy: number;
  /** Entries already carrying an ordered permission. */
  versioned: number;
  /** Inventory entries whose current permission is absent. */
  missing: number;
  /** Unexpected current storage records require investigation. */
  invalid: number;
  /** Permissions recomputed through the production mirror. */
  refreshed: number;
  /** Stale permission/index pairs removed for permanently deleted owners. */
  deletedOwnerEdgesRemoved: number;
  /** A deleted owner's earlier operation is still draining. */
  busy: boolean;
}

/** Validates the entire bounded page before any storage operation. */
export function validatePresenceVisibilityPairs(pairs: unknown): asserts pairs is PresenceVisibilityPair[] {
  if (!Array.isArray(pairs) || pairs.length > 20) throw new Error("invalid-presence-reconciliation-page");
  /** Duplicate inventory edges have no additional meaning. */
  const seen = new Set<string>();
  for (const pair of pairs) {
    if (
      !pair ||
      typeof pair !== "object" ||
      Object.keys(pair).length !== 2 ||
      typeof pair.viewerUserId !== "string" ||
      typeof pair.targetUserId !== "string" ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(pair.viewerUserId) ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(pair.targetUserId) ||
      pair.viewerUserId === pair.targetUserId
    )
      throw new Error("invalid-presence-reconciliation-pair");
    /** Separators cannot occur in a validated identity. */
    const key = `${pair.viewerUserId}/${pair.targetUserId}`;
    if (seen.has(key)) throw new Error("duplicate-presence-reconciliation-pair");
    seen.add(key);
  }
}

/** Returns irreversible deletion guards, whose active leases must finish before edge removal. */
async function deletedOwners(db: Firestore, pair: PresenceVisibilityPair) {
  /** Guards are read from this exact project's authority. */
  const refs = [pair.viewerUserId, pair.targetUserId].map((id) => getAccountDeletionRef(db, id));
  /** A present guard permanently prevents any new mirror from acquiring that owner's lease. */
  const snapshots = await db.getAll(...refs);
  return snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => snapshot.ref);
}

/** Reconciles at most twenty explicit edges; preview performs only reads and never acquires a lease. */
export async function reconcilePresenceVisibilityPage(
  pairs: PresenceVisibilityPair[],
  db: Firestore,
  database: Database,
  apply = false,
): Promise<PresenceVisibilityReconciliationResult> {
  validatePresenceVisibilityPairs(pairs);
  /** Counts describe only this supplied page, never global coverage. */
  const result: PresenceVisibilityReconciliationResult = {
    processed: 0,
    legacy: 0,
    versioned: 0,
    missing: 0,
    invalid: 0,
    refreshed: 0,
    deletedOwnerEdgesRemoved: 0,
    busy: false,
  };
  /** Preview inventories current records without claiming to predict later authorization. */
  const snapshots = await Promise.all(
    pairs.map((pair) => database.ref(`presenceVisibility/${pair.viewerUserId}/${pair.targetUserId}`).get()),
  );
  for (const snapshot of snapshots) {
    /** Permission values are never included in the returned summary. */
    const value = snapshot.val();
    if (value === null) result.missing++;
    else if (typeof value === "boolean") result.legacy++;
    else if (
      typeof value === "object" &&
      typeof value.allowed === "boolean" &&
      typeof value.revision === "string" &&
      /^\d{12}:\d{9}$/.test(value.revision)
    )
      result.versioned++;
    else result.invalid++;
  }
  if (!apply) return {...result, processed: pairs.length};
  if (result.invalid) throw new Error("invalid-presence-reconciliation-record");
  for (const pair of pairs) {
    /** Never guess that a missing user document means deletion. */
    let deleted = await deletedOwners(db, pair);
    if (!deleted.length) {
      await refreshPresenceVisibility(pair.viewerUserId, pair.targetUserId, db, database);
      // A deletion may commit after the initial guard read or prevent lease
      // acquisition. Recheck before counting a possibly skipped mirror as done.
      deleted = await deletedOwners(db, pair);
      if (!deleted.length) result.refreshed++;
    }
    if (deleted.length) {
      /** Existing leases never expire merely because the CLI's clock advanced. */
      const leases = await Promise.all(
        deleted.map((owner) => owner.collection(ACCOUNT_OPERATION_COLLECTION).limit(1).get()),
      );
      if (leases.some((lease) => !lease.empty)) return {...result, busy: true};
      // With an irreversible guard and no older lease, a new writer cannot
      // recreate this pair. Remove only this permission and its cleanup hint.
      await database.ref().update({
        [`presenceVisibility/${pair.viewerUserId}/${pair.targetUserId}`]: null,
        [`presenceViewers/${pair.targetUserId}/${pair.viewerUserId}`]: null,
      });
      result.deletedOwnerEdgesRemoved++;
    }
    result.processed++;
  }
  return result;
}
