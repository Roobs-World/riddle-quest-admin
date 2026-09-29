import {admin} from "../../shared/firebaseAdmin";
import {requestDocumentId} from "../../race/raceSetupService";
import {deleteMatchingCollectionGroupDocuments, SINGLE_WRITE_BATCH_SIZE} from "./accountDeletionBatches";

/** Neutral display value retained when another player's run needs ghost timing but not the deleted identity. */
const DELETED_RACE_OPPONENT_NAME = "Riddle Quest player";

/** Removes copied opponent identity from idempotent responses nested under a race run. */
async function anonymizeRaceRequestReceipts(runDocument: FirebaseFirestore.QueryDocumentSnapshot): Promise<void> {
  /** Provides cursor behavior. */
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    /** Provides query behavior. */
    let query = runDocument.ref
      .collection("requests")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(SINGLE_WRITE_BATCH_SIZE);
    if (cursor) query = query.startAfter(cursor);
    /** Provides snapshot behavior. */
    const snapshot = await query.get();
    if (snapshot.empty) return;
    /** Provides targets behavior. */
    const targets = snapshot.docs.filter((document) => {
      /** Provides response behavior. */
      const response = document.data().response;
      if (typeof response !== "object" || response === null) return false;
      /** Provides run behavior. */
      const run = (
        response as {
          /** Stores run. */
          run?: unknown;
        }
      ).run;
      if (typeof run !== "object" || run === null) return false;
      /** Provides opponent behavior. */
      const opponent = (
        run as {
          /** Stores opponent. */
          opponent?: unknown;
        }
      ).opponent;
      return typeof opponent === "object" && opponent !== null;
    });
    if (targets.length > 0) {
      /** Provides batch behavior. */
      const batch = admin.firestore().batch();
      targets.forEach((document) =>
        batch.update(document.ref, {
          "response.run.opponent.displayName": DELETED_RACE_OPPONENT_NAME,
          "response.run.opponent.avatarUrl": admin.firestore.FieldValue.delete(),
        }),
      );
      await batch.commit();
    }
    cursor = snapshot.docs.at(-1);
    if (snapshot.docs.length < SINGLE_WRITE_BATCH_SIZE) return;
  }
}

/** Removes display/avatar identity while preserving another player's bounded ghost run. */
async function anonymizeRaceRunPage(documents: FirebaseFirestore.QueryDocumentSnapshot[]): Promise<void> {
  /** Provides targets behavior. */
  const targets = documents.filter((document) => {
    /** Provides opponent behavior. */
    const opponent = document.data().opponent;
    return typeof opponent === "object" && opponent !== null;
  });
  if (targets.length === 0) return;
  /** Provides db behavior. */
  const db = admin.firestore();
  // Clear the parent projection first so in-flight identity-bearing response
  // writes conflict and retry against the generic projection.
  /** Provides parent identity batch behavior. */
  const parentIdentityBatch = db.batch();
  targets.forEach((document) =>
    parentIdentityBatch.update(document.ref, {
      "opponent.displayName": DELETED_RACE_OPPONENT_NAME,
      "opponent.avatarUrl": admin.firestore.FieldValue.delete(),
    }),
  );
  await parentIdentityBatch.commit();

  // Existing receipts can now be sanitized without a write-after-scan race.
  for (const document of targets) await anonymizeRaceRequestReceipts(document);

  /** Provides subject link batch behavior. */
  const subjectLinkBatch = db.batch();
  targets.forEach((document) =>
    subjectLinkBatch.update(document.ref, {
      "opponent.subjectUserId": admin.firestore.FieldValue.delete(),
    }),
  );
  await subjectLinkBatch.commit();
}

/** Deletes idempotency receipts nested under a race run in bounded pages. */
async function deleteRaceRequestReceipts(runDocument: FirebaseFirestore.QueryDocumentSnapshot): Promise<void> {
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await runDocument.ref.collection("requests").limit(SINGLE_WRITE_BATCH_SIZE).get();
    if (snapshot.empty) return;
    /** Provides batch behavior. */
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

/** Anonymizes new race runs linked directly to the deleted opponent UID. */
async function anonymizeSubjectLinkedRaceRuns(userId: string): Promise<void> {
  /** Provides db behavior. */
  const db = admin.firestore();
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await db
      .collection("raceRuns")
      .where("opponent.subjectUserId", "==", userId)
      .limit(SINGLE_WRITE_BATCH_SIZE)
      .get();
    if (snapshot.empty) return;
    await anonymizeRaceRunPage(snapshot.docs);
  }
}

/** Best-effort legacy fallback using a deleting creator's still-present challenge link. */
async function anonymizeLegacyRaceRunsForChallenge(challengeId: string): Promise<void> {
  /** Provides db behavior. */
  const db = admin.firestore();
  /** Provides cursor behavior. */
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    /** Provides query behavior. */
    let query = db
      .collection("raceRuns")
      .where("challengeId", "==", challengeId)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(SINGLE_WRITE_BATCH_SIZE);
    if (cursor) query = query.startAfter(cursor);
    /** Provides snapshot behavior. */
    const snapshot = await query.get();
    if (snapshot.empty) return;
    await anonymizeRaceRunPage(snapshot.docs);
    cursor = snapshot.docs.at(-1);
    if (snapshot.docs.length < SINGLE_WRITE_BATCH_SIZE) return;
  }
}

/** Deletes legacy inbox snapshots using the deterministic challenge/player item link. */
async function deleteLegacyRaceInboxSnapshot(challengeId: string, userId: string): Promise<void> {
  await deleteMatchingCollectionGroupDocuments("raceInbox", "itemId", requestDocumentId(challengeId, userId));
}

/** Deletes owned race participation after using its links to clean legacy inbox snapshots. */
async function deleteOwnedRaceParticipation(
  collection: "raceRuns" | "raceAttempts",
  ownerField: "userId" | "playerId",
  userId: string,
): Promise<void> {
  /** Provides db behavior. */
  const db = admin.firestore();
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await db
      .collection(collection)
      .where(ownerField, "==", userId)
      .limit(SINGLE_WRITE_BATCH_SIZE)
      .get();
    if (snapshot.empty) return;
    /** Provides challenge ids behavior. */
    const challengeIds = new Set(
      snapshot.docs.flatMap((document) => {
        /** Provides challenge id behavior. */
        const challengeId = document.data().challengeId;
        return typeof challengeId === "string" && challengeId.length > 0 ? [challengeId] : [];
      }),
    );
    for (const challengeId of challengeIds) await deleteLegacyRaceInboxSnapshot(challengeId, userId);
    if (collection === "raceRuns") {
      // Parent deletion does not remove Firestore subcollections.
      for (const document of snapshot.docs) await deleteRaceRequestReceipts(document);
    }
    /** Provides batch behavior. */
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    if (collection === "raceRuns") {
      // Sweep again after parent deletion to catch a mutation committed during the first scan.
      for (const document of snapshot.docs) await deleteRaceRequestReceipts(document);
    }
  }
}

/** Deletes owned challenges after anonymizing identity copied into other players' legacy runs. */
async function deleteOwnedRaceChallenges(userId: string): Promise<void> {
  /** Provides db behavior. */
  const db = admin.firestore();
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await db
      .collection("raceChallenges")
      .where("creatorId", "==", userId)
      .limit(SINGLE_WRITE_BATCH_SIZE)
      .get();
    if (snapshot.empty) return;
    /** Provides challenge ids behavior. */
    const challengeIds = new Set(
      snapshot.docs.map((document) => {
        /** Stores d. */
        const stored = document.data().challengeId;
        return typeof stored === "string" && stored.length > 0 ? stored : document.id;
      }),
    );
    for (const challengeId of challengeIds) await anonymizeLegacyRaceRunsForChallenge(challengeId);
    /** Provides batch behavior. */
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

/** Removes every targetable cross-user race identity snapshot before its legacy lookup links disappear. */
export async function removeCrossUserRaceIdentitySnapshots(userId: string): Promise<void> {
  await deleteMatchingCollectionGroupDocuments("raceSettlementOutbox", "userId", userId);
  await deleteMatchingCollectionGroupDocuments("raceSettlementOutbox", "creatorId", userId);
  await deleteMatchingCollectionGroupDocuments("raceInbox", "opponentUserId", userId);
  await deleteMatchingCollectionGroupDocuments("raceInviteLobbies", "creatorId", userId);
  await deleteMatchingCollectionGroupDocuments("raceInviteLobbies", "recipientId", userId);
  await deleteMatchingCollectionGroupDocuments("raceInviteRequests", "userId", userId);
  await anonymizeSubjectLinkedRaceRuns(userId);
  await deleteOwnedRaceChallenges(userId);
  await deleteOwnedRaceParticipation("raceRuns", "userId", userId);
  await deleteOwnedRaceParticipation("raceAttempts", "playerId", userId);
  // A receipt can outlive a TTL-deleted parent because Firestore does not
  // cascade parent deletion and each action refreshes the child's expiry.
  // The deletion lease has drained this owner, so the final sweep cannot race
  // a later owned receipt write.
  await deleteMatchingCollectionGroupDocuments("requests", "userId", userId);
}
