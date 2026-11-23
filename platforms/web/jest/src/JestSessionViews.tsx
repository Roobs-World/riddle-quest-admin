import {SpinningWheelLoader} from "../../../../src/web/play/SpinningWheelLoader";
import {tr} from "../../../../src/web/play/i18n";
import type {JestStartupUpdate} from "./startup";

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
