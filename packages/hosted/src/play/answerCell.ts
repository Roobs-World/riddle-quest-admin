import {splitGraphemes} from "@riddle-quest/core/game";

/** A bounded answer cell must occupy one grapheme before and after its displayed locale casing. */
export const isSingleAnswerCell = (letter: unknown, locale: string): letter is string =>
  typeof letter === "string" && letter.length > 0 && letter.length <= 32 && Boolean(letter.trim()) &&
  splitGraphemes(letter, locale).length === 1 &&
  splitGraphemes(letter.toLocaleUpperCase(locale), locale).length === 1;
