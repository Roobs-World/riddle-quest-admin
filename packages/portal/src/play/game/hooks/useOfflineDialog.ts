import {useEffect, type RefObject} from "react";

/** Traps focus in the offline alert and blocks obscured physical-keyboard input. */
export function useOfflineDialog(online: boolean, dialogRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    if (online) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => dialog.focus());
    const keepFocusInDialog = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) dialog.focus();
    };
    const blockObscuredKeyboardInteraction = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (
        !event.ctrlKey && !event.metaKey && !event.altKey &&
        (/^[a-z]$/i.test(event.key) || ["Backspace", "Enter", "Escape"].includes(event.key))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("focusin", keepFocusInDialog, true);
    document.addEventListener("keydown", blockObscuredKeyboardInteraction, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("focusin", keepFocusInDialog, true);
      document.removeEventListener("keydown", blockObscuredKeyboardInteraction, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [dialogRef, online]);
}
