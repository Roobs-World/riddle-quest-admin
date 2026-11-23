import {RACE_MAX_GUESSES_PER_RIDDLE, type RaceRunView} from "../../../core/race";
import {lowerCaseGraphemes, type ScoredGuess} from "../../../core/game";

/** One canonical row recorded at its consumed attempt index. */
type HistoryRow = NonNullable<NonNullable<RaceRunView["currentRiddle"]>["confirmedGuesses"]>[number];
/** Private history facts survive compatible responses that omit optional presentation content. */
export class RaceConfirmedHistory {
  /** Exact run/question identity; advancing to another question retires the former history. */
  private identity: string | null = null;
  /** Immutable rows indexed by consumed attempt, including facts preceding an unknown gap. */
  private rows = new Map<number, HistoryRow>();
  /** Disposal or account replacement releases every retained presentation fact. */
  reset(): void {this.identity = null; this.rows.clear();}
  /** Presents all privately known indexes while leaving unreported intervening attempts blank. */
  attempts(run: RaceRunView): ScoredGuess[] {
    /** Candidate suffix is validated without committing an unowned receipt. */
    const prompt = this.preview(run).currentRiddle;
    if (!prompt) return [];
    /** Earlier facts belong only to this exact run and question. */
    const identity = JSON.stringify([run.runId, run.locale, prompt.position, prompt.riddleId, prompt.answerLength]);
    /** Presentation can represent sparse rows independently of the contiguous wire suffix. */
    const rows = new Map(identity === this.identity ? this.rows : []);
    for (const [offset, row] of (prompt.confirmedGuesses ?? []).entries())
      rows.set(prompt.guessesUsed - (prompt.confirmedGuesses?.length ?? 0) + offset, row);
    return Array.from({length: prompt.guessesUsed}, (_, index) => structuredClone(rows.get(index) ?? {guess: [], feedback: []}));
  }
  /** Validates and constructs candidate history without changing any committed facts. */
  preview(run: RaceRunView): RaceRunView {
    /** Return ownership is independent of the caller's mutable response object. */
    const result = structuredClone(run);
    /** Terminal authority never attaches history to a nonexistent question. */
    const prompt = result.currentRiddle;
    if (!prompt) return result;
    /** Position distinguishes repeated riddles within the same canonical deck. */
    const identity = JSON.stringify([run.runId, run.locale, prompt.position, prompt.riddleId, prompt.answerLength]);
    /** Candidate ledger remains private until an owned response is explicitly committed. */
    const rows = new Map(identity === this.identity ? this.rows : []);
    /** Optional partial history describes the most recent consumed attempts. */
    const history = prompt.confirmedGuesses ?? [];
    if (!Number.isInteger(prompt.guessesUsed) || prompt.guessesUsed < 0 ||
      prompt.guessesUsed > RACE_MAX_GUESSES_PER_RIDDLE || history.length > prompt.guessesUsed) throw new Error("Invalid confirmed race history");
    for (const [offset, row] of history.entries()) {
      /** Authoritative count aligns a partial suffix without moving earlier confirmed attempts. */
      const index = prompt.guessesUsed - history.length + offset;
      /** A previously confirmed attempt cannot acquire another word or feedback. */
      const previous = rows.get(index);
      if (previous && (previous.guess.length !== row.guess.length || previous.feedback.length !== row.feedback.length ||
        previous.guess.some((letter, position) => lowerCaseGraphemes(letter, run.locale).join("") !== lowerCaseGraphemes(row.guess[position], run.locale).join("")) ||
        previous.feedback.some((color, position) => color !== row.feedback[position]))) throw new Error("Changed confirmed race history");
      rows.set(index, structuredClone(row));
    }
    /** Only a contiguous known suffix can be represented by the negotiated wire shape. */
    const suffix: HistoryRow[] = [];
    for (let index = prompt.guessesUsed - 1; index >= 0 && rows.has(index); index--) suffix.unshift(structuredClone(rows.get(index)!));
    if (suffix.length || prompt.confirmedGuesses !== undefined) prompt.confirmedGuesses = suffix;
    return result;
  }
  /** Commits only a validated, still-owned authority receipt after external lifetime checks. */
  accept(run: RaceRunView): RaceRunView {
    /** Validation finishes before any ledger update, so rejected responses preserve prior facts. */
    const candidate = this.preview(run);
    /** The current prompt owns the exact bounded retention scope. */
    const prompt = candidate.currentRiddle;
    if (!prompt) {this.reset(); return candidate;}
    /** A new run or question cannot inherit the previous board's guesses. */
    const identity = JSON.stringify([run.runId, run.locale, prompt.position, prompt.riddleId, prompt.answerLength]);
    if (identity !== this.identity) {this.rows.clear(); this.identity = identity;}
    for (const [offset, row] of (prompt.confirmedGuesses ?? []).entries()) {
      this.rows.set(prompt.guessesUsed - (prompt.confirmedGuesses?.length ?? 0) + offset, structuredClone(row));
    }
    return candidate;
  }
}
