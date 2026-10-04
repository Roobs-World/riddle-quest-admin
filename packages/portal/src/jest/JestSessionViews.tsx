import {useRef} from "react";
import {SpinningWheelLoader} from "../play/SpinningWheelLoader";
import {tr} from "../play/i18n";
import type {JestSession} from "./types";
import type {JestStartupUpdate} from "./startup";
import {useJestRegistrationDialogFocus} from "./useJestRegistrationDialogFocus";

/** Provides jest startup error behavior. */
export function JestStartupError({
  message,
}: {
  /** Stores message. */ /** Stores message. */ /** Stores message. */
  message: string;
}) {
  return (
    <main className="route-missing">
      <div role="alert">
        <h1>{tr("ErrorMessages.FATAL_STARTUP_TITLE")}</h1>
        <p>{message}</p>
        <button onClick={() => window.location.reload()}>{tr("CommonButtons.RETRY")}</button>
      </div>
    </main>
  );
}

/** Provides jest startup progress behavior. */
export function JestStartupProgress({
  startup,
}: {
  /** Stores startup. */ /** Stores startup. */
  startup: JestStartupUpdate;
}) {
  /** Provides message key behavior. */
  const messageKey = {
    connecting: "WebPortal.STARTUP_CONNECTING",
    player: "WebPortal.STARTUP_PLAYER",
    progress: "WebPortal.STARTUP_PROGRESS",
    game: "WebPortal.STARTUP_GAME",
  }[startup.stage];
  return (
    <main className="route-loading">
      <SpinningWheelLoader message={tr(messageKey)} progress={startup.progress} />
    </main>
  );
}

/** Shows a terminal state after authoritative account deletion and local cleanup succeed. */
export function JestAccountDeleted() {
  return (
    <main className="route-missing">
      <div role="status">
        <h1>{tr("Profile.DELETE_ACCOUNT_SUCCESS_TITLE")}</h1>
        <p>{tr("Profile.DELETE_ACCOUNT_SUCCESS_MESSAGE")}</p>
      </div>
    </main>
  );
}

/** Provides jest registration alert behavior. */
export function JestRegistrationAlert({
  blocked,
  session,
  onRegister,
  onLogin,
  onDismiss,
}: {
  /** Stores blocked. */
  blocked: boolean;
  /** Stores session. */
  session: JestSession;
  /** Stores on register. */
  onRegister: () => void;
  /** Stores on login. */
  onLogin: () => void;
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
          {tr("Profile.JEST_REGISTER_BUTTON")}
        </button>
        <button className="play-secondary" onClick={onLogin}>
          {tr("Profile.JEST_LOGIN_BUTTON")}
        </button>
        <button className="play-text-button" onClick={onDismiss}>
          {tr("Profile.JEST_PLAY_AS_GUEST_BUTTON")}
        </button>
      </section>
    </div>
  );
}
