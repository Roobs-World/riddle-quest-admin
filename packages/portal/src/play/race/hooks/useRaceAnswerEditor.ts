import {useCallback, useRef} from "react";

/** Replacing a question-owned editor retains focus only when the retiring editor owned it. */
export function useRaceAnswerEditor() {
  /** Board cell selection focuses the currently mounted native editor. */
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Remember focus before React removes the old question's input element. */
  const restoreFocus = useRef(false);
  /** Stable imperative ref captures retirement and attaches the next question's editor. */
  const attachInput = useCallback((input: HTMLInputElement | null) => {
    if (!input) {
      restoreFocus.current = inputRef.current !== null && document.activeElement === inputRef.current;
      inputRef.current = null;
      return;
    }
    inputRef.current = input;
    if (restoreFocus.current && !input.disabled) input.focus({preventScroll: true});
    restoreFocus.current = false;
  }, []);
  return {inputRef, attachInput};
}
