import {SpinningWheelLoader} from "../play/SpinningWheelLoader";
import {tr} from "../play/i18n";
import type {JestSession} from "./types";
import type {JestStartupUpdate} from "./startup";

/** Provides jest startup error behavior. */
export function JestStartupError({message}: {message: string}) {
  return (
    <main className="route-missing">
      <div>
        <h1>Riddle Quest could not start</h1>
        <p>{message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    </main>
  );
}

/** Provides jest startup progress behavior. */
export function JestStartupProgress({startup}: {startup: JestStartupUpdate}) {
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

/** Provides jest registration alert behavior. */
export function JestRegistrationAlert({
  blocked,
  session,
  onRegister,
  onLogin,
  onDismiss,
}: {
  blocked: boolean;
  session: JestSession;
  onRegister: () => void;
  onLogin: () => void;
  onDismiss: () => void;
}) {
  return (
    <aside
      className="play-alert jest-registration-alert"
      data-analytics-screen="registration_prompt"
      inert={blocked ? true : undefined}
    >
      <strong>{tr("Profile.JEST_REGISTRATION_TITLE")}</strong>
      {session.entryIntent.inviterName ? (
        <p>{tr("Profile.JEST_INVITED_BY", {name: session.entryIntent.inviterName})}</p>
      ) : session.entryIntent.customName ? (
        <p>{tr("Profile.JEST_REGISTRATION_GREETING", {name: session.entryIntent.customName})}</p>
      ) : null}
      <p>{tr("Profile.JEST_REGISTRATION_DESCRIPTION")}</p>
      <button className="play-primary compact" onClick={onRegister}>{tr("Profile.JEST_REGISTER_BUTTON")}</button>
      <button className="play-secondary compact" onClick={onLogin}>{tr("Profile.JEST_LOGIN_BUTTON")}</button>
      <button className="play-text-button" onClick={onDismiss}>{tr("Profile.JEST_PLAY_AS_GUEST_BUTTON")}</button>
    </aside>
  );
}
