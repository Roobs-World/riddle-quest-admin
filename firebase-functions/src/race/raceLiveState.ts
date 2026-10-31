import {LIVE_RACE_WIN_COINS, LIVE_RACE_COUNTDOWN_MS, LIVE_RACE_INVITE_MS, LIVE_RACE_WAIT_MS, LiveRaceViewSchema, RACE_RULES, type LiveRaceView} from "@qwordly/core/race";
import {raceOperationAtMs, toRaceRunView, type RaceRunRecord} from "./raceEngine";
import {liveFinishMs} from "./raceLiveScoring";
import type {FacebookLiveContextBinding} from "./facebookLiveContextBinding";

/** Private ticket contains the immutable deck and authenticated owner. */
export type LiveTicket = {
  /** Hash of the latest first-accepted modern join; retries cannot reclaim it. */ activeJoinId?: string;
  /** Original optional Facebook score destination, captured before play. */ facebookContext?: FacebookLiveContextBinding;
  /** Sanitized creator content is retained only as a surviving player's frozen deck source. */ deleted?: boolean;
  /** Private lobbies never enter the public queue or select a bot. */ privateChallenge?: boolean;
  /** Marks a resumable public lobby under the existing join contract. */ waitForPlayer?: true;
  /** Direct invitations reserve acceptance for one server-resolved recipient. */ inviteRecipientId?: string;
  /** Immutable caller-owned terminal seat binds rematch retries and recipient selection. */ rematchOfTicketId?: string;
  /** Authenticated account. */ userId: string;
  /** Scope prevents cross-provider or cross-language pairing. */ pool: string;
  /** Creation and search deadline use the server clock. */ createdAtMs: number;
  /** Last successful lobby poll. */ seenAtMs: number;
  /** Match identity is assigned atomically with the rival's seat. */ matchId?: string;
  /** A retired ticket cannot be requeued by a delayed poll. */ cancelled?: boolean;
  /** Server account identity snapshot. */ player: LiveRaceView["player"];
  /** Private authoritative riddle run. */ run: RaceRunRecord;
};

/** Private invitations retain their lifetime; every public search receives an opponent within seconds. */
export function liveRaceSearchEndsAtMs(ticket: Pick<LiveTicket, "createdAtMs" | "privateChallenge" | "waitForPlayer">): number {
  return ticket.createdAtMs + (ticket.privateChallenge ? LIVE_RACE_INVITE_MS : LIVE_RACE_WAIT_MS);
}
/** Private seat data is replaced as a whole by existing account deletion cleanup. */
type LiveSeatRun = RaceRunRecord & {
  /** Viewer-owned balance includes one-time badge grants after authoritative settlement. */ settlementCoins?: number;
};
/** Both runs and the victory receipt share one transaction lock. */
export type LiveMatch = {
  /** Indexed authenticated participants support deletion even after a ticket is missing. */ participantIds?: string[];
  /** Deleted seats retain no account or display identity and never become live opponents again. */ deletedSeats?: [boolean, boolean];
  /** Seat ticket ids; a null second seat identifies the fallback bot. */ tickets: [string, string | null];
  /** Server start shared by both players. */ startsAtMs: number;
  /** Terminal winner seat, or null for a timed out match. */ winner?: number | null;
  /** Latest accepted observation is shared by both seats and survives clock corrections. */ observedAtMs?: number;
  /** Both private server runs. */ runs: [LiveSeatRun, LiveSeatRun];
  /** Safe account identities. */ players: [LiveRaceView["player"], LiveRaceView["player"]];
  /** Reward grant committed with the winner decision. */ rewardCoins?: number;
  /** Winner balance at settlement, never used as client authority. */ newCoins?: number;
  /** Private immutable link to Facebook referral work committed with the winner grant. */
  facebookReferral?: {
    /** Idempotent referral receipt identity committed with the winner grant. */
    eventId: string;
    /** Winner's private source ticket. */
    ticketId: string;
    /** Authenticated Facebook account that earned the qualifying win. */
    userId: string;
    /** Server settlement time in milliseconds. */
    createdAtMs: number;
  };
  /** Reddit keeps a separate provider binding for its first-win referral work. */
  redditReferral?: {
    /** Idempotent referral receipt identity committed with the winner grant. */
    eventId: string;
    /** Winner's private source ticket. */
    ticketId: string;
    /** Authenticated Reddit account that earned the qualifying win. */
    userId: string;
    /** Server settlement time in milliseconds. */
    createdAtMs: number;
  };
};

/** Creates an unscored server run using existing riddle and hint rules. */
export function liveRun(base: Pick<RaceRunRecord, "riddles" | "locale" | "categoryId" | "contentVersion">,
  userId: string, runId: string, startsAtMs = 0): RaceRunRecord {
  return {...base, runId, userId, deckId: runId, role: "creator", status: startsAtMs ? "scheduled" : "prepared",
    rulesVersion: RACE_RULES.version, rulesSnapshot: RACE_RULES, evaluationPolicy: "server-only",
    currentPosition: 0, correctCount: 0, guessesUsed: 0, guessHistory: [], hintUsed: false,
    revealedLetters: [], readinessAcceptedAtMs: Math.max(0, startsAtMs - LIVE_RACE_COUNTDOWN_MS), startedAtMs: startsAtMs, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []};
}

/** Fixed server-owned interval between fallback bot solves. */
const LIVE_BOT_SOLVE_MS = 12_000;

/** Reads and commands share a persisted clock floor, including pre-marker accepted events and bot progress. */
export function liveOperationAtMs(ticket: LiveTicket, match: LiveMatch | undefined, sampledAtMs: number): number {
  return Math.max(sampledAtMs, ticket.createdAtMs, ticket.seenAtMs, match?.observedAtMs ?? 0,
    ...(match?.runs.map(run => raceOperationAtMs({...run,
      readinessAcceptedAtMs: run.readinessAcceptedAtMs ?? Math.max(0, match.startsAtMs - LIVE_RACE_COUNTDOWN_MS)}, sampledAtMs)) ?? []),
    match?.tickets[1] === null && match.runs[1].correctCount > 0
      ? match.startsAtMs + match.runs[1].correctCount * LIVE_BOT_SOLVE_MS : 0);
}

/** Bot progress is computed live by the authority, never replayed from a recording. */
export function advanceLiveBot(match: LiveMatch, nowMs: number): boolean {
  if (match.tickets[1] !== null || match.winner !== undefined || nowMs < match.startsAtMs) return false;
  /** Provides count behavior. */
  const count = Math.max(match.runs[1].correctCount, Math.min(RACE_RULES.targetCorrect, Math.floor((nowMs - match.startsAtMs) / LIVE_BOT_SOLVE_MS)));
  if (count <= match.runs[1].correctCount) return false;
  match.runs[1] = {...match.runs[1], status: count === RACE_RULES.targetCorrect ? "completed" : "active", correctCount: count,
    lastActionAtMs: Math.max(nowMs, match.runs[1].lastActionAtMs ?? 0),
    ...(count === RACE_RULES.targetCorrect ? {wallFinishMs: count * LIVE_BOT_SOLVE_MS,
      finishedAtMs: match.startsAtMs + count * LIVE_BOT_SOLVE_MS} : {})};
  return true;
}

/** Projects only the viewer's prompt and confirmed rival progress, without either answer. */
export function liveView(ticketId: string, ticket: LiveTicket, match: LiveMatch | undefined, nowMs: number): LiveRaceView {
  /** Viewer projection never predates accepted progress from either seat. */
  const observedAtMs = liveOperationAtMs(ticket, match, nowMs);
  /** Provides seat behavior. */
  const seat = match?.tickets[0] === ticketId ? 0 : 1;
  /** Provides own behavior. */
  const own = match?.runs[seat];
  /** Provides rival behavior. */
  const rival = match?.runs[1 - seat];
  /** Provides terminal behavior. */
  const terminal = match?.winner !== undefined;
  /** Provides run behavior. */
  const run = own ? toRaceRunView(own, observedAtMs, false, true) : null;
  if (run && match) {
    run.opponent = {displayName: match.players[1 - seat].displayName,
      avatarUrl: match.players[1 - seat].avatarUrl, adjustedFinishMs: liveFinishMs(rival!) ?? RACE_RULES.maxAdjustedTimeMs,
      events: []};
    if (terminal) {run.status = "completed"; run.currentRiddle = null;}
    // Neither seat can inspect a question before the same authoritative start boundary.
    else if (observedAtMs < match.startsAtMs) run.currentRiddle = null;
  }
  return LiveRaceViewSchema.parse({ticketId, phase: ticket.cancelled ? "cancelled" : !match ? "searching" :
    terminal ? "result" : observedAtMs < match.startsAtMs ? "countdown" : "racing",
    serverNowMs: observedAtMs, searchEndsAtMs: liveRaceSearchEndsAtMs(ticket), startsAtMs: match?.startsAtMs ?? null,
    ...(ticket.waitForPlayer ? {waitForPlayer: true} : {}),
    player: {...ticket.player, correctCount: own?.correctCount ?? 0},
    opponent: match ? {...match.players[1 - seat], correctCount: rival?.correctCount ?? 0} : null,
    ...(own ? {actionAvailableAtMs: own.startedAtMs} : {}),
    ...(ticket.privateChallenge ? {challengeId: `live_${ticketId}`} : {}),
    run, result: terminal ? match.winner === null ? "tie" : match.winner === seat ? "win" : "loss" : null,
    rewardCoins: terminal && match.winner === seat ? match.rewardCoins ?? 0 : 0,
    ...(terminal && own?.settlementCoins != null ? {newCoins: own.settlementCoins} :
      terminal && match.winner === seat && match.rewardCoins === LIVE_RACE_WIN_COINS ? {newCoins: match.newCoins} : {})});
}
