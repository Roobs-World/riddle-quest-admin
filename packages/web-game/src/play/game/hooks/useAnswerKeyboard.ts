import {useLayoutEffect, useRef} from "react";

/** Describes answer keyboard options. */
export type AnswerKeyboardOptions = {
  /** Stores active. */
  active: boolean;
  /** Immutable content locale owns physical-key casing. */
  locale?: string;
  /** Stores on letter. */
  onLetter: (letter: string) => void;
  /** Stores on backspace. */
  onBackspace: () => void;
  /** Stores on submit. */
  onSubmit: () => void;
};

/** Maps physical keyboard input to a controlled answer editor while preserving text-field behavior. */
export const useAnswerKeyboard = ({active, locale = "en", onLetter, onBackspace, onSubmit}: AnswerKeyboardOptions): void => {
  /** Native subscriptions follow the committed editor without replacement after each answer edit. */
  const optionsRef = useRef({active, locale, onLetter, onBackspace, onSubmit});
  useLayoutEffect(() => {optionsRef.current = {active, locale, onLetter, onBackspace, onSubmit};},
    [active, locale, onLetter, onBackspace, onSubmit]);
  useLayoutEffect(() => {
    // Retire the listener before parent layout callbacks can reach a removed editor.
    if (!active) return;
    /** Removed browser callbacks cannot edit a later active answer. */
    let listening = true;
    /** Handles key down. */
    const handleKeyDown = (event: KeyboardEvent) => {
      /** Current editor ownership and callbacks, refreshed when its visible state commits. */
      const options = optionsRef.current;
      if (!listening || !options.active) return;
      /** Provides target behavior. */
      const target = event.target;
      /** Provides editing behavior. */
      const editing =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("input, textarea, select, [role='textbox']"));
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || editing) return;
      // Enter belongs to a focused control's native activation, including nested targets.
      if (event.key === "Enter" && target instanceof Element &&
        target.closest("button, a[href], summary, [role='button'], [role='link']")) return;

      if (/^[a-z]$/i.test(event.key) || options.locale === "tr" && /^[İı]$/.test(event.key)) {
        event.preventDefault();
        options.onLetter(event.key.toLocaleUpperCase(options.locale));
      } else if (event.key === "Backspace") {
        event.preventDefault();
        options.onBackspace();
      } else if (event.key === "Enter") {
        event.preventDefault();
        options.onSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { listening = false; window.removeEventListener("keydown", handleKeyDown); };
  }, [active]);
};
