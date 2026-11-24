import {publishLiveRaceSignals} from "../../race/live/raceLiveSignals";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../../shared/firebaseAdmin";
import {getJestAccountDeletionRef} from "../../shared/accountDeletion";
import {requestDocumentId, stripUndefined} from "../../race/raceSetupService";
import {liveRun, type LiveMatch, type LiveTicket} from "../../race/live/raceLiveState";
import {DELETED_LIVE_RACE_USER_ID} from "../../race/privacy/raceLivePrivacy";
import {deleteMatchingCollectionGroupDocuments, deleteMatchingDocuments} from "./accountDeletionBatches";

/** Legacy discovery and request deletion use bounded pages; identity removal is transactional per match. */
const PAGE_SIZE = 100;
/** Opaque server ticket IDs are the only permitted match-to-document links. */
const validTicketId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

async function deleteOwnedNotificationDocuments(collection: string, uid: string): Promise<void> {
  const db = admin.firestore();
  for (;;) {
    const page = await db.collection(collection).where("uid", "==", uid).limit(PAGE_SIZE).get();
    if (page.empty) return;
    for (const row of page.docs) await db.runTransaction(async tx => {
      const current = await tx.get(row.ref);
      if (current.data()?.uid === uid) tx.delete(row.ref);
    });
  }
}

/** Sealed matches no longer need command receipts; deleted owners cannot create later receipts. */
async function clearLiveMatchRequests(ref: FirebaseFirestore.DocumentReference): Promise<void> {
  /** Firestore client used for transactional identity cleanup. */
  const db = admin.firestore();
  while (true) {
    /** Bounded page keeps each deletion batch within Firestore limits. */
    const page = await ref.collection("requests").limit(PAGE_SIZE).get();
    if (page.empty) return;
    /** Atomic batch retires the selected private documents. */
    const batch = db.batch();
    page.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}

/** Removes one copied identity without erasing a surviving player's already committed victory. */
async function anonymizeLiveMatch(ref: FirebaseFirestore.DocumentReference, userId: string): Promise<string[]> {
  /** Firestore client used for transactional identity cleanup. */
  const db = admin.firestore();
  /** Committed anonymization result identifies tickets that still need retirement. */
  const outcome = await db.runTransaction(async tx => {
    /** Current private record is read before applying idempotent deletion. */
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return {tickets: [] as string[], changed: false};
    /** Private match contains the identity snapshots and committed reward state. */
    const match = snapshot.data() as LiveMatch;
    if (!Array.isArray(match.runs) || !match.runs.some(run => run?.userId === userId)) {
      if (match.participantIds?.includes(userId)) throw new HttpsError("data-loss", "Stored live deletion participant index is invalid.");
      return {tickets: [] as string[], changed: false};
    }
    if (match.runs.length !== 2 || !Array.isArray(match.players) || match.players.length !== 2 ||
      !Array.isArray(match.tickets) || match.tickets.length !== 2 || !validTicketId(match.tickets[0]) ||
      match.tickets[1] !== null && !validTicketId(match.tickets[1]))
      throw new HttpsError("data-loss", "Stored live deletion linkage is invalid.");
    /** Every seat belonging to the deleted account must be anonymized. */
    const seats = match.runs.flatMap((run, seat) => run.userId === userId ? [seat] : []);
    /** Owned ticket identifiers are returned for queue and invitation cleanup. */
    const ticketIds = seats.flatMap(seat => match.tickets[seat] ? [match.tickets[seat]!] : []);
    /** Creator ticket retains the independently frozen deck shared by both seats. */
    const creatorRef = db.collection("liveRaceTickets").doc(match.tickets[0]);
    /** Creator snapshot determines whether an anonymous deck must survive. */
    const creator = await tx.get(creatorRef);
    /** Existing deletion markers are preserved while retiring this account. */
    const deletedSeats: [boolean, boolean] = [match.deletedSeats?.[0] === true, match.deletedSeats?.[1] === true];
    seats.forEach(seat => {deletedSeats[seat] = true;});
    /** A surviving account requires retention of its settled match history. */
    ticketIds.forEach(id => tx.delete(db.doc(`liveRaceSignals/${id}`)));
    /** Provides surviving human behavior. */
    const survivingHuman = match.tickets.some((ticket, seat) => ticket !== null && !deletedSeats[seat]);
    if (!survivingHuman) {
      tx.delete(ref);
      match.tickets.forEach(ticket => {if (ticket) tx.delete(db.collection("liveRaceTickets").doc(ticket));});
      return {tickets: ticketIds, changed: true};
    }
    // A surviving provider winner still needs the independently frozen creator deck.
    // Keep only content/clock metadata with a neutral identity; this is never an actionable invitation.
    if (creator?.exists && creator.data()?.userId === userId) {
      /** Original creator ticket supplies content and clock metadata for anonymization. */
      const original = creator.data() as LiveTicket;
      /** Only frozen deck metadata survives removal of the creator identity. */
      const base = {riddles: original.run.riddles, locale: original.run.locale,
        categoryId: original.run.categoryId, contentVersion: original.run.contentVersion};
      tx.set(creatorRef, stripUndefined({userId: DELETED_LIVE_RACE_USER_ID, deleted: true, cancelled: true,
        pool: original.pool, matchId: ref.id, createdAtMs: original.createdAtMs, seenAtMs: original.seenAtMs,
        player: {displayName: "Riddle Quest player", avatarUrl: null, level: 1, bot: false, correctCount: 0},
        run: {...liveRun(base, DELETED_LIVE_RACE_USER_ID, creator.id), rulesVersion: original.run.rulesVersion,
          ...(original.run.rulesSnapshot ? {rulesSnapshot: original.run.rulesSnapshot} : {})}, expiresAt: creator.data()!.expiresAt}));
    }
    seats.forEach(seat => {
      /** Seat run supplies neutral clock and rule metadata after identity removal. */
      const run = match.runs[seat];
      match.runs[seat] = liveRun({riddles: [], locale: run.locale, categoryId: run.categoryId,
        contentVersion: run.contentVersion}, DELETED_LIVE_RACE_USER_ID, run.runId, match.startsAtMs ?? 0);
      match.players[seat] = {displayName: "Riddle Quest player", avatarUrl: null, level: 1, bot: false, correctCount: 0};
    });
    match.deletedSeats = deletedSeats;
    match.participantIds = match.runs.flatMap((run, seat) => match.tickets[seat] !== null && !deletedSeats[seat] ? [run.userId] : []);
    if (match.winner === undefined) match.winner = null;
    // Deletion neither awards an unfinished rival nor reconstructs a missing economic receipt.
    if (match.rewardCoins === undefined) match.rewardCoins = 0;
    if (match.winner !== null && deletedSeats[match.winner]) delete match.newCoins;
    if (match.facebookReferral?.userId === userId) delete match.facebookReferral;
    if (match.redditReferral?.userId === userId) delete match.redditReferral;
    // Historical human matches could lack a root TTL before their first poll.
    // Preserve an existing deadline or its creator ticket's original deadline;
    // orphaned legacy roots use the accepted match start, never deletion time.
    /** Existing retention deadline must survive cleanup without extension. */
    const expiresAt = snapshot.data()!.expiresAt ?? creator.data()?.expiresAt;
    if (!expiresAt && (match.startsAtMs === null || !Number.isSafeInteger(match.startsAtMs) || match.startsAtMs <= 0))
      throw new HttpsError("data-loss", "Stored live deletion retention clock is invalid.");
    const retention = expiresAt ?? admin.firestore.Timestamp.fromMillis((match.startsAtMs ?? 0) + 7 * 86_400_000);
    tx.set(ref, stripUndefined({...match, expiresAt: retention}));
    publishLiveRaceSignals(db, tx, match.tickets.filter((_, seat) => !deletedSeats[seat]), retention);
    return {tickets: ticketIds, changed: true};
  });
  if (outcome.changed) await clearLiveMatchRequests(ref);
  return outcome.tickets;
}

/** Retires owned queue references and deletes tickets unless they are an anonymous frozen deck. */
async function retireLiveTicket(ticketId: string, userId: string): Promise<void> {
  /** Firestore client used for transactional identity cleanup. */
  const db = admin.firestore(), ref = db.collection("liveRaceTickets").doc(ticketId);
  await db.runTransaction(async tx => {
    /** Current private record is read before applying idempotent deletion. */
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {tx.delete(db.doc(`liveRaceSignals/${ticketId}`)); return;}
    /** Owned or previously anonymized ticket is eligible for idempotent retirement. */
    const ticket = snapshot.data() as LiveTicket;
    if (ticket.userId !== userId && !(ticket.deleted === true && ticket.userId === DELETED_LIVE_RACE_USER_ID)) return;
    /** Pool queue must stop advertising the deleted account ticket. */
    const queueRef = db.collection("liveRaceQueues").doc(ticket.pool);
    /** Current queue membership is read before removing the ticket. */
    const queue = await tx.get(queueRef);
    if (Array.isArray(queue.data()?.tickets) && queue.data()!.tickets.includes(ticketId))
      tx.update(queueRef, {tickets: queue.data()!.tickets.filter((id: unknown) => id !== ticketId)});
    if (!ticket.deleted) tx.delete(ref);
    tx.delete(db.doc(`liveRaceSignals/${ticketId}`));
  });
  await deleteMatchingCollectionGroupDocuments("liveRaceInvitations", "challengeId", `live_${ticketId}`);
}

/** Deletion guard and drained account leases precede this idempotent live-data sweep. */
export async function removeLiveRaceIdentitySnapshots(userId: string): Promise<void> {
  /** Firestore client used for transactional identity cleanup. */
  const db = admin.firestore();
  await db.runTransaction(async tx => {
    if (!(await tx.get(getJestAccountDeletionRef(db, userId))).exists)
      throw new HttpsError("failed-precondition", "Live cleanup requires an account deletion guard.");
  });
  while (true) {
    /** Bounded page keeps each deletion batch within Firestore limits. */
    const page = await db.collection("liveRaceTickets").where("userId", "==", userId).limit(PAGE_SIZE).get();
    if (page.empty) break;
    for (const ticket of page.docs) {
      if (validTicketId(ticket.data().matchId)) await anonymizeLiveMatch(db.collection("liveRaceMatches").doc(ticket.data().matchId), userId);
      await retireLiveTicket(ticket.id, userId);
    }
  }
  // New matches expose an indexed participant list, including orphaned source tickets.
  while (true) {
    /** Bounded page keeps each deletion batch within Firestore limits. */
    const page = await db.collection("liveRaceMatches").where("participantIds", "array-contains", userId).limit(PAGE_SIZE).get();
    if (page.empty) break;
    for (const match of page.docs) for (const id of await anonymizeLiveMatch(match.ref, userId)) await retireLiveTicket(id, userId);
  }
  // Historical matches have no participant index. Page the old private records so a
  // missing ticket cannot hide identity; new matches are handled by the indexed path.
  /** Document cursor bounds discovery of legacy matches without participant indexes. */
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    /** Stable document ordering pages historical private matches. */
    let query = db.collection("liveRaceMatches").orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    /** Bounded page keeps each deletion batch within Firestore limits. */
    const page = await query.get();
    if (page.empty) break;
    for (const match of page.docs) {
      if (match.data().participantIds === undefined)
        for (const id of await anonymizeLiveMatch(match.ref, userId)) await retireLiveTicket(id, userId);
    }
    cursor = page.docs.at(-1);
    if (page.docs.length < PAGE_SIZE) break;
  }
  // An addressed creator may still own a healthy account. Remove only the deleted
  // recipient linkage, cancelling a waiting invitation rather than a settled match.
  while (true) {
    /** Bounded page keeps each deletion batch within Firestore limits. */
    const page = await db.collection("liveRaceTickets").where("inviteRecipientId", "==", userId).limit(PAGE_SIZE).get();
    if (page.empty) break;
    for (const ticket of page.docs) await db.runTransaction(async tx => {
      /** Recipient binding is rechecked transactionally before removing the address. */
      const current = await tx.get(ticket.ref);
      if (current.data()?.inviteRecipientId !== userId) return;
      publishLiveRaceSignals(db, tx, [ticket.id], current.data()!.expiresAt);
      tx.update(ticket.ref, {inviteRecipientId: admin.firestore.FieldValue.delete(), ...(current.data()?.matchId ? {} : {cancelled: true})});
    });
  }
  await deleteMatchingDocuments("liveRacePushOutbox", "creatorId", userId);
  await deleteMatchingDocuments("liveRacePushOutbox", "recipientId", userId);
  await deleteMatchingDocuments("liveRacePushTokens", "uid", userId);
  await deleteMatchingDocuments("androidPushTokens", "uid", userId);
  await deleteMatchingDocuments("androidPushDeliveries", "uid", userId);
  await deleteMatchingDocuments("androidNotificationDevices", "uid", userId);
  await deleteOwnedNotificationDocuments("accountPushDevices", userId);
  await deleteOwnedNotificationDocuments("accountPushEndpoints", userId);
  await deleteOwnedNotificationDocuments("accountPushDeliveries", userId);
  await deleteOwnedNotificationDocuments("notificationPairings", userId);
  await db.doc(`notificationPairingLimits/${userId}`).delete();
  await deleteMatchingCollectionGroupDocuments("entries", "userId", userId);
  /** Atomic batch retires the selected private documents. */
  const batch = db.batch();
  batch.delete(db.collection("liveRacePlayers").doc(requestDocumentId(userId, "active-live-race")));
  await batch.commit();
}
