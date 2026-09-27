import type {RefObject} from "react";
import {tr} from "../../i18n";

/** Confirms abandonment of an active server-authoritative race. */
export function RaceQuitDialog({
  dialogRef,
  error,
  abandoning,
  onCancel,
  onConfirm,
}: {
  /** Stores dialog ref. */
  dialogRef: RefObject<HTMLDivElement | null>;
  /** Stores error. */
  error: string | null;
  /** Stores abandoning. */
  abandoning: boolean;
  /** Stores on cancel. */
  onCancel: () => void;
  /** Stores on confirm. */
  onConfirm: () => void;
}) {
  return (
    <div className="race-quit-backdrop">
      <div
        ref={dialogRef}
        className="race-quit-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="race-quit-title"
        aria-describedby="race-quit-message"
        tabIndex={-1}
      >
        <h2 id="race-quit-title">{tr("RaceTo10.QUIT_TITLE")}</h2>
        <p id="race-quit-message">{tr("RaceTo10.QUIT_MESSAGE")}</p>
        {error && (
          <p className="race-quit-error" role="alert">
            {error}
          </p>
        )}
        <div className="race-quit-actions">
          <button onClick={onCancel} disabled={abandoning}>
            {tr("RaceTo10.KEEP_PLAYING")}
          </button>
          <button className="race-quit-confirm" onClick={onConfirm} disabled={abandoning} aria-busy={abandoning}>
            {abandoning ? tr("RaceTo10.QUITTING") : tr("RaceTo10.QUIT_RACE")}
          </button>
        </div>
      </div>
    </div>
  );
}
