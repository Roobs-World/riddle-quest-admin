import {LIVE_RACE_COUNTDOWN_MS} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {raceProviderScope} from "./raceEligibility";
import {assertLiveRaceDeckCompatible, isLiveRaceDeckCompatible} from "./raceDeckCompatibility";
import {requestDocumentId, stripUndefined, type Firestore} from "./raceSetupService";
import {liveRaceSearchEndsAtMs, liveRun, type LiveMatch, type LiveTicket} from "./raceLiveState";

/** Maximum time since a lobby heartbeat before an opponent becomes ineligible. */
const LOBBY_LEASE_MS = 10_000;
/** Maximum number of ticket identifiers retained in one public queue. */
const QUEUE_LIMIT = 40;

/** Firestore TTL cleanup is asynchronous; expired authority cannot remain usable. */
export function isLiveRaceRetained(snapshot: FirebaseFirestore.DocumentSnapshot, nowMs: number): boolean {
  /** Stored Firestore timestamp that bounds retained ticket or match authority. */
  const expiresAt = snapshot.data()?.expiresAt;
  return snapshot.exists && expiresAt instanceof admin.firestore.Timestamp && expiresAt.toMillis() > nowMs;
}

/** Reads every pairing fact before returning a synchronous transaction mutation plan. */
export async function prepareLiveRaceQueue(db: Firestore, transaction: FirebaseFirestore.Transaction,
  {ticketId, ticket, nowMs, expiresAt, ownerProfile, ownerPointer, newTicket = false}: {
    /** Owned ticket that is searching or re-entering the public queue. */
    ticketId: string;
    /** Mutable owned seat that receives the selected match identifier. */
    ticket: LiveTicket;
    /** Server time used for retention, search and heartbeat checks. */
    nowMs: number;
    /** Owned ticket retention timestamp, also used for queue storage. */
    expiresAt: FirebaseFirestore.Timestamp;
    /** Current account snapshot required before publishing a public seat. */
    ownerProfile: FirebaseFirestore.DocumentSnapshot;
    /** Previously loaded active-seat pointer for a recovering player. */
    ownerPointer?: FirebaseFirestore.DocumentSnapshot;
    /** Whether this transaction will publish a newly allocated owned ticket. */
    newTicket?: boolean;
  }): Promise<{
    /** Prepared shared match when a verified opponent is available. */
    match: LiveMatch | undefined;
    /** Earlier retention timestamp of the two matched tickets. */
    matchExpiresAt: FirebaseFirestore.Timestamp | undefined;
    /** Queues the prepared pairing and queue writes after all reads complete. */
    commit: () => void;
  }> {
  if (ticket.privateChallenge || ticket.cancelled || ticket.matchId || liveRaceSearchEndsAtMs(ticket) <= nowMs)
    throw new HttpsError("failed-precondition", "This public lobby is unavailable.");
  assertLiveRaceDeckCompatible(ticket.run);
  /** Shared queue document for the provider, language and category pool. */
  const queueRef = db.doc(`liveRaceQueues/${ticket.pool}`);
  /** Current queue contents and the recovering account's active-seat pointer. */
  const [queue, ownPointer] = await Promise.all([transaction.get(queueRef),
    newTicket ? undefined : ownerPointer ?? transaction.get(db.doc(`liveRacePlayers/${requestDocumentId(ticket.userId, "active-live-race")}`))]);
  if (!ownerProfile.exists || !newTicket && ownPointer?.data()?.ticketId !== ticketId)
    throw new HttpsError("failed-precondition", "Another live journey owns this account.");
  /** Untrusted stored queue identifiers before format and size checks. */
  const storedIds: unknown = queue.data()?.tickets;
  /** Distinct bounded ticket identifiers excluding the current owned seat. */
  const ids = Array.isArray(storedIds) ? [...new Set(storedIds.filter((id): id is string =>
    typeof id === "string" && /^[a-f0-9]{64}$/.test(id) && id !== ticketId))].slice(0, QUEUE_LIMIT) : [];
  /** Retained candidate ticket snapshots read before any pairing writes. */
  const snapshots = ids.length ? await transaction.getAll(...ids.map(id => db.doc(`liveRaceTickets/${id}`))) : [];
  /** Provider namespace that every human opponent must share. */
  const provider = raceProviderScope(ticket.userId);
  /** Fresh, compatible public tickets with matching language and category. */
  const candidates = snapshots.flatMap(snapshot => {
    /** Candidate seat inspected for ownership, content and heartbeat eligibility. */
    const other = snapshot.data() as LiveTicket | undefined;
    return other && isLiveRaceRetained(snapshot, nowMs) && !other.privateChallenge && !other.cancelled && !other.matchId &&
      other.userId !== ticket.userId && provider && raceProviderScope(other.userId) === provider &&
      other.pool === ticket.pool && isLiveRaceDeckCompatible(other.run) &&
      other.run.locale === ticket.run.locale && other.run.categoryId === ticket.run.categoryId &&
      liveRaceSearchEndsAtMs(other) > nowMs && other.seenAtMs + LOBBY_LEASE_MS > nowMs ? [{snapshot, ticket: other}] : [];
  });
  /** References needed to verify each candidate's account, pointer and reciprocal blocks. */
  const candidateReads = candidates.map(candidate => {
    /** Candidate ticket whose canonical ownership and safety records will be read. */
    const other = candidate.ticket;
    return {candidate,
      pointer: db.doc(`liveRacePlayers/${requestDocumentId(other.userId, "active-live-race")}`),
      profile: db.doc(`users/${other.userId}`), deleted: getJestAccountDeletionRef(db, other.userId),
      outgoingBlock: db.doc(`users/${ticket.userId}/blockedRivals/${other.userId}`),
      incomingBlock: db.doc(`users/${other.userId}/blockedRivals/${ticket.userId}`)};
  });
  /** Current ownership, deletion, block and public identity snapshots for candidates. */
  const [metadata, profiles] = candidateReads.length ? await Promise.all([
    transaction.getAll(...candidateReads.flatMap(({pointer, deleted, outgoingBlock, incomingBlock}) =>
      [pointer, deleted, outgoingBlock, incomingBlock])),
    transaction.getAll(...candidateReads.map(({profile}) => profile), {fieldMask: ["username", "level", "avatarUrl"]}),
  ]) : [[], []];
  /** Snapshots indexed by document path for consistent candidate verification. */
  const facts = new Map([...metadata, ...profiles].map(snapshot => [snapshot.ref.path, snapshot]));
  /** Candidates annotated with canonical ownership and reciprocal block decisions. */
  const verified = candidateReads.map(({candidate, pointer, profile, deleted, outgoingBlock, incomingBlock}) => ({candidate,
    active: facts.get(pointer.path)?.data()?.ticketId === candidate.snapshot.id && facts.get(profile.path)?.exists === true &&
      facts.get(deleted.path)?.exists === false,
    blocked: facts.get(outgoingBlock.path)?.exists !== false || facts.get(incomingBlock.path)?.exists !== false}));
  /** Candidates whose accounts still own their retained public seats. */
  const waiting = verified.filter(item => item.active);
  /** Oldest eligible unblocked opponent, with ticket ID as a stable tie-breaker. */
  const opponent = waiting.filter(item => !item.blocked).sort((a, b) =>
    a.candidate.ticket.createdAtMs - b.candidate.ticket.createdAtMs || a.candidate.snapshot.id.localeCompare(b.candidate.snapshot.id))[0]?.candidate;
  /** Shared match prepared in memory before the commit plan queues writes. */
  let match: LiveMatch | undefined;
  if (opponent) {
    /** Shared countdown start after both seats' latest observed clocks. */
    const startsAtMs = Math.max(nowMs, ticket.seenAtMs, opponent.ticket.seenAtMs) + LIVE_RACE_COUNTDOWN_MS;
    ticket.matchId = opponent.snapshot.id;
    match = {tickets: [opponent.snapshot.id, ticketId], participantIds: [opponent.ticket.userId, ticket.userId],
      startsAtMs, observedAtMs: startsAtMs - LIVE_RACE_COUNTDOWN_MS, players: [opponent.ticket.player, ticket.player],
      runs: [liveRun(opponent.ticket.run, opponent.ticket.userId, opponent.snapshot.id, startsAtMs),
        liveRun(opponent.ticket.run, ticket.userId, ticketId, startsAtMs)]};
  }
  /** Retention deadline limited by the earlier expiring participant ticket. */
  const matchExpiresAt = opponent ? admin.firestore.Timestamp.fromMillis(Math.min(expiresAt.toMillis(),
    opponent.snapshot.data()!.expiresAt.toMillis())) : undefined;
  // Active overflow seats return through their next heartbeat instead of becoming permanently orphaned.
  /** Remaining active seats and the unmatched owner, bounded to queue capacity. */
  const nextIds = [...waiting.filter(item => item.candidate !== opponent).map(item => item.candidate.snapshot.id),
    ...(!opponent ? [ticketId] : [])].slice(-QUEUE_LIMIT);
  /** Whether the persisted queue differs from the prepared identifier list. */
  const changed = !Array.isArray(storedIds) || storedIds.length !== nextIds.length || storedIds.some((id, index) => id !== nextIds[index]);
  return {match, matchExpiresAt,
    /** Queues opponent assignment, match creation and any changed queue contents. */
    commit() {
    if (opponent && match && matchExpiresAt) {
      transaction.update(opponent.snapshot.ref, {matchId: opponent.snapshot.id});
      transaction.create(db.doc(`liveRaceMatches/${opponent.snapshot.id}`), {...stripUndefined(match), expiresAt: matchExpiresAt});
    }
    if (changed) transaction.set(queueRef, {tickets: nextIds, expiresAt});
  }};
}
