import {getDatabase, type Database} from "firebase-admin/database";
import {getFirestore, type Firestore} from "firebase-admin/firestore";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {isJestAccountDeletedError, runWithJestAccountOperationLease} from "../jest/jestAccountDeletion";
import {BROWSER_CALLABLE_TIMEOUT_SECONDS} from "../shared/callableSecurity";

/** Provides valid user id behavior. */
const validUserId = (value: string): boolean => /^[A-Za-z0-9_-]{1,160}$/.test(value);
/** Defines the known rival sources value. */
const KNOWN_RIVAL_SOURCES = new Set(["completed_race", "facebook_context", "facebook_invite"]);

/** Recomputes one directed visibility edge from server-owned rivalry and bilateral block state. */
export async function refreshPresenceVisibility(
  viewerUserId: string,
  targetUserId: string,
  firestore: Firestore = getFirestore(),
  database: Database = getDatabase(),
): Promise<boolean> {
  if (!validUserId(viewerUserId) || !validUserId(targetUserId) || viewerUserId === targetUserId) {
    throw new Error("invalid-presence-visibility-pair");
  }
  // Both owners' deletion sweeps must wait for older mirrors to finish. A
  // cleanup-trigger delivery after either tombstone must not recreate edges.
  try {
    return await runWithJestAccountOperationLease(
      viewerUserId,
      BROWSER_CALLABLE_TIMEOUT_SECONDS,
      () =>
        runWithJestAccountOperationLease(
          targetUserId,
          BROWSER_CALLABLE_TIMEOUT_SECONDS,
          async () => {
            /** One current transaction snapshot supplies both bilateral blocks and the relationship. */
            const [known, viewerBlock, targetBlock] = await firestore.runTransaction((transaction) =>
              transaction.getAll(
                firestore.doc(`users/${viewerUserId}/knownRivals/${targetUserId}`),
                firestore.doc(`users/${viewerUserId}/blockedRivals/${targetUserId}`),
                firestore.doc(`users/${targetUserId}/blockedRivals/${viewerUserId}`),
              ),
            );
            /** The database's observation time orders deliveries even when a block was removed. */
            const {seconds, nanoseconds} = known.readTime;
            if (
              !Number.isSafeInteger(seconds) ||
              seconds < 0 ||
              seconds > 999_999_999_999 ||
              !Number.isSafeInteger(nanoseconds) ||
              nanoseconds < 0 ||
              nanoseconds >= 1_000_000_000 ||
              !viewerBlock.readTime.isEqual(known.readTime) ||
              !targetBlock.readTime.isEqual(known.readTime)
            ) {
              throw new Error("invalid-presence-observation-time");
            }
            /** Fixed-width server time preserves the full nanosecond ordering without floating-point loss. */
            const revision = `${String(seconds).padStart(12, "0")}:${String(nanoseconds).padStart(9, "0")}`;
            /** Only existing server-owned sources establish a game-known rival. */
            const relationship = known.data();
            /** A denial remains stored so a late older allow cannot resurrect it. */
            const allowed =
              known.exists &&
              relationship?.targetUserId === targetUserId &&
              typeof relationship.source === "string" &&
              KNOWN_RIVAL_SOURCES.has(relationship.source) &&
              !viewerBlock.exists &&
              !targetBlock.exists;
            // This is a cleanup index, not permission. Keep it through denials so
            // account deletion can remove every retained revision. Writing it first
            // and holding both leases makes partial failures safe to clean up.
            await database.ref().update({[`presenceViewers/${targetUserId}/${viewerUserId}`]: true});
            /** A bounded transaction touches only this edge, never all presence users. */
            const result = await database.ref(`presenceVisibility/${viewerUserId}/${targetUserId}`).transaction(
              (current) => {
                if (current !== null && typeof current === "object") {
                  if (
                    typeof current.revision !== "string" ||
                    !/^\d{12}:\d{9}$/.test(current.revision) ||
                    typeof current.allowed !== "boolean"
                  ) {
                    throw new Error("invalid-presence-visibility-record");
                  }
                  if (current.revision > revision || (current.revision === revision && (!current.allowed || allowed)))
                    return;
                }
                return {allowed, revision};
              },
              undefined,
              false,
            );
            return result.snapshot.child("allowed").val() === true;
          },
          firestore,
        ),
      firestore,
    );
  } catch (error) {
    if (isJestAccountDeletedError(error)) return false;
    throw error;
  }
}

/** Removes all live presence and both ACL directions during account deletion. */
export async function deletePresenceForUser(userId: string, database: Database = getDatabase()): Promise<void> {
  if (!validUserId(userId)) throw new Error("invalid-presence-user");
  /** Provides [viewers snapshot, targets snapshot] behavior. */
  const [viewersSnapshot, targetsSnapshot] = await Promise.all([
    database.ref(`presenceViewers/${userId}`).get(),
    database.ref(`presenceVisibility/${userId}`).get(),
  ]);
  /** Provides viewers behavior. */
  const viewers = viewersSnapshot.val();
  /** Provides targets behavior. */
  const targets = targetsSnapshot.val();
  /** Provides update behavior. */
  const update: Record<string, null> = {
    [`presenceConnections/${userId}`]: null,
    [`presenceConsent/${userId}`]: null,
    [`presenceStatus/${userId}`]: null,
    [`presenceOptIn/${userId}`]: null,
    [`presenceVisibility/${userId}`]: null,
    [`presenceViewers/${userId}`]: null,
  };
  if (typeof viewers === "object" && viewers !== null) {
    for (const viewerUserId of Object.keys(viewers)) {
      if (validUserId(viewerUserId)) update[`presenceVisibility/${viewerUserId}/${userId}`] = null;
    }
  }
  if (typeof targets === "object" && targets !== null) {
    for (const targetUserId of Object.keys(targets)) {
      if (validUserId(targetUserId)) update[`presenceViewers/${targetUserId}/${userId}`] = null;
    }
  }
  await database.ref().update(update);
}

/** Recomputes both directed edges after either player changes a block. */
export async function refreshBlockedRivalPresenceVisibility(
  viewerUserId: string,
  targetUserId: string,
  firestore: Firestore = getFirestore(),
  database: Database = getDatabase(),
): Promise<void> {
  await Promise.all([
    refreshPresenceVisibility(viewerUserId, targetUserId, firestore, database),
    refreshPresenceVisibility(targetUserId, viewerUserId, firestore, database),
  ]);
}

/** Mirrors relationship establishment/removal into the RTDB presence ACL. */
export const syncKnownRivalPresenceVisibility = onDocumentWritten(
  {document: "users/{viewerUserId}/knownRivals/{targetUserId}", region: "us-central1"},
  async (event) => refreshPresenceVisibility(event.params.viewerUserId, event.params.targetUserId),
);

/** Revokes both directions on block and safely restores eligible edges on unblock. */
export const syncBlockedRivalPresenceVisibility = onDocumentWritten(
  {document: "users/{viewerUserId}/blockedRivals/{targetUserId}", region: "us-central1"},
  async (event) => refreshBlockedRivalPresenceVisibility(event.params.viewerUserId, event.params.targetUserId),
);
