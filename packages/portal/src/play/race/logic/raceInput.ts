import type {RaceRiddlePrompt} from "@qwordly/core/race";
import {splitGraphemes} from "@qwordly/core/game";

/** Editable answer state controlled by the multiplayer race screen. */
export type RaceInputState = {
  /** Answer letters indexed by their displayed slot. */
  letters: string[];
  /** Slot that receives the next keyboard action. */
  activeSlotIndex: number;
};

/** Returns whether a slot can be edited without overriding a server hint. */
export const isRaceSlotEditable = (riddle: RaceRiddlePrompt, index: number): boolean =>
  !riddle.revealedLetters.some((revealedLetter) => revealedLetter.index === index);

/** Inserts a letter and advances to the next empty, editable answer slot. */
export const insertRaceLetter = (riddle: RaceRiddlePrompt, state: RaceInputState, letter: string): RaceInputState => {
  if (!isRaceSlotEditable(riddle, state.activeSlotIndex)) return state;
  /** Provides graphemes behavior. */
  const graphemes = splitGraphemes(letter.normalize("NFC"));
  if (graphemes.length !== 1 || !graphemes[0].trim()) return state;

  /** Updated answer attempt after inserting the supplied letter. */
  const letters = Array.from({length: riddle.answerLength}, (_, index) => state.letters[index] ?? "");
  letters[state.activeSlotIndex] = graphemes[0];
  /** Server-revealed positions excluded from automatic selection. */
  const revealedIndexes = new Set(riddle.revealedLetters.map(({index}) => index));
  /** Next empty editable slot after the current position, with wraparound. */
  const nextSlotIndex = Array.from(
    {length: riddle.answerLength},
    (_, offset) => (state.activeSlotIndex + offset + 1) % riddle.answerLength,
  ).find((index) => !revealedIndexes.has(index) && !letters[index]);

  return {
    letters,
    activeSlotIndex: nextSlotIndex ?? state.activeSlotIndex,
  };
};

/** Inserts one committed IME/paste unit atomically, ignoring text beyond the initially editable capacity. */
export const insertRaceText = (riddle: RaceRiddlePrompt, state: RaceInputState, text: string): RaceInputState => {
  /** Provides graphemes behavior. */
  const graphemes = splitGraphemes(text.normalize("NFC")).filter((grapheme) => Boolean(grapheme.trim()));
  if (graphemes.length === 0 || !isRaceSlotEditable(riddle, state.activeSlotIndex)) return state;
  /** Provides revealed indexes behavior. */
  const revealedIndexes = new Set(riddle.revealedLetters.map(({index}) => index));
  /** Provides initial letters behavior. */
  const initialLetters = Array.from({length: riddle.answerLength}, (_, index) => state.letters[index] ?? "");
  /** Provides capacity behavior. */
  const capacity =
    initialLetters.reduce((count, letter, index) => count + (!revealedIndexes.has(index) && !letter ? 1 : 0), 0) +
    (initialLetters[state.activeSlotIndex] ? 1 : 0);
  return graphemes.slice(0, capacity).reduce((current, grapheme) => insertRaceLetter(riddle, current, grapheme), state);
};

/** Deletes the active letter or the nearest previous editable letter. */
export const deleteRaceLetter = (riddle: RaceRiddlePrompt, state: RaceInputState): RaceInputState => {
  /** Server-revealed positions excluded from deletion. */
  const revealedIndexes = new Set(riddle.revealedLetters.map(({index}) => index));
  /** Updated answer attempt from which one letter will be removed. */
  const letters = Array.from({length: riddle.answerLength}, (_, index) => state.letters[index] ?? "");
  /** Editable position selected for deletion. */
  let targetIndex = state.activeSlotIndex;

  if (!letters[targetIndex] || revealedIndexes.has(targetIndex)) {
    targetIndex =
      Array.from(
        {length: riddle.answerLength},
        (_, offset) => (state.activeSlotIndex - offset - 1 + riddle.answerLength) % riddle.answerLength,
      ).find((index) => !revealedIndexes.has(index) && Boolean(letters[index])) ?? state.activeSlotIndex;
  }
  if (revealedIndexes.has(targetIndex)) return state;

  letters[targetIndex] = "";
  return {letters, activeSlotIndex: targetIndex};
};
