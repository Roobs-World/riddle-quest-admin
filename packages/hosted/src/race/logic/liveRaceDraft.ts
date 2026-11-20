import type {LiveRaceView, RaceRiddlePrompt} from "@riddle-quest/core/race";
import {createRaceAttempt, findFirstEditableRaceSlot} from "./racePresentation";
import {editRaceInput, type RaceInputState} from "./raceInput";

/** Local draft revision distinguishes deliberate edits from a submitted answer awaiting delivery. */
export type LiveRaceDraft = RaceInputState & {
  /** Only changed letters advance intent; clock, receipt and focus updates do not. */
  revision: number;
  /** Transient recovery version; untouched restored cells cannot outlive another accepted attempt. */
  recoveredAtGuessesUsed?: number;
};

/** Builds an empty editable attempt while preserving confirmed hint locks. */
export const createLiveRaceDraft = (riddle: RaceRiddlePrompt | null, revision = 0): LiveRaceDraft =>
  ({letters: createRaceAttempt(riddle), activeSlotIndex: findFirstEditableRaceSlot(riddle), revision});

/** Keeps same-question typing across opponent polls and accepted attempts without crossing a seat or position. */
export function reconcileLiveRaceDraft(draft: LiveRaceDraft, previous: LiveRaceView | null, next: LiveRaceView): LiveRaceDraft {
  /** Exact viewer seat, run and question own unsent input independently of the accepted attempt counter. */
  const before = previous?.run?.currentRiddle, riddle = next.run?.currentRiddle;
  if (!riddle || !before || previous?.ticketId !== next.ticketId || previous.run?.runId !== next.run?.runId ||
    previous.run?.locale !== next.run?.locale || before.riddleId !== riddle.riddleId || before.position !== riddle.position ||
    draft.letters.length !== riddle.answerLength || (next.phase !== "racing" && next.phase !== "countdown"))
    return createLiveRaceDraft(riddle ?? null, draft.revision);
  if (draft.recoveredAtGuessesUsed !== undefined && draft.revision === 0 &&
    draft.recoveredAtGuessesUsed !== riddle.guessesUsed) return createLiveRaceDraft(riddle, draft.revision);
  /** Canonical hints replace only their own positions, including newly locked focus. */
  const letters = draft.letters.map((letter, index) => riddle.revealedLetters.find(reveal => reveal.index === index)?.letter ?? letter);
  /** Retain reference identity when a clock or opponent observation changes no local letters. */
  const activeSlotIndex = riddle.revealedLetters.some(reveal => reveal.index === draft.activeSlotIndex)
    ? findFirstEditableRaceSlot(riddle, letters) : draft.activeSlotIndex;
  return activeSlotIndex === draft.activeSlotIndex && letters.every((letter, index) => letter === draft.letters[index])
    ? draft : {...draft, letters, activeSlotIndex};
}

/** Pure editing tracks new answer intent without mutating a submitted checkpoint or authoritative view. */
export function editLiveRaceDraft(riddle: RaceRiddlePrompt, draft: LiveRaceDraft,
  kind: "letter" | "text" | "backspace" | "slot", value: string | number): LiveRaceDraft {
  /** Shared bounded editing policy supports native composition and purchased hint locks. */
  const next = editRaceInput(riddle, draft, kind, value);
  if (next === draft) return draft;
  /** Deliberately emptying a previously edited draft remains a newer intent. */
  const changed = next.letters.some((letter, index) => letter !== draft.letters[index]);
  return {...draft, ...next, revision: draft.revision + Number(changed)};
}

/** An unaccepted command restores its original word only when no newer letters were composed. */
export const rejectLiveRaceDraft = (draft: LiveRaceDraft, submitted: LiveRaceDraft): LiveRaceDraft =>
  draft.revision === submitted.revision ? {...submitted, letters: [...submitted.letters]} : draft;
