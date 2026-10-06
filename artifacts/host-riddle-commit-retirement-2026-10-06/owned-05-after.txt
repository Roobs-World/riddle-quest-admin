import {expect, it} from "@jest/globals";
import type {ScoredGuess} from "@qwordly/core/game";
import {renderToStaticMarkup} from "react-dom/server";
import {ControlledGuessBoard} from "../../GameFrameControls";
import {raceBoardAttempts} from "../logic/raceBoardAttempts";

/** Restored attempts stay consumed even when their historical word and feedback are unavailable. */
it.each([0, 1, 3, 4, 5])("places active input after %i authoritative attempts", used => {
  /** Missing history supplies only empty presentation slots, never fabricated feedback. */
  const guesses = raceBoardAttempts([], used);
  expect(guesses).toEqual(Array.from({length: used}, () => ({guess: [], feedback: []})));
  /** Actual board renders only the remaining editable row after those consumed slots. */
  const html = renderToStaticMarkup(<ControlledGuessBoard answerLength={5} currentLetters={["A", "", "", "", ""]}
    activeSlotIndex={0} hintRevealedIndices={[]} guesses={guesses} onSelectSlot={() => undefined} />);
  expect((html.match(/aria-current="true"/g) ?? []).length).toBe(used < 5 ? 1 : 0);
  expect((html.match(/disabled=""/g) ?? []).length).toBe(used < 5 ? 20 : 25);
  if (used < 5) expect(html.split('class="guess-row"')[used + 1]).toMatch(/>A<\//);
});

/** Available recent feedback follows missing consumed attempts and retains its original colors. */
it("keeps known feedback and an optimistic pending row without duplicating attempts", () => {
  /** One accepted wrong answer remains available after an earlier cold recovery. */
  const known: ScoredGuess[] = [{guess: [..."wrong"], feedback: ["grey", "grey", "grey", "grey", "grey"]}];
  expect(raceBoardAttempts(known, 3)).toEqual([{guess: [], feedback: []}, {guess: [], feedback: []}, ...known]);
  expect(raceBoardAttempts(known, 0)).toBe(known);
});

/** A newly projected wrong answer follows every consumed attempt, including missing history. */
it.each([1, 3, 4])("reserves the projected attempt after %i restored consumed rows", used => {
  /** Only the newest provisional answer is known after cold resume. */
  const known: ScoredGuess[] = [{guess: [..."wrong"], feedback: ["grey", "grey", "grey", "grey", "grey"]}];
  /** Explicit same-question projection advances the display count before server confirmation. */
  const guesses = raceBoardAttempts(known, used, true);
  expect(guesses).toHaveLength(used + 1);
  expect(guesses[used]).toEqual(known[0]);
  /** Hints apply only to the next editable attempt, never consumed placeholder rows. */
  const html = renderToStaticMarkup(<ControlledGuessBoard answerLength={5} currentLetters={["P", "", "", "", ""]}
    activeSlotIndex={1} hintRevealedIndices={[0]} guesses={guesses} onSelectSlot={() => undefined} />);
  expect((html.match(/aria-current="true"/g) ?? []).length).toBe(used < 4 ? 1 : 0);
  if (used < 4) expect(html.split('class="guess-row"')[used + 2]).toMatch(/>P<\//);
});

/** A correct answer's projected successor has its own untouched attempt count. */
it("keeps successor input on its first row and preserves complete optimistic history", () => {
  expect(raceBoardAttempts([], 0, false)).toEqual([]);
  /** Full history already contains its provisional answer and needs no duplicate row. */
  const known: ScoredGuess[] = Array.from({length: 4}, () => ({guess: [..."wrong"], feedback: ["grey", "grey", "grey", "grey", "grey"]}));
  expect(raceBoardAttempts(known, 3, true)).toBe(known);
});
