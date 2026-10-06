import {useEffect, useRef, useState, type ReactNode} from "react";
import {ListFacebookContextBoardResponseSchema, type ListFacebookContextBoardResponse} from "@qwordly/core/race";
import type {RaceTournamentEntryProps} from "./RaceTournamentEntry";
import {PlatformPlayerOverlay} from "./components/PlatformPlayerOverlay";
import {useRaceDialogFocus} from "./hooks/useRaceDialogFocus";
import {formatRaceTime} from "./logic/racePresentation";
import {tr} from "../i18n";
import {LiveRaceHistory} from "./components/LiveRaceHistory";

/** Presents only the active target's validated, identity-free context standings. */
export function RaceContextBoard({locale, contextBoard, matchmaking, coins, onClose, navigation, presentation, playerOverlay, platformPlayerId, onRematch}:
  RaceTournamentEntryProps & {
    /** Target navigation remains inside the modal focus boundary. */ navigation: ReactNode;
    /** Only the owning destination mounts a new live journey from history. */ onRematch?: Parameters<typeof LiveRaceHistory>[0]["onRematch"];
  }) {
  /** No previous context rows survive a new native context selection. */
  const [board, setBoard] = useState<ListFacebookContextBoardResponse | null>(null);
  /** Retry generation starts a fresh bounded server read. */
  const [retry, setRetry] = useState(0);
  /** Pending reads display existing localized progress copy. */
  const [loading, setLoading] = useState(true);
  /** Read failures expose only localized generic feedback. */
  const [error, setError] = useState(false);
  /** Native invalidation retires a pending response before React runs effect cleanup. */
  const contextRevision = useRef(0);
  /** The context board owns its accessible modal focus boundary. */
  const dialogRef = useRef<HTMLElement | null>(null);
  /** Read-only standings never have a pending quit confirmation. */
  const quitDialogRef = useRef<HTMLDivElement | null>(null);
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: false, dismissQuitConfirmation: () => {}, requestClose: onClose});
  useEffect(() => contextBoard?.onContextChange?.(() => {
    ++contextRevision.current;
    setBoard(null); setError(false); setLoading(true); setRetry(value => value + 1);
  }), [contextBoard]);
  useEffect(() => {
    if (!contextBoard) {setLoading(false); setBoard(null); setError(false); return;}
    /** A retired account, locale, tab or context cannot accept a late read. */
    let current = true;
    /** Capture the provider context generation at read start. */
    const revision = contextRevision.current;
    /** A native signal retires the read synchronously, before effect cleanup. */
    const ownsRead = () => current && revision === contextRevision.current;
    setLoading(true); setBoard(null); setError(false);
    /** An unresponsive provider cannot hold the social board loading indefinitely. */
    const timeout = window.setTimeout(() => {if (ownsRead()) {current = false; setError(true); setLoading(false);}}, 8000);
    void Promise.resolve().then(() => contextBoard!.list(locale)).then(value => {
      if (value === null) {if (ownsRead()) setBoard(null); return;}
      /** Strict response validation precedes rendering any score. */
      const parsed = ListFacebookContextBoardResponseSchema.parse(value);
      if (parsed.locale !== locale) throw new Error("Context board locale mismatch");
      if (ownsRead()) setBoard(parsed);
    }).catch(() => {if (ownsRead()) setError(true);})
      .finally(() => {window.clearTimeout(timeout); if (ownsRead()) setLoading(false);});
    return () => {current = false; window.clearTimeout(timeout);};
  }, [locale, contextBoard, retry]);
  /** The owning target supplies the accessible identity without a provider SDK import. */
  const titleId = `${presentation.titleId}-context`;
  return <section ref={dialogRef} className="race-screen" role="dialog" aria-modal="true" aria-labelledby={titleId}
    tabIndex={-1} data-analytics-screen={`${presentation.analyticsScreen}_context`}>
    <header className="race-topbar"><h1 id={titleId}>{tr("RaceTo10.HUB_ACTIVITY")}</h1>
      <div className="race-topbar-actions"><strong aria-label={tr("Profile.TOTAL_COINS_LABEL")}>{coins.toLocaleString()}</strong>
        <button className="race-close" aria-label={tr("RaceTo10.CLOSE")} onClick={onClose}>×</button></div></header>
    {navigation}
    {playerOverlay && platformPlayerId && <PlatformPlayerOverlay overlay={playerOverlay} playerId={platformPlayerId} />}
    {error && <div className="race-error" role="alert">{tr("RaceTo10.ERROR_GENERIC")}<button onClick={() => setRetry(value => value + 1)}>
      {tr("RaceTo10.RETRY")}</button></div>}
    {contextBoard && (loading || board || error) && <div className="race-panel race-context-panel"><h2>{tr("RaceTo10.RESULTS_TITLE")}</h2>
      {loading ? <p aria-live="polite">{tr("RaceTo10.RESULTS_LOADING")}</p> : board &&
        <ol className="race-context-board" aria-label={tr("RaceTo10.HUB_ACTIVITY")} data-rewards-enabled="false">
          {board.standings.map((standing, index) => <li key={`${standing.rank}-${index}`} aria-current={standing.isCurrentPlayer || undefined}>
            <strong>#{standing.rank}</strong><span dir="ltr">{formatRaceTime(standing.adjustedTimeMs)}</span>
          </li>)}
        </ol>}
    </div>}
    {matchmaking?.live?.history && <LiveRaceHistory key={locale} transport={matchmaking.live} locale={locale} onRematch={onRematch} />}
  </section>;
}
