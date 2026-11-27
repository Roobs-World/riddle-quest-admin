import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {getAccountDeletionRef} from "../shared/accountDeletion";
import {raceProviderScope} from "../race/access/raceProviderScope";

/** Resolves only the human opponent of an authenticated, retained live seat in the mutation transaction. */
export async function resolveLiveRaceSafetyTarget(transaction: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore,
  userId: string, liveTicketId: string, nowMs: number): Promise<string> {
  if (!raceProviderScope(userId) || !/^[a-f0-9]{64}$/.test(liveTicketId))
    throw new HttpsError("invalid-argument", "Invalid live safety seat.");
  /** Ownership is checked before following any private match binding. */
  const ticket = (await transaction.get(db.doc(`liveRaceTickets/${liveTicketId}`))).data();
  if (!ticket || ticket.userId !== userId) throw new HttpsError("permission-denied", "Live safety seat ownership is required.");
  if (ticket.deleted || ticket.cancelled || ticket.run?.userId !== userId || ticket.run?.runId !== liveTicketId ||
    typeof ticket.pool !== "string" || !/^[a-f0-9]{64}$/.test(ticket.pool) ||
    ticket.pool !== createHash("sha256").update(`${raceProviderScope(userId)}:${ticket.run?.locale}:${ticket.run?.categoryId}`).digest("hex") ||
    typeof ticket.matchId !== "string" || !/^[a-f0-9]{64}$/.test(ticket.matchId) ||
    !ticket.expiresAt || typeof ticket.expiresAt.toMillis !== "function" || nowMs >= ticket.expiresAt.toMillis())
    throw new HttpsError("failed-precondition", "Live safety seat is unavailable.");
  /** The private pair identifies the opponent; no target identity is accepted from the caller. */
  const match = (await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data();
  if (!match || !Array.isArray(match.tickets) || match.tickets.length !== 2 || match.tickets[0] !== ticket.matchId ||
    !Array.isArray(match.runs) || match.runs.length !== 2 || !Array.isArray(match.players) || match.players.length !== 2)
    throw new HttpsError("data-loss", "Invalid live safety match binding.");
  /** The viewer must occupy exactly one independently identified seat. */
  const seat = match.tickets.indexOf(liveTicketId), rivalSeat = 1 - seat;
  if (seat < 0 || match.tickets[0] === match.tickets[1] || match.runs[seat]?.userId !== userId || match.runs[seat]?.runId !== liveTicketId)
    throw new HttpsError("data-loss", "Invalid live safety seat binding.");
  /** Bots and anonymized deleted seats never become moderation targets. */
  const rivalTicketId = match.tickets[rivalSeat];
  if (typeof rivalTicketId !== "string" || !/^[a-f0-9]{64}$/.test(rivalTicketId) || match.deletedSeats?.[seat] ||
    match.deletedSeats?.[rivalSeat] || match.players[rivalSeat]?.bot !== false)
    throw new HttpsError("failed-precondition", "No retained human live opponent.");
  /** Independent opponent ticket must agree with the same provider and match. */
  const rival = (await transaction.get(db.doc(`liveRaceTickets/${rivalTicketId}`))).data();
  if (!rival || rival.deleted || rival.cancelled || rival.userId === userId || !raceProviderScope(rival.userId) ||
    raceProviderScope(rival.userId) !== raceProviderScope(userId) || rival.pool !== ticket.pool ||
    rival.matchId !== ticket.matchId || rival.run?.userId !== rival.userId || rival.run?.runId !== rivalTicketId ||
    rival.run?.locale !== ticket.run?.locale || rival.run?.categoryId !== ticket.run?.categoryId ||
    match.runs[rivalSeat]?.userId !== rival.userId || match.runs[rivalSeat]?.runId !== rivalTicketId ||
    !rival.expiresAt || typeof rival.expiresAt.toMillis !== "function" || nowMs >= rival.expiresAt.toMillis())
    throw new HttpsError("failed-precondition", "Live opponent binding is unavailable.");
  /** Canonical existence and deletion guards are read under the same transaction lock. */
  const [owner, opponent, ownerDeletion, opponentDeletion] = await Promise.all([
    transaction.get(db.doc(`users/${userId}`)), transaction.get(db.doc(`users/${rival.userId}`)),
    transaction.get(getAccountDeletionRef(db, userId)), transaction.get(getAccountDeletionRef(db, rival.userId)),
  ]);
  if (!owner.exists || !opponent.exists || ownerDeletion.exists || opponentDeletion.exists)
    throw new HttpsError("failed-precondition", "Live safety account is unavailable.");
  return rival.userId;
}
