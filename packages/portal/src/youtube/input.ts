import {splitGraphemes} from "@qwordly/core/game";

/** Defines the answer grapheme pattern value. */
const ANSWER_GRAPHEME_PATTERN = /^[\p{L}\p{M}]+$/u;

/** Describes you tube input state. */
export type YouTubeInputState = Readonly<{
  /** Stores letters. */
  letters: string[];
  /** Stores active slot index. */
  activeSlotIndex: number;
}>;

/** Normalizes you tube answer text. */
export function normalizeYouTubeAnswerText(value: string, locale: string): string[] {
  return splitGraphemes(value.normalize("NFC"), locale).filter((grapheme) => ANSWER_GRAPHEME_PATTERN.test(grapheme));
}

/** Provides insert you tube answer text behavior. */
export function insertYouTubeAnswerText(
  state: YouTubeInputState,
  text: string,
  answerLength: number,
  lockedIndices: readonly number[],
  locale: string,
): YouTubeInputState {
  /** Provides graphemes behavior. */
  const graphemes = normalizeYouTubeAnswerText(text, locale);
  if (graphemes.length === 0 || answerLength < 1) return state;
  /** Provides locked behavior. */
  const locked = new Set(lockedIndices);
  /** Provides letters behavior. */
  const letters = Array.from({length: answerLength}, (_, index) => state.letters[index] ?? "");
  /** Provides active behavior. */
  let active = Math.min(Math.max(0, state.activeSlotIndex), answerLength - 1);

  for (const grapheme of graphemes) {
    /** Provides target behavior. */
    const target = Array.from({length: answerLength}, (_, offset) => (active + offset) % answerLength).find(
      (index) => !locked.has(index) && (!letters[index] || index === active),
    );
    if (target === undefined) break;
    letters[target] = grapheme;
    active =
      Array.from({length: answerLength}, (_, offset) => (target + offset + 1) % answerLength).find(
        (index) => !locked.has(index) && !letters[index],
      ) ?? target;
  }
  return {letters, activeSlotIndex: active};
}

/** Deletes you tube answer letter. */
export function deleteYouTubeAnswerLetter(
  state: YouTubeInputState,
  answerLength: number,
  lockedIndices: readonly number[],
): YouTubeInputState {
  /** Provides locked behavior. */
  const locked = new Set(lockedIndices);
  /** Provides letters behavior. */
  const letters = Array.from({length: answerLength}, (_, index) => state.letters[index] ?? "");
  /** Provides target behavior. */
  let target = Math.min(Math.max(0, state.activeSlotIndex), answerLength - 1);
  if (!letters[target] || locked.has(target)) {
    target =
      Array.from({length: answerLength}, (_, offset) => (target - offset - 1 + answerLength) % answerLength).find(
        (index) => !locked.has(index) && Boolean(letters[index]),
      ) ?? target;
  }
  if (locked.has(target)) return state;
  letters[target] = "";
  return {letters, activeSlotIndex: target};
}

/** Indicates whether can show latin shortcut. */
export function canShowLatinShortcut(answer: string): boolean {
  return /^[A-Za-z]+$/u.test(answer.normalize("NFC"));
}

/** Emits the fixed ASCII QWERTY key independent of SDK locale casing rules. */
export function normalizeLatinShortcutKey(letter: string): string {
  return /^[A-Z]$/u.test(letter) ? letter.toLowerCase() : "";
}
