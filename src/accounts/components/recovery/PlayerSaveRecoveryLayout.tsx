import {useSyncExternalStore, type ReactNode} from "react";
import type {PlayerSaveRecovery} from "../../browser/playerState/PlayerSaveRecovery";
import {tr, useLocale} from "../../../localization/browser/i18n";
import {SpinningWheel} from "../../../app/components/feedback/SpinningWheelLoader";
import {useOnlineStatus} from "../../../platform/browser/useOnlineStatus";

/** Reserves space for failed-save recovery while the game remains independently playable. */
export function PlayerSaveRecoveryLayout({recovery, children}: {
  /** Observable target-owned retry controller; SDK calls remain behind the adapter. */
  recovery: Pick<PlayerSaveRecovery, "subscribe" | "getSnapshot" | "wake">;
  /** Existing target game and context providers keep their identities. */
  children: ReactNode;
}) {
  useLocale();
  /** Independent subscription cannot restart target initialization when storage health changes. */
  const status = useSyncExternalStore(recovery.subscribe, recovery.getSnapshot, recovery.getSnapshot);
  /** Offline retries wait for the real online recovery signal. */
  const online = useOnlineStatus();
  return (
    <div className="player-save-layout">
      {status !== "quiet" ? (
        <div className="player-save-notice" role="status" aria-live="polite">
          <p>{tr("GameScreenAlerts.PROGRESS_UNSAVED_MESSAGE")}</p>
          <button className="play-secondary" type="button" disabled={!online || status === "saving"}
            aria-label={tr("CommonButtons.RETRY")} title={tr("CommonButtons.RETRY")} aria-busy={status === "saving"} onClick={() => recovery.wake()}>
            {status === "saving" ? <SpinningWheel /> : (
              <svg className="player-save-retry-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 7v5h-5M20 12a8 8 0 1 0-2.1 5.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span className="player-save-retry-label">{tr("CommonButtons.RETRY")}</span>
          </button>
        </div>
      ) : null}
      <div className="player-save-game">{children}</div>
    </div>
  );
}
