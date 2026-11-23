import {useLayoutEffect, type RefObject} from "react";

/** Traps focus in the offline alert and blocks obscured physical-keyboard input. */
export function useOfflineDialog(online: boolean, dialogRef: RefObject<HTMLDivElement | null>): void {
  useLayoutEffect(() => {
    if (online) return;
    /** Provides dialog behavior. */
    const dialog = dialogRef.current;
    if (!dialog) return;
    /** Only this committed alert lifetime may claim keyboard or focus events. */
    let listening = true;
    /** Provides previously focused behavior. */
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    /** Provides focus frame behavior. */
    const focusFrame = window.requestAnimationFrame(() => {
      if (listening && dialogRef.current === dialog && dialog.isConnected) dialog.focus();
    });
    /** Provides keep focus in dialog behavior. */
    const keepFocusInDialog = (event: FocusEvent) => {
      if (!listening || dialogRef.current !== dialog || !dialog.isConnected) return;
      if (event.target instanceof Node && !dialog.contains(event.target)) dialog.focus();
    };
    /** Provides block obscured keyboard interaction behavior. */
    const blockObscuredKeyboardInteraction = (event: KeyboardEvent) => {
      if (!listening || dialogRef.current !== dialog || !dialog.isConnected) return;
      if (event.key === "Tab") {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        (/^[a-z]$/i.test(event.key) || ["Backspace", "Enter", "Escape"].includes(event.key))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("focusin", keepFocusInDialog, true);
    document.addEventListener("keydown", blockObscuredKeyboardInteraction, true);
    return () => {
      listening = false;
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("focusin", keepFocusInDialog, true);
      document.removeEventListener("keydown", blockObscuredKeyboardInteraction, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [dialogRef, online]);
}
