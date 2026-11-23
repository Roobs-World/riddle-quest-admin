import {getConfirmedRiddleWin} from "./ConfirmedRiddleOutcome";
import type {GameSessionState} from "../gameSessionTypes";

/** Recovered Classic wins need confirmed progression; provisional Classic and duplicate reads remain responsive. */
export function isCompletionAdvancePending(state: Pick<GameSessionState, "riddle" | "profile" | "guessPending" | "completionAcknowledged">): boolean {
  if (state.riddle?.gameMode === "challenge") return state.guessPending || !state.completionAcknowledged;
  if (state.completionAcknowledged || !state.riddle || !getConfirmedRiddleWin(state.riddle)) return false;
  /** Only exact authority indices can prove that this completed round has a successor. */
  const current = state.riddle.index, next = state.profile?.classicIndex;
  return typeof current !== "number" || typeof next !== "number" ||
    !Number.isSafeInteger(current) || !Number.isSafeInteger(next) || next <= current;
}

/** Stable identity shared by provisional presentation and authoritative confirmation. */
export type CompletionIdentity = Readonly<{
  /** Canonical riddle identifier. */ riddleId: string;
  /** Immutable issued session identifier. */ sessionToken: string;
}>;
/** Correlates one riddle presentation independently of the currently visible question. */
export function completionPresentationKey(outcome: CompletionIdentity): string {
  return JSON.stringify([outcome.riddleId, outcome.sessionToken]);
}
/** Joins confirmation and completed presentation in either order, consuming each outcome once. */
export class CompletionPresentation {
  /** Facts retained until both independent operations have completed. */
  private readonly outcomes = new Map<
    string,
    {
      /** Stores confirmed. */
      confirmed: boolean;
      /** Stores dismissed. */
      dismissed: boolean;
      /** Stores consumed. */
      consumed: boolean;
    }
  >();
  /** Records an eligible authoritative win without assuming its popup is still visible. */
  confirm(key: string): boolean {
    return this.advance(key, "confirmed");
  }
  /** Records victory, achievements and guidance dismissal for this exact issued outcome. */
  dismiss(key: string): boolean {
    return this.advance(key, "dismissed");
  }
  /** Atomically consumes the join so duplicate confirmations/events cannot reopen presentation. */
  private advance(key: string, fact: "confirmed" | "dismissed"): boolean {
    /** Provides outcome behavior. */
    const outcome = this.outcomes.get(key) ?? {confirmed: false, dismissed: false, consumed: false};
    outcome[fact] = true;
    this.outcomes.set(key, outcome);
    if (!outcome.confirmed || !outcome.dismissed || outcome.consumed) return false;
    outcome.consumed = true;
    return true;
  }
}
