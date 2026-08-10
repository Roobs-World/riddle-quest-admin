import {useEffect} from "react";

/** Describes answer keyboard options. */
export type AnswerKeyboardOptions = {
  /** Stores active. */
  active: boolean;
  /** Stores on letter. */
  onLetter: (letter: string) => void;
  /** Stores on backspace. */
  onBackspace: () => void;
  /** Stores on submit. */
  onSubmit: () => void;
};

/** Maps physical keyboard input to a controlled answer editor while preserving text-field behavior. */
export const useAnswerKeyboard = ({active, onLetter, onBackspace, onSubmit}: AnswerKeyboardOptions): void => {
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editing =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("input, textarea, select, [role='textbox']"));
      if (event.ctrlKey || event.metaKey || event.altKey || editing) return;

      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        onLetter(event.key.toUpperCase());
      } else if (event.key === "Backspace") {
        event.preventDefault();
        onBackspace();
      } else if (event.key === "Enter") {
        event.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, onBackspace, onLetter, onSubmit]);
};
