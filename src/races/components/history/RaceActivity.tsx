import {useRef, type ReactNode} from "react";
import type {RaceTournamentEntryProps} from "../lobby/RaceTournamentEntry";
import {useRaceDialogFocus} from "../../hooks/useRaceDialogFocus";
import {tr} from "../../../localization/browser/i18n";
import {LiveRaceHistory} from "./LiveRaceHistory";

/** Activity presentation retains account-owned live history. */
type RaceActivityProps = RaceTournamentEntryProps & {
  /** Target navigation remains inside the modal focus boundary. */ navigation: ReactNode;
  /** Only the owning destination mounts a new live journey from history. */ onRematch?: Parameters<typeof LiveRaceHistory>[0]["onRematch"];
};

/** Presents the active target's retained live race history. */
export function RaceActivity({locale, matchmaking, coins, onClose, navigation, presentation, onRematch}: RaceActivityProps) {
  /** Activity owns its accessible modal focus boundary. */
  const dialogRef = useRef<HTMLElement | null>(null);
  /** Read-only standings never have a pending quit confirmation. */
  const quitDialogRef = useRef<HTMLDivElement | null>(null);
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: false, dismissQuitConfirmation: () => {}, requestClose: onClose});
  /** The owning target supplies the accessible identity without a provider SDK import. */
  const titleId = `${presentation.titleId}-activity`;
  return <section ref={dialogRef} className="race-screen" role="dialog" aria-modal="true" aria-labelledby={titleId}
    tabIndex={-1} data-analytics-screen={`${presentation.analyticsScreen}_activity`}>
    <header className="race-topbar"><h1 id={titleId}>{tr("RaceTo10.HUB_ACTIVITY")}</h1>
      <div className="race-topbar-actions"><strong aria-label={tr("Profile.TOTAL_COINS_LABEL")}>{coins.toLocaleString()}</strong>
        <button className="race-close" aria-label={tr("RaceTo10.CLOSE")} onClick={onClose}>×</button></div></header>
    {navigation}
    {matchmaking?.live?.history && <LiveRaceHistory key={locale} transport={matchmaking.live} locale={locale} onRematch={onRematch} />}
  </section>;
}

