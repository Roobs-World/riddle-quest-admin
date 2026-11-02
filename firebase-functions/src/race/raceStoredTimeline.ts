import {RACE_RULES, type RaceGhostEvent} from "@riddle-quest/core/race";

/** Retained aggregate authority constrains known history without inventing missing legacy events. */
type TimelineAuthority = {
  /** Immutable question count bounds every event position. */
  deckSize: number;
  /** Current cleared-question count cannot precede retained progress. */
  correctCount: number;
  /** Immutable rules and authored graphemes bound the retained hints on each question. */
  hintLimits: readonly number[];
  /** Known charged actions cannot exceed the aggregate penalties. */
  totalPenaltyMs?: number;
  /** Known hint charges cannot be hidden in skip totals. */
  hintPenaltyMs?: number;
  /** Known skip charges cannot be hidden in hint totals. */
  skipPenaltyMs?: number;
  /** Current question cannot precede retained history. */
  currentPosition?: number;
  /** Active runs must advance after every clearing event. */
  live?: boolean;
  /** Accepted action markers cannot precede recorded scoring clocks. */
  acceptedWallMs?: number;
  /** Fully completed recordings cannot end before their known history. */
  adjustedFinishMs?: number;
};

/** Checks known contiguous event facts and aggregate bounds, including historical non-clearing skips. */
export function raceTimelineAgrees(events: RaceGhostEvent[], authority: TimelineAuthority): boolean {
  if (events.length > RACE_RULES.deckSize * (RACE_RULES.maxHintsPerRiddle + 1)) return false;
  if (authority.totalPenaltyMs !== undefined && !Number.isSafeInteger(authority.totalPenaltyMs) ||
    authority.acceptedWallMs !== undefined && authority.acceptedWallMs < 0) return false;
  /** Charged actions in retained history are a lower bound, never a reconstructed legacy total. */
  let hints = 0, skips = 0;
  /** Retained hints are counted independently for each owned prompt. */
  const questionHints = new Map<number, number>();
  for (const [index, event] of events.entries()) {
    if (![event.wallElapsedMs, event.totalPenaltyMs, event.adjustedElapsedMs].every(Number.isSafeInteger) ||
      event.sequence !== index || event.riddlePosition >= authority.deckSize ||
      event.correctCount > authority.correctCount || event.correctCount > event.riddlePosition + (event.type === "hint" ? 0 : 1) ||
      event.type === "correct" && event.correctCount === 0 || event.totalPenaltyMs < event.penaltyAddedMs ||
      authority.totalPenaltyMs !== undefined && event.totalPenaltyMs > authority.totalPenaltyMs ||
      authority.currentPosition !== undefined && event.riddlePosition > authority.currentPosition ||
      authority.acceptedWallMs !== undefined && event.wallElapsedMs > authority.acceptedWallMs ||
      authority.adjustedFinishMs !== undefined && event.adjustedElapsedMs > authority.adjustedFinishMs) return false;
    /** Previous retained action fixes the next question, minimum cumulative charge and score delta. */
    const previous = events[index - 1];
    if (previous) {
      /** Older skipped questions did not count toward ten; both historical and current scoring remain supported. */
      const delta = event.correctCount - previous.correctCount;
      if (event.wallElapsedMs < previous.wallElapsedMs || event.totalPenaltyMs < previous.totalPenaltyMs + event.penaltyAddedMs ||
        event.riddlePosition !== previous.riddlePosition + (previous.type === "hint" ? 0 : 1) ||
        (event.type === "correct" ? delta !== 1 : event.type === "hint" ? delta !== 0 : delta !== 0 && delta !== 1)) return false;
    }
    if (event.type === "hint") {
      hints += event.penaltyAddedMs;
      /** A missing historical prefix cannot make the retained suffix exceed the actual hint limit. */
      const count = (questionHints.get(event.riddlePosition) ?? 0) + 1;
      questionHints.set(event.riddlePosition, count);
      if (count > authority.hintLimits[event.riddlePosition]) return false;
    }
    if (event.type === "skip") skips += event.penaltyAddedMs;
  }
  /** The current prompt follows clearing events except when the final clearing event ended the run. */
  const last = events.at(-1);
  return !(authority.hintPenaltyMs !== undefined && hints > authority.hintPenaltyMs ||
    authority.skipPenaltyMs !== undefined && skips > authority.skipPenaltyMs ||
    authority.live && last && last.type !== "hint" && authority.currentPosition === last.riddlePosition);
}
