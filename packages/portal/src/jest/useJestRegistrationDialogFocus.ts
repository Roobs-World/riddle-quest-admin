import {useEffect, type RefObject} from "react";

/** Keeps keyboard focus within the game-owned Jest registration prompt. */
export function useJestRegistrationDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  blocked: boolean,
): void {
  useEffect(() => {
    /** Mounted registration prompt whose focus belongs to this effect. */
    const dialog = dialogRef.current;
    if (!dialog || blocked) return;
    /** Control that opened the prompt, if it survives dismissal. */
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    /** Enabled controls available for this prompt. */
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"));
    /** Moves focus to the first registration choice. */
    const focusFirst = () => controls()[0]?.focus({preventScroll: true});
    focusFirst();
    /** Recovers focus if an asynchronous update or pointer action moves it outside. */
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };
    /** Wraps Tab between the first and last available choices. */
    const containTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      /** Enabled controls are read again after asynchronous dialog updates. */
      const available = controls();
      /** First control receiving forward Tab wrap. */
      const first = available[0];
      /** Last control receiving backward Tab wrap. */
      const last = available.at(-1);
      if (!first || !last) {
        event.preventDefault();
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("focusin", containFocus, true);
    document.addEventListener("keydown", containTab, true);
    return () => {
      document.removeEventListener("focusin", containFocus, true);
      document.removeEventListener("keydown", containTab, true);
      if (previous?.isConnected && !previous.closest("[inert]")) previous.focus({preventScroll: true});
    };
  }, [blocked, dialogRef]);
}
