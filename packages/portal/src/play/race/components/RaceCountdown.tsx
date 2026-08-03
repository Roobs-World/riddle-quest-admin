import {tr} from "../../i18n";
import {RaceRailHeader} from "./RaceHeader";

/** Displays the synchronized pre-race countdown and multiplayer rail header. */
export function RaceCountdown({
  countdown,
  loading,
  coins,
  onClose,
}: {
  countdown: number;
  loading: boolean;
  coins: number;
  onClose: () => void;
}) {
  /** Visible countdown number or final localized “Go” label. */
  const countdownLabel = countdown > 0 ? countdown : tr("RaceTo10.GO");
  return (
    <div className="race-countdown-layout">
      <div className="race-countdown" aria-live="assertive">
        <span>{countdownLabel}</span>
        <p>{loading ? tr("Accessibility.LOADING") : tr("RaceTo10.FIRST_TO_TEN")}</p>
      </div>
      <aside className="race-scoreboard race-countdown-rail">
        <RaceRailHeader coins={coins} onClose={onClose} />
      </aside>
    </div>
  );
}
