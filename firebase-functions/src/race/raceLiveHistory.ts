import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {LIVE_RACE_HISTORY_MS, ListLiveRaceHistoryRequestSchema, ListLiveRaceHistoryResponseSchema,
  LiveRaceHistoryEntrySchema, RaceCategoryIdSchema, type ListLiveRaceHistoryRequest, type LiveRaceHistoryEntry} from "../../../src/core/race/index.js";
import {admin} from "../shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../shared/accountDeletion";
import {resolveLiveRaceSafetyTarget} from "../social/liveRaceSafetyTarget";
import {raceProviderScope} from "./raceEligibility";
import type {LiveMatch, LiveTicket} from "./raceLiveState";

/** Public result history uses a bounded private read, never a second settlement path. */
export async function listLiveRaceHistoryForUser(userId: string, request: ListLiveRaceHistoryRequest,
  options: {
    /** Loopback database seam for real-engine tests. */
    db?: FirebaseFirestore.Firestore;
    /** Server clock override for deterministic retained-window fixtures. */
    nowMs?: number;
  } = {}) {
  /** Caller may select content language and count, never another user's account. */
  const input = ListLiveRaceHistoryRequestSchema.parse(request), provider = raceProviderScope(userId);
  /** All ownership, privacy and logical retention checks share one snapshot. */
  const db = options.db ?? admin.firestore(), nowMs = options.nowMs ?? Date.now();
  if (!["facebook", "reddit"].includes(provider ?? "") || !Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > 8_640_000_000_000_000)
    throw new HttpsError("permission-denied", "Live history unavailable.");
  return db.runTransaction(async tx => {
    /** A deletion that commits before this read cannot expose retained private results. */
    const [owner, deletion] = await Promise.all([tx.get(db.doc(`users/${userId}`)), tx.get(getJestAccountDeletionRef(db, userId))]);
    assertJestAccountActive(deletion);
    if (!owner.exists) throw new HttpsError("not-found", "Player profile unavailable.");
    /** Forty recent owned tickets bound cost while omitting searching and unsettled matches. */
    const rows = await tx.get(db.collection("liveRaceTickets").where("userId", "==", userId).where("run.locale", "==", input.locale)
      .where("createdAtMs", ">=", Math.max(0, nowMs - LIVE_RACE_HISTORY_MS)).where("createdAtMs", "<=", nowMs)
      .orderBy("createdAtMs", "desc").limit(40));
    /** Private row projections run concurrently within the same read-only transaction. */
    const projected = await Promise.all(rows.docs.map(async row => {
      /** Ticket authority comes only from the owner-filtered private collection. */
      const ticket = row.data() as LiveTicket & {
        /** Firestore retention deadline for the private seat. */
        expiresAt?: FirebaseFirestore.Timestamp;
      };
      if (!/^[a-f0-9]{64}$/.test(row.id) || ticket.deleted || ticket.userId !== userId || ticket.run?.userId !== userId ||
        ticket.run?.runId !== row.id || ticket.run?.locale !== input.locale || !RaceCategoryIdSchema.safeParse(ticket.run?.categoryId).success ||
        ticket.pool !== createHash("sha256").update(`${provider}:${input.locale}:${ticket.run.categoryId}`).digest("hex") ||
        typeof ticket.matchId !== "string" || !/^[a-f0-9]{64}$/.test(ticket.matchId) ||
        !ticket.expiresAt || typeof ticket.expiresAt.toMillis !== "function" || !Number.isFinite(ticket.expiresAt.toMillis()) || nowMs >= ticket.expiresAt.toMillis()) return null;
      /** Only a committed terminal receipt supplies result, progress and the already granted reward. */
      const match = (await tx.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data() as (LiveMatch & {
        /** Firestore retention deadline for the settled authority receipt. */
        expiresAt?: FirebaseFirestore.Timestamp;
      }) | undefined;
      if (!match || !Array.isArray(match.tickets) || match.tickets.length !== 2 || match.tickets[0] !== ticket.matchId ||
        match.tickets[0] === match.tickets[1] || !Array.isArray(match.runs) || match.runs.length !== 2 ||
        !Array.isArray(match.players) || match.players.length !== 2 || ![0, 50].includes(match.rewardCoins ?? -1) ||
        ![0, 1, null].includes(match.winner as number | null) || !match.expiresAt || typeof match.expiresAt.toMillis !== "function" ||
        !Number.isFinite(match.expiresAt.toMillis()) || nowMs >= match.expiresAt.toMillis()) return null;
      /** Exactly one seat must remain bound to this owned ticket and private run. */
      const seat = match.tickets.indexOf(row.id), rivalSeat = 1 - seat;
      if (seat < 0 || match.deletedSeats?.[seat] || match.runs[seat]?.userId !== userId || match.runs[seat]?.runId !== row.id ||
        match.runs[seat]?.locale !== input.locale || match.runs[seat]?.categoryId !== ticket.run.categoryId ||
        match.runs[seat]?.startedAtMs !== match.startsAtMs || match.players[seat]?.bot !== false ||
        !Number.isSafeInteger(match.startsAtMs) || match.startsAtMs < 0 || match.startsAtMs > nowMs) return null;
      /** Unavailable humans are anonymous and cannot receive another safety action from this row. */
      let available = false;
      /** Bots are identified by both the null seat and the committed bot marker. */
      const bot = match.tickets[rivalSeat] === null && match.players[rivalSeat]?.bot === true;
      /** Default projection retains no copied human name, image or level. */
      let opponent = {displayName: "Riddle Quest player", avatarUrl: null as string | null, bot, correctCount: 0, level: 1};
      if (bot) opponent.correctCount = match.runs[rivalSeat]?.correctCount;
      else {
        /** Existing safety authority rejects corrupt, foreign, cancelled, deleted and expired human bindings. */
        let rivalId: string | undefined;
        try {rivalId = await resolveLiveRaceSafetyTarget(tx, db, userId, row.id, nowMs);} catch (error) {
          if (!(error instanceof HttpsError)) throw error;
        }
        if (rivalId) {
          /** Both block directions and the current game-owned profile are checked before projection. */
          const [rival, block, reverse] = await Promise.all([tx.get(db.doc(`users/${rivalId}`)),
            tx.get(db.doc(`users/${userId}/blockedRivals/${rivalId}`)), tx.get(db.doc(`users/${rivalId}/blockedRivals/${userId}`))]);
          if (!block.exists && !reverse.exists && rival.exists) {
            /** Sanitized current account fields avoid resurrecting a retired copied profile. */
            const profile = rival.data()!;
            opponent = {displayName: typeof profile.username === "string" && profile.username.trim() ? profile.username.trim().slice(0, 80) : "Riddle Quest player",
              avatarUrl: typeof profile.avatarUrl === "string" && /^https:\/\//.test(profile.avatarUrl) ? profile.avatarUrl : null,
              bot: false, correctCount: match.runs[rivalSeat].correctCount,
              level: Number.isSafeInteger(profile.level) && profile.level > 0 ? profile.level : 1};
            available = true;
          }
        }
      }
      /** Strict public schema rejects a malformed committed score without exposing its private source. */
      const result = LiveRaceHistoryEntrySchema.safeParse({ticketId: row.id, categoryId: ticket.run.categoryId, createdAtMs: ticket.createdAtMs,
        result: match.winner === null ? "tie" : match.winner === seat ? "win" : "loss", correctCount: match.runs[seat].correctCount,
        opponent, opponentAvailable: available, rewardCoins: match.winner === seat ? match.rewardCoins : 0});
      return result.success ? result.data : null;
    }));
    return ListLiveRaceHistoryResponseSchema.parse({locale: input.locale, serverNowMs: nowMs,
      entries: projected.filter((entry): entry is LiveRaceHistoryEntry => entry !== null).slice(0, input.limit)});
  });
}
