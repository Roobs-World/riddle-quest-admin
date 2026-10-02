import {HttpsError} from "firebase-functions/v2/https";
import {LIVE_RACE_WIN_COINS} from "@qwordly/core/race";
import {createHash} from "node:crypto";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import type {Firestore} from "./raceSetupService";
import type {parseRacePerformanceEvent} from "./raceDeliveryRecords";
import type {LiveMatch, LiveTicket} from "./raceLiveState";
import {isFacebookFirebaseUid} from "../facebook/facebookSecurity";
import {isRedditFirebaseUid} from "../reddit/redditSecurity";

/** Supported provider identity remains explicit in each live referral receipt. */
type Provider = "facebook" | "reddit";

/** Separate hash domain prevents a chosen legacy request ID from occupying the live receipt. */
export const liveRaceReferralEventId = (provider: Provider, userId: string, ticketId: string): string =>
  createHash("sha256").update(`riddle-quest\0${provider}-live-referral\0${userId}\0${ticketId}`).digest("hex");

/** A public terminal projection never establishes identity, victory, or referral authority. */
export async function validateLiveRaceReferralSource(transaction: FirebaseFirestore.Transaction, db: Firestore,
  receipt: ReturnType<typeof parseRacePerformanceEvent>, nowMs: number, provider: Provider): Promise<boolean> {
  /** Provider-specific UID validation prevents cross-target referral attribution. */
  const validOwner = provider === "facebook" ? isFacebookFirebaseUid(receipt.userId) : isRedditFirebaseUid(receipt.userId);
  if (receipt.source !== `${provider}_live` || !validOwner || !receipt.liveTicketId || !receipt.liveMatchId ||
    receipt.runId !== liveRaceReferralEventId(provider, receipt.userId, receipt.liveTicketId))
    throw new HttpsError("data-loss", "Stored live referral receipt is invalid.");
  /** Private source records and account-deletion state are read in the same transaction. */
  const [ticketSnapshot, matchSnapshot, owner, deletion] = await Promise.all([
    transaction.get(db.doc(`liveRaceTickets/${receipt.liveTicketId}`)),
    transaction.get(db.doc(`liveRaceMatches/${receipt.liveMatchId}`)),
    transaction.get(db.doc(`users/${receipt.userId}`)), transaction.get(getJestAccountDeletionRef(db, receipt.userId)),
  ]);
  if (!ticketSnapshot.exists || !matchSnapshot.exists || !owner.exists || deletion.exists) return false;
  /** Both source records must retain an unexpired server timestamp. */
  const ticketExpiry = ticketSnapshot.data()!.expiresAt, matchExpiry = matchSnapshot.data()!.expiresAt;
  if (!(ticketExpiry instanceof admin.firestore.Timestamp) || !(matchExpiry instanceof admin.firestore.Timestamp))
    throw new HttpsError("data-loss", "Stored live referral retention is invalid.");
  if (ticketExpiry.toMillis() <= nowMs || matchExpiry.toMillis() <= nowMs) return false;
  /** Private ticket and match records establish the receipt source. */
  const ticket = ticketSnapshot.data() as LiveTicket, match = matchSnapshot.data() as LiveMatch;
  /** Settled winner seat identifies the only qualifying run. */
  const seat = match.winner;
  /** Provider-specific immutable receipt binding committed with the reward. */
  const binding = provider === "facebook" ? match.facebookReferral : match.redditReferral;
  /** Server-recorded multiplayer wins corroborate the qualifying settlement. */
  const wins = owner.data()?.stats?.multiplayerWins;
  if (seat !== 0 && seat !== 1 || !Array.isArray(match.tickets) || !Array.isArray(match.runs) || !Array.isArray(match.players) ||
    ticket.userId !== receipt.userId || ticket.matchId !== receipt.liveMatchId || match.tickets[seat] !== receipt.liveTicketId ||
    match.runs[seat]?.userId !== receipt.userId || match.runs[seat]?.runId !== receipt.liveTicketId ||
    match.players[seat]?.bot !== false || !Number.isSafeInteger(wins) || wins < 1 ||
    match.rewardCoins !== LIVE_RACE_WIN_COINS || binding?.eventId !== receipt.runId || binding.ticketId !== receipt.liveTicketId ||
    binding.userId !== receipt.userId || binding.createdAtMs !== receipt.createdAtMs)
    throw new HttpsError("data-loss", "Stored live referral source does not match its receipt.");
  return true;
}
