import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from "react";
import {ListFacebookContextBoardResponseSchema, type ListFacebookContextBoardResponse} from "../../contracts/index";
import type {RaceTournamentEntryProps} from "../lobby/RaceTournamentEntry";
import {PlatformPlayerOverlay} from "../social/PlatformPlayerOverlay";
import {useRaceDialogFocus} from "../../hooks/useRaceDialogFocus";
import {formatRaceTime} from "../../presentation/racePresentation";
import {tr} from "../../../localization/browser/i18n";
import {LiveRaceHistory} from "./LiveRaceHistory";

/** Activity presentation keeps context and global history lifetimes independent. */
type RaceContextBoardProps = RaceTournamentEntryProps & {
  /** Explicit chooser acknowledgement refreshes only context standings on providers without notifications. */ refreshRevision?: number;
  /** Target navigation remains inside the modal focus boundary. */ navigation: ReactNode;
  /** Only the owning destination mounts a new live journey from history. */ onRematch?: Parameters<typeof LiveRaceHistory>[0]["onRematch"];
};

/** Presents only the active target's validated, identity-free context standings. */
export function RaceContextBoard({locale, contextBoard, matchmaking, coins, onClose, navigation, presentation, playerOverlay, platformPlayerId, onRematch, refreshRevision = 0}: RaceContextBoardProps) {
  /** The context board owns its accessible modal focus boundary. */
  const dialogRef = useRef<HTMLElement | null>(null);
  /** Read-only standings never have a pending quit confirmation. */
  const quitDialogRef = useRef<HTMLDivElement | null>(null);
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: false, dismissQuitConfirmation: () => {}, requestClose: onClose});
  /** The owning target supplies the accessible identity without a provider SDK import. */
  const titleId = `${presentation.titleId}-context`;
  return <section ref={dialogRef} className="race-screen" role="dialog" aria-modal="true" aria-labelledby={titleId}
    tabIndex={-1} data-analytics-screen={`${presentation.analyticsScreen}_context`}>
    <header className="race-topbar"><h1 id={titleId}>{tr("RaceTo10.HUB_ACTIVITY")}</h1>
      <div className="race-topbar-actions"><strong aria-label={tr("Profile.TOTAL_COINS_LABEL")}>{coins.toLocaleString()}</strong>
        <button className="race-close" aria-label={tr("RaceTo10.CLOSE")} onClick={onClose}>×</button></div></header>
    {navigation}
    {playerOverlay && platformPlayerId && <PlatformPlayerOverlay overlay={playerOverlay} playerId={platformPlayerId} />}
    <RaceContextStandings locale={locale} contextBoard={contextBoard} refreshRevision={refreshRevision} />
    {matchmaking?.live?.history && <LiveRaceHistory key={locale} transport={matchmaking.live} locale={locale} onRematch={onRematch} />}
  </section>;
}

/** Context projection ownership does not remount independent history or the modal. */
type RaceContextStandingsProps = Pick<RaceContextBoardProps, "locale" | "contextBoard" | "refreshRevision">;

/** Clears retired context projections before any replacement child commits. */
function RaceContextStandings(props: RaceContextStandingsProps) {
  /** Provider, methods and language own one immutable standings lifetime. */
  const [lifetime, setLifetime] = useState(() => ({provider: props.contextBoard, read: props.contextBoard?.list,
    subscribe: props.contextBoard?.onContextChange, locale: props.locale, refreshRevision: props.refreshRevision, version: 0}));
  if (lifetime.provider !== props.contextBoard || lifetime.read !== props.contextBoard?.list ||
    lifetime.subscribe !== props.contextBoard?.onContextChange || lifetime.locale !== props.locale ||
    lifetime.refreshRevision !== props.refreshRevision)
    setLifetime({provider: props.contextBoard, read: props.contextBoard?.list, subscribe: props.contextBoard?.onContextChange,
      locale: props.locale, refreshRevision: props.refreshRevision, version: lifetime.version + 1});
  return <RaceContextStandingsPanel key={lifetime.version} {...props} />;
}

/** Owns bounded context reads and native invalidation independently of live history. */
function RaceContextStandingsPanel({locale, contextBoard}: RaceContextStandingsProps) {
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
  /** Each standings consumer can retire its own deferred authority request admission. */
  const pendingRead = useRef<AbortController | null>(null);
  /** Committed retirement rejects native callbacks before passive unsubscribe. */
  const active = useRef(true);
  useLayoutEffect(() => {active.current = true; return () => {active.current = false; pendingRead.current?.abort();};}, []);
  useEffect(() => {
    if (!contextBoard?.onContextChange) return;
    /** StrictMode replay cannot reactivate a callback from its cancelled registration. */
    let current = true;
    /** The original provider owns this native notification method. */
    const stop = contextBoard.onContextChange(() => {
      if (!current || !active.current) return;
      ++contextRevision.current;
      pendingRead.current?.abort();
      setBoard(null); setError(false); setLoading(true); setRetry(value => value + 1);
    });
    return () => {current = false; stop();};
  }, [contextBoard]);
  useEffect(() => {
    if (!contextBoard) {setLoading(false); setBoard(null); setError(false); return;}
    /** A retired account, locale, tab or context cannot accept a late read. */
    let current = true;
    /** Cancellation belongs to this read; shared context membership is still coordinated by the target. */
    const controller = new AbortController();
    pendingRead.current = controller;
    /** Capture the provider context generation at read start. */
    const revision = contextRevision.current;
    /** A native signal retires the read synchronously, before effect cleanup. */
    const ownsRead = () => current && active.current && !controller.signal.aborted && revision === contextRevision.current;
    setLoading(true); setBoard(null); setError(false);
    /** An unresponsive provider cannot hold the social board loading indefinitely. */
    const timeout = window.setTimeout(() => {if (ownsRead()) {current = false; controller.abort(); setError(true); setLoading(false);}}, 8000);
    /** Deferred admission retains the original method and its provider receiver. */
    const read = contextBoard.list;
    void Promise.resolve().then(() => ownsRead() ? read.call(contextBoard, locale, controller.signal) : undefined).then(value => {
      if (!ownsRead()) return;
      if (value === null) {setBoard(null); return;}
      /** Strict response validation precedes rendering any score. */
      const parsed = ListFacebookContextBoardResponseSchema.parse(value);
      if (parsed.locale !== locale) throw new Error("Context board locale mismatch");
      if (ownsRead()) setBoard(parsed);
    }).catch(() => {if (ownsRead()) setError(true);})
      .finally(() => {window.clearTimeout(timeout); if (pendingRead.current === controller) pendingRead.current = null; if (ownsRead()) setLoading(false);});
    return () => {current = false; controller.abort(); if (pendingRead.current === controller) pendingRead.current = null; window.clearTimeout(timeout);};
  }, [locale, contextBoard, retry]);
  return <>
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
  </>;
}
