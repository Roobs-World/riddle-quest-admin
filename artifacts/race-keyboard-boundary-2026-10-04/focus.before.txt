import {useEffect, useEffectEvent, type RefObject} from "react";

/** Parameters used to manage focus within the multiplayer dialogs. */
export type RaceDialogFocusOptions = {
  /** Stores dialog ref. */
  dialogRef: RefObject<HTMLElement | null>;
  /** Stores quit dialog ref. */
  quitDialogRef: RefObject<HTMLDivElement | null>;
  /** Stores quit confirmation open. */
  quitConfirmationOpen: boolean;
  /** Stores dismiss quit confirmation. */
  dismissQuitConfirmation: () => void;
  /** Stores request close. */
  requestClose: () => void;
};

/**
 * Contains keyboard focus within the active multiplayer dialog and restores the
 * previously focused element when the multiplayer experience closes.
 */
export function useRaceDialogFocus({
  dialogRef,
  quitDialogRef,
  quitConfirmationOpen,
  dismissQuitConfirmation,
  requestClose,
}: RaceDialogFocusOptions): void {
  /** Handles keys using the latest dialog state without restarting the focus lifecycle. */
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    // Composition and an earlier control retain ownership of their keyboard event.
    if (event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (quitConfirmationOpen) dismissQuitConfirmation();
      else requestClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    /** Dialog that currently owns keyboard focus. */
    const activeDialog = quitConfirmationOpen ? quitDialogRef.current : dialogRef.current;
    if (!activeDialog) return;
    /** Interactive elements participating in the focus loop. */
    const focusable = Array.from(
      activeDialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      activeDialog.focus({preventScroll: true});
      return;
    }
    /** First focusable element in the active dialog. */
    const first = focusable[0];
    /** Last focusable element in the active dialog. */
    const last = focusable.at(-1)!;
    if (!activeDialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({preventScroll: true});
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  useEffect(() => {
    /** Element focused before the modal race experience opened. */
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [dialogRef]);

  useEffect(() => {
    if (!quitConfirmationOpen) return;
    /** Gameplay control to restore when confirmation is dismissed. */
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    /** Frame used to focus the newly mounted confirmation dialog. */
    const frame = window.requestAnimationFrame(() => quitDialogRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      /** A live race can reclaim focus; a closing race leaves its outer restoration in charge. */
      const raceDialog = dialogRef.current;
      if (!raceDialog?.isConnected || quitDialogRef.current) return;
      if (previousFocus?.isConnected && raceDialog.contains(previousFocus) &&
        !previousFocus.matches(":disabled, [aria-disabled='true']")) previousFocus.focus({preventScroll: true});
      else raceDialog.focus({preventScroll: true});
    };
  }, [dialogRef, quitConfirmationOpen, quitDialogRef]);
}
