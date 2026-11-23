import {readProviderLiveTournamentRun} from "../../../../../firebase-functions/src/race/raceLiveTournament";

/** Reddit official scores resolve only owned Reddit live victories. */
export function readRedditLiveTournamentRun(transaction: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore,
  userId: string, ticketId: string) {
  return readProviderLiveTournamentRun(transaction, db, userId, ticketId, "reddit");
}
