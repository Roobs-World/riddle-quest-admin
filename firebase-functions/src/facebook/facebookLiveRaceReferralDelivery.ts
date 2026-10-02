import {HttpsError} from "firebase-functions/v2/https";
import {LIVE_RACE_WIN_COINS} from "@qwordly/core/race";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {requestDocumentId, type Firestore} from "../race/raceSetupService";
import type {parseRacePerformanceEvent} from "../race/raceDeliveryRecords";
import type {LiveMatch, LiveTicket} from "../race/raceLiveState";
import {isFacebookFirebaseUid} from "./facebookSecurity";

/** A public terminal projection never establishes identity, victory, or referral authority. */
export async function validateFacebookLiveRaceReferralSource(transaction: FirebaseFirestore.Transaction, db: Firestore,
  receipt: ReturnType<typeof parseRacePerformanceEvent>, nowMs: number): Promise<boolean> {
  if (receipt.source !== "facebook_live" || !isFacebookFirebaseUid(receipt.userId) || !receipt.liveTicketId || !receipt.liveMatchId ||
    receipt.runId !== requestDocumentId(receipt.userId, `facebook-live-referral:${receipt.liveTicketId}`))
    throw new HttpsError("data-loss", "Stored live referral receipt is invalid.");
  const [ticketSnapshot, matchSnapshot, owner, deletion] = await Promise.all([
    transaction.get(db.doc(`liveRaceTickets/${receipt.liveTicketId}`)),
    transaction.get(db.doc(`liveRaceMatches/${receipt.liveMatchId}`)),
    transaction.get(db.doc(`users/${receipt.userId}`)), transaction.get(getJestAccountDeletionRef(db, receipt.userId)),
  ]);
  if (!ticketSnapshot.exists || !matchSnapshot.exists || !owner.exists || deletion.exists) return false;
  const ticketExpiry = ticketSnapshot.data()!.expiresAt, matchExpiry = matchSnapshot.data()!.expiresAt;
  if (!(ticketExpiry instanceof admin.firestore.Timestamp) || !(matchExpiry instanceof admin.firestore.Timestamp))
    throw new HttpsError("data-loss", "Stored live referral retention is invalid.");
  if (ticketExpiry.toMillis() <= nowMs || matchExpiry.toMillis() <= nowMs) return false;
  const ticket = ticketSnapshot.data() as LiveTicket, match = matchSnapshot.data() as LiveMatch;
  const seat = match.winner;
  const binding = match.facebookReferral;
  if (seat !== 0 && seat !== 1 || !Array.isArray(match.tickets) || !Array.isArray(match.runs) ||
    ticket.userId !== receipt.userId || ticket.matchId !== receipt.liveMatchId || match.tickets[seat] !== receipt.liveTicketId ||
    match.runs[seat]?.userId !== receipt.userId || match.runs[seat]?.runId !== receipt.liveTicketId ||
    match.rewardCoins !== LIVE_RACE_WIN_COINS || binding?.eventId !== receipt.runId || binding.ticketId !== receipt.liveTicketId ||
    binding.userId !== receipt.userId || binding.createdAtMs !== receipt.createdAtMs)
    throw new HttpsError("data-loss", "Stored live referral source does not match its receipt.");
  return true;
}
