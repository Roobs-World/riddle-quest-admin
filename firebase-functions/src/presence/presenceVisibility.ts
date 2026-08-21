import {getDatabase, type Database} from "firebase-admin/database";
import {getFirestore, type Firestore} from "firebase-admin/firestore";
import {onDocumentWritten} from "firebase-functions/v2/firestore";

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
  const [known, viewerBlock, targetBlock] = await Promise.all([
    firestore.doc(`users/${viewerUserId}/knownRivals/${targetUserId}`).get(),
    firestore.doc(`users/${viewerUserId}/blockedRivals/${targetUserId}`).get(),
    firestore.doc(`users/${targetUserId}/blockedRivals/${viewerUserId}`).get(),
  ]);
  const relationship = known.data();
  const validRelationship = known.exists &&
    relationship?.targetUserId === targetUserId &&
    typeof relationship.source === "string" &&
    KNOWN_RIVAL_SOURCES.has(relationship.source);
  const visible = validRelationship && !viewerBlock.exists && !targetBlock.exists;
  await database.ref().update({
    [`presenceVisibility/${viewerUserId}/${targetUserId}`]: visible ? true : null,
    [`presenceViewers/${targetUserId}/${viewerUserId}`]: visible ? true : null,
  });
  return visible;
}

/** Removes all live presence and both ACL directions during account deletion. */
export async function deletePresenceForUser(
  userId: string,
  database: Database = getDatabase(),
): Promise<void> {
  if (!validUserId(userId)) throw new Error("invalid-presence-user");
  const [viewersSnapshot, targetsSnapshot] = await Promise.all([
    database.ref(`presenceViewers/${userId}`).get(),
    database.ref(`presenceVisibility/${userId}`).get(),
  ]);
  const viewers = viewersSnapshot.val();
  const targets = targetsSnapshot.val();
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
