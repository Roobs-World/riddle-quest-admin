import {readProviderLiveTournamentRun} from "./raceLiveTournament";

/** Facebook official scores resolve only owned Facebook live victories. */
export function readFacebookLiveTournamentRun(transaction: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore,
  userId: string, ticketId: string) {
  return readProviderLiveTournamentRun(transaction, db, userId, ticketId, "facebook");
}
