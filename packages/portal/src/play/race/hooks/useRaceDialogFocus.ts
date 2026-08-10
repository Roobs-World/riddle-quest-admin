import {useEffect, type RefObject} from "react";

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
  useEffect(() => {
    /** Element focused before the modal race experience opened. */
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    /** Handles escape-to-close and keyboard focus containment. */
    const handleKeyDown = (event: KeyboardEvent) => {
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
      if (focusable.length === 0) return;
      /** First focusable element in the active dialog. */
      const first = focusable[0];
      /** Last focusable element in the active dialog. */
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [dialogRef, dismissQuitConfirmation, quitConfirmationOpen, quitDialogRef, requestClose]);

  useEffect(() => {
    if (!quitConfirmationOpen) return;
    /** Frame used to focus the newly mounted confirmation dialog. */
    const frame = window.requestAnimationFrame(() => quitDialogRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [quitConfirmationOpen, quitDialogRef]);
}
