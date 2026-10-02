import {LIVE_RACE_COUNTDOWN_MS, RACE_TARGET_CORRECT} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {isFacebookFirebaseUid} from "../facebook/facebookSecurity";
import {parseRunRecord} from "./raceSetupService";
import type {RaceRunRecord} from "./raceEngine";
import type {FacebookTournamentDeckBinding} from "./facebookTournament";

/** Resolves a completed human victory from the private live transaction records. */
export async function readFacebookLiveTournamentRun(
  transaction: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  userId: string,
  ticketId: string,
): Promise<{run: RaceRunRecord; deck: FacebookTournamentDeckBinding}> {
  if (!/^[a-f0-9]{64}$/.test(ticketId)) throw new HttpsError("not-found", "Tournament race run was not found.");
  const ticket = (await transaction.get(db.doc(`liveRaceTickets/${ticketId}`))).data();
  if (!ticket) throw new HttpsError("not-found", "Tournament live ticket was not found.");
  if (!isFacebookFirebaseUid(userId) || ticket.userId !== userId) {
    throw new HttpsError("permission-denied", "Tournament live ticket ownership is invalid.");
  }
  if (ticket.cancelled || typeof ticket.matchId !== "string" || !/^[a-f0-9]{64}$/.test(ticket.matchId)) {
    throw new HttpsError("failed-precondition", "Only settled live solve victories qualify.");
  }
  const match = (await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data();
  if (!match || !Array.isArray(match.tickets) || match.tickets.length !== 2 ||
    !Array.isArray(match.runs) || match.runs.length !== 2 ||
    typeof match.tickets[0] !== "string" || !/^[a-f0-9]{64}$/.test(match.tickets[0]) ||
    match.tickets[0] !== ticket.matchId || match.tickets[0] === match.tickets[1]) {
    throw new HttpsError("data-loss", "Tournament live match binding is invalid.");
  }
  const seat = match.tickets.indexOf(ticketId);
  if (seat < 0 || match.winner !== seat) {
    throw new HttpsError("failed-precondition", "Only the human solve winner qualifies.");
  }
  // Public result projections mark both players completed, including forfeits.
  // Only the private run retains genuine ten-riddle completion and its clocks.
  const stored = match.runs[seat];
  if (!stored || stored.status !== "completed" || stored.correctCount !== RACE_TARGET_CORRECT) {
    throw new HttpsError("failed-precondition", "Only completed authoritative live solve runs qualify.");
  }
  // Live matches have a five-second shared countdown; recorded races use three.
  // Validate that binding here before applying the common scoring/deck validator.
  const {readinessAcceptedAtMs, ...record} = stored;
  if (!Number.isSafeInteger(match.startsAtMs) || match.startsAtMs <= 0 ||
    readinessAcceptedAtMs !== match.startsAtMs - LIVE_RACE_COUNTDOWN_MS) {
    throw new HttpsError("data-loss", "Tournament live countdown binding is invalid.");
  }
  const run = parseRunRecord(record, ticketId);
  if (run.userId !== userId || run.deckId !== ticketId || run.evaluationPolicy !== "server-only" ||
    run.status !== "completed" || run.correctCount !== RACE_TARGET_CORRECT ||
    run.events.filter(event => event.type === "correct" || event.type === "skip").length !== RACE_TARGET_CORRECT ||
    run.startedAtMs !== match.startsAtMs) {
    throw new HttpsError("failed-precondition", "Only completed authoritative live solve runs qualify.");
  }
  // Both seats play the creator's frozen deck. The joiner's earlier search deck
  // is unrelated and must never be used to validate its winning match run.
  const creator = seat === 0 ? ticket : (await transaction.get(db.doc(`liveRaceTickets/${match.tickets[0]}`))).data();
  const source = creator?.run;
  if (!creator || creator.matchId !== ticket.matchId || !isFacebookFirebaseUid(creator.userId) ||
    source?.userId !== creator.userId || source?.runId !== match.tickets[0] || source?.deckId !== match.tickets[0] ||
    match.runs[0]?.userId !== creator.userId || creator.pool !== ticket.pool ||
    source.locale !== run.locale || source.categoryId !== run.categoryId || source.rulesVersion !== run.rulesVersion ||
    source.contentVersion !== run.contentVersion || !Array.isArray(source.riddles) ||
    source.riddles.length !== run.riddles.length || source.riddles.some((riddle: unknown, position: number) => {
      if (!riddle || typeof riddle !== "object") return true;
      const original = riddle as Record<string, unknown>, actual = run.riddles[position];
      return original.riddleId !== actual.riddleId || original.canonicalRiddleId !== actual.canonicalRiddleId ||
        original.position !== actual.position || original.text !== actual.text || original.answer !== actual.answer;
    })) {
    throw new HttpsError("data-loss", "Tournament live deck binding is invalid.");
  }
  return {run, deck: {deckId: run.deckId, locale: run.locale, categoryId: run.categoryId,
    rulesVersion: run.rulesVersion, canonicalRiddleIds: source.riddles.map((riddle: {canonicalRiddleId: string}) => riddle.canonicalRiddleId)}};
}
