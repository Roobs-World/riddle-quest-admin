import {tr} from "../../i18n";
import {RaceRailHeader} from "./RaceHeader";

/** Displays the synchronized pre-race countdown and multiplayer rail header. */
export function RaceCountdown({
  countdown,
  loading,
  loadingProgress,
  closing = false,
  coins,
  onClose,
}: {
  /** Stores countdown. */
  countdown: number;
  /** Stores loading. */
  loading: boolean;
  /** Percentage of the complete multiplayer deck prepared for play. */
  loadingProgress: number;
  /** Whether close was requested while the authoritative run was starting. */
  closing?: boolean;
  /** Stores coins. */
  coins: number;
  /** Stores on close. */
  onClose: () => void;
}) {
  /** Visible countdown number or final localized “Go” label. */
  const countdownLabel = countdown > 0 ? countdown : tr("RaceTo10.GO");
  return (
    <div className="race-countdown-layout">
      <div className="race-countdown" aria-live="assertive">
        {loading ? (
          <div
            className="race-loading-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={loadingProgress}
          >
            <strong>{loadingProgress}%</strong>
            <div className="race-loading-track" aria-hidden="true">
              <span style={{width: `${loadingProgress}%`}} />
            </div>
          </div>
        ) : <span>{countdownLabel}</span>}
        <p>{closing ? tr("RaceTo10.QUITTING") : loading ? tr("Accessibility.LOADING") : tr("RaceTo10.FIRST_TO_TEN")}</p>
      </div>
      <aside className="race-scoreboard race-countdown-rail">
        <RaceRailHeader coins={coins} onClose={onClose} closeBusy={closing} />
      </aside>
    </div>
  );
}
