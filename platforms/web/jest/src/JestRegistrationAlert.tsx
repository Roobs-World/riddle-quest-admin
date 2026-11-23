import {useRef} from "react";
import {tr} from "../../../../packages/web-game/src/play/i18n";
import type {JestSession} from "./types";
import {useJestRegistrationDialogFocus} from "./useJestRegistrationDialogFocus";

/** Offers registration or guest continuation while containing focus inside the prompt. */
export function JestRegistrationAlert({
  blocked,
  session,
  onRegister,
  onDismiss,
}: {
  /** Stores blocked. */
  blocked: boolean;
  /** Stores session. */
  session: JestSession;
  /** Stores on register. */
  onRegister: () => void;
  /** Stores on dismiss. */
  onDismiss: () => void;
}) {
  /** Registration choices that own focus while the prompt is open. */
  const dialogRef = useRef<HTMLElement | null>(null);
  useJestRegistrationDialogFocus(dialogRef, blocked);
  return (
    <div className="game-modal-backdrop jest-registration-backdrop" data-analytics-screen="registration_prompt">
      <section
        ref={dialogRef}
        className="game-modal jest-registration-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jest-registration-title"
        inert={blocked ? true : undefined}
      >
        <h2 id="jest-registration-title">{tr("Profile.JEST_REGISTRATION_TITLE")}</h2>
        {session.entryIntent.inviterName ? (
          <p>{tr("Profile.JEST_INVITED_BY", {name: session.entryIntent.inviterName})}</p>
        ) : session.entryIntent.customName ? (
          <p>{tr("Profile.JEST_REGISTRATION_GREETING", {name: session.entryIntent.customName})}</p>
        ) : null}
        <p>{tr("Profile.JEST_REGISTRATION_DESCRIPTION")}</p>
        <button className="play-primary" onClick={onRegister}>
          {tr("Profile.JEST_REGISTER_OR_LOGIN_BUTTON")}
        </button>
        <button className="play-text-button" onClick={onDismiss}>
          {tr("Profile.JEST_PLAY_AS_GUEST_BUTTON")}
        </button>
      </section>
    </div>
  );
}
