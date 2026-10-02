import {LIVE_RACE_WIN_COINS, LiveRaceViewSchema, RACE_RULES, type LiveRaceView} from "@qwordly/core/race";
import {toRaceRunView, type RaceRunRecord} from "./raceEngine";

/** Private ticket contains the immutable deck and authenticated owner. */
export type LiveTicket = {
  /** Authenticated account. */ userId: string;
  /** Scope prevents cross-provider or cross-language pairing. */ pool: string;
  /** Creation and search deadline use the server clock. */ createdAtMs: number;
  /** Last successful lobby poll. */ seenAtMs: number;
  /** Match identity is assigned atomically with the rival's seat. */ matchId?: string;
  /** A retired ticket cannot be requeued by a delayed poll. */ cancelled?: boolean;
  /** Server account identity snapshot. */ player: LiveRaceView["player"];
  /** Private authoritative riddle run. */ run: RaceRunRecord;
};
/** Both runs and the victory receipt share one transaction lock. */
export type LiveMatch = {
  /** Seat ticket ids; a null second seat identifies the fallback bot. */ tickets: [string, string | null];
  /** Server start shared by both players. */ startsAtMs: number;
  /** Terminal winner seat, or null for a timed out match. */ winner?: number | null;
  /** Both private server runs. */ runs: [RaceRunRecord, RaceRunRecord];
  /** Safe account identities. */ players: [LiveRaceView["player"], LiveRaceView["player"]];
  /** Reward grant committed with the winner decision. */ rewardCoins?: number;
  /** Winner balance at settlement, never used as client authority. */ newCoins?: number;
};

/** Creates an unscored server run using existing riddle and hint rules. */
export function liveRun(base: Pick<RaceRunRecord, "riddles" | "locale" | "categoryId" | "contentVersion">,
  userId: string, runId: string, startsAtMs = 0): RaceRunRecord {
  return {...base, runId, userId, deckId: runId, role: "creator", status: startsAtMs ? "scheduled" : "prepared",
    rulesVersion: RACE_RULES.version, rulesSnapshot: RACE_RULES, evaluationPolicy: "server-only",
    currentPosition: 0, correctCount: 0, guessesUsed: 0, guessHistory: [], hintUsed: false,
    revealedLetters: [], startedAtMs: startsAtMs, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []};
}

/** Bot progress is computed live by the authority, never replayed from a recording. */
export function advanceLiveBot(match: LiveMatch, nowMs: number): boolean {
  if (match.tickets[1] !== null || match.winner !== undefined || nowMs < match.startsAtMs) return false;
  /** Provides count behavior. */
  const count = Math.min(10, Math.floor((nowMs - match.startsAtMs) / 12_000));
  if (count <= match.runs[1].correctCount) return false;
  match.runs[1] = {...match.runs[1], status: "active", correctCount: count};
  if (count === 10) match.winner = 1;
  return true;
}

/** Projects only the viewer's prompt and confirmed rival progress, without either answer. */
export function liveView(ticketId: string, ticket: LiveTicket, match: LiveMatch | undefined, nowMs: number): LiveRaceView {
  /** Provides seat behavior. */
  const seat = match?.tickets[0] === ticketId ? 0 : 1;
  /** Provides own behavior. */
  const own = match?.runs[seat];
  /** Provides rival behavior. */
  const rival = match?.runs[1 - seat];
  /** Provides terminal behavior. */
  const terminal = match?.winner !== undefined;
  /** Provides run behavior. */
  const run = own ? toRaceRunView(own, nowMs, false, true) : null;
  if (run && match) {
    run.opponent = {displayName: match.players[1 - seat].displayName,
      avatarUrl: match.players[1 - seat].avatarUrl, adjustedFinishMs: RACE_RULES.maxAdjustedTimeMs,
      events: []};
    if (terminal) {run.status = "completed"; run.currentRiddle = null;}
  }
  return LiveRaceViewSchema.parse({ticketId, phase: ticket.cancelled ? "cancelled" : !match ? "searching" :
    terminal ? "result" : nowMs < match.startsAtMs ? "countdown" : "racing",
    serverNowMs: nowMs, searchEndsAtMs: ticket.createdAtMs + 60_000, startsAtMs: match?.startsAtMs ?? null,
    player: {...ticket.player, correctCount: own?.correctCount ?? 0},
    opponent: match ? {...match.players[1 - seat], correctCount: rival?.correctCount ?? 0} : null,
    run, result: terminal ? match.winner === null ? "tie" : match.winner === seat ? "win" : "loss" : null,
    rewardCoins: terminal && match.winner === seat ? match.rewardCoins ?? 0 : 0,
    ...(terminal && match.winner === seat && match.rewardCoins === LIVE_RACE_WIN_COINS ? {newCoins: match.newCoins} : {})});
}
