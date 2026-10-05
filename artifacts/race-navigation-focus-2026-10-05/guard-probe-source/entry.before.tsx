import {useCallback, useEffect, useRef, useState, type ReactNode, type KeyboardEvent} from "react";
import {ListFacebookTournamentResponseSchema, type ListFacebookTournamentResponse, type LiveRaceView} from "@qwordly/core/race";
import {RaceTo10Game} from "./RaceTo10Game";
import type {RaceTo10GameProps} from "./RaceTo10Game.types";
import {RaceTournamentPanel} from "./components/RaceLobbyPanels";
import {tr} from "../i18n";
import {RaceContextBoard} from "./RaceContextBoard";
import {PlatformPlayerOverlay} from "./components/PlatformPlayerOverlay";
import {LiveRaceGame} from "./LiveRaceGame";
import type {LiveRaceHistory} from "./components/LiveRaceHistory";
import {useRaceDialogFocus} from "./hooks/useRaceDialogFocus";

/** Target-specific identifiers and fixed diagnostics keep provider logic outside shared presentation. */
export type RaceTournamentEntryProps = RaceTo10GameProps & {
  /** Stable target-owned board presentation, with no provider SDK. */
  presentation: {
    /** Accessible title identity retained by the owning target. */ titleId: string;
    /** Existing target analytics screen name. */ analyticsScreen: string;
    /** Reports an optional background record failure. */ onRecordFailure: (error: unknown) => void;
    /** Reports a context result failure independently of official tournaments. */ onContextRecordFailure?: (error: unknown) => void;
  };
};

/** Adds a configured game-owned board alongside live play; the target owns any optional native dialogs. */
export function RaceTournamentEntry(props: RaceTournamentEntryProps) {
  return <RaceTournamentDestination key={JSON.stringify([props.ownerId, props.locale])} {...props} />;
}

/** Available destinations are determined only by the owning target's capabilities. */
type Destination = "play" | "activity" | "tournaments";

/** Account and language lifetimes retire target-owned navigation and result effects. */
function RaceTournamentDestination(props: RaceTournamentEntryProps) {
  /** A native tournament entry selects only the configured official board. */
  const [destination, setDestination] = useState<Destination>(props.tournaments && props.tournamentLocale ? "tournaments" : "play");
  /** Immutable history selection retires Activity and owns one private live journey. */
  const [rematch, setRematch] = useState<Parameters<NonNullable<Parameters<typeof LiveRaceHistory>[0]["onRematch"]>>[0] | null>(null);
  /** Keyboard selection retains focus across destination replacement. */
  const keyboardSelection = useRef(false);
  /** Tab changes retire late native-dialog feedback while retaining the SDK's dialog barrier. */
  const revision = useRef(0);
  /** A synchronous lock contains repeated clicks before disabled controls commit. */
  const choosing = useRef(false);
  /** Visible native chooser state persists across tab changes. */
  const [busy, setBusy] = useState(false);
  /** Accepted native context changes invalidate previously rendered standings. */
  const [contextRevision, setContextRevision] = useState(0);
  /** Native chooser feedback uses existing translated copy. */
  const [contextError, setContextError] = useState(false);
  /** Component lifetime prevents a retired account from accepting dialog feedback. */
  const active = useRef(true);
  useEffect(() => {active.current = true; return () => {active.current = false;};}, []);
  /** Submit opaque tickets independently; optional board failures cannot suppress live completion. */
  const completed = useCallback((view: LiveRaceView) => {
    props.onLiveResult?.(view);
    if (view.result !== "win" || view.player.correctCount !== 10 || !view.run ||
      view.run.runId !== view.ticketId || view.run.locale !== props.locale) return;
    if (props.tournaments) void Promise.resolve().then(() => props.tournaments!.record(view.ticketId, props.locale))
      .catch(props.presentation.onRecordFailure);
    if (props.contextBoard) void Promise.resolve().then(() => props.contextBoard!.record(view.ticketId, props.locale))
      .catch(props.presentation.onContextRecordFailure ?? props.presentation.onRecordFailure);
  }, [props.tournaments, props.contextBoard, props.locale, props.onLiveResult, props.presentation]);
  if (rematch && props.matchmaking?.live?.rematch) return <LiveRaceGame key={rematch.rematchOfTicketId}
    transport={props.matchmaking.live} locale={props.locale} categoryId={rematch.categoryId} rematchOfTicketId={rematch.rematchOfTicketId}
    coins={props.coins} ownerId={props.ownerId} onCompleted={completed}
    onRematch={rematchOfTicketId => setRematch({...rematch, rematchOfTicketId})} onClose={() => setRematch(null)} />;
  /** The target adapter owns context synchronization and the actual native SDK dialog. */
  const choose = async () => {
    if (choosing.current || !props.nativeSocial) return;
    choosing.current = true; setBusy(true); setContextError(false);
    /** Only the initiating tab lifetime may display a chooser failure. */
    const started = revision.current;
    try {
      /** Context membership is synchronized before this success reaches presentation. */
      const result = await props.nativeSocial.chooseContext();
      if (!active.current) return;
      if (result.status === "success") {setContextError(false); setContextRevision(value => value + 1);}
      else if (result.status !== "cancelled" && started === revision.current) setContextError(true);
    } catch {if (active.current && started === revision.current) setContextError(true);}
    finally {choosing.current = false; if (active.current) setBusy(false);}
  };
  if (!props.tournaments && !props.contextBoard && !props.nativeSocial && !props.matchmaking?.live?.history) return <RaceTo10Game {...props} />;
  /** Only supported Activity and tournament capabilities contribute tabs. */
  const destinations: Destination[] = ["play", ...(props.contextBoard || props.matchmaking?.live?.history ? ["activity" as const] : []),
    ...(props.tournaments ? ["tournaments" as const] : [])];
  /** Navigation and optional chooser are restricted to the race lobby and social boards. */
  const navigation = <>
    <RaceTournamentNavigation destination={destination} destinations={destinations} focusSelection={keyboardSelection.current}
      onSelect={(next, keyboard = false) => {revision.current++; setContextError(false); keyboardSelection.current = keyboard; setDestination(next);}} />
    {props.nativeSocial && (destination !== "play" || !props.matchmaking?.live?.chooseChallenge) && <div className="race-hub-social-actions"><button type="button" disabled={busy} onClick={() => void choose()}>
      {tr("RaceTo10.CHOOSE_CONTEXT")}</button></div>}
    {contextError && <div className="race-error" role="alert">{tr("RaceTo10.ERROR_GENERIC")}</div>}
  </>;
  return destination === "tournaments" ? <RaceTournamentBoard {...props} navigation={navigation} />
    : destination === "activity" ? <RaceContextBoard key={contextRevision} {...props} navigation={navigation}
      onRematch={selection => {setDestination("play"); setRematch(selection);}} />
      : <RaceTo10Game {...props} introNavigation={navigation} onLiveResult={completed} />;
}

/** Accessible roving tabs expose only configured target destinations. */
function RaceTournamentNavigation({destination, destinations, focusSelection, onSelect}: {
  /** Current destination. */ destination: Destination;
  /** Capability-filtered destinations in display order. */ destinations: Destination[];
  /** A keyboard navigation must focus the newly mounted selected tab. */ focusSelection: boolean;
  /** Switches presentation without creating or abandoning a race. */ onSelect: (destination: Destination, keyboard?: boolean) => void;
}) {
  /** Roving keyboard focus follows the selected destination. */
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  /** Primitive selection index keeps focus stable during chooser state updates. */
  const selected = destinations.indexOf(destination);
  useEffect(() => {
    if (!focusSelection) return;
    /** Deferred restoration waits for React to mount the selected destination. */
    const frame = window.requestAnimationFrame(() => {
      /** A later native action keeps focus on its current control inside this dialog. */
      const tab = tabs.current[selected];
      const dialog = tab?.closest<HTMLElement>("[role='dialog']");
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && dialog?.contains(focused) && focused.tabIndex >= 0 &&
        !focused.matches(":disabled, [aria-disabled='true']")) return;
      tab?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selected, focusSelection]);
  /** Arrow and endpoint keys select the next supported destination. */
  const key = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    /** Keyboard direction follows the complete supported tab list. */
    const next = event.key === "Home" ? 0 : event.key === "End" ? destinations.length - 1 :
      event.key === "ArrowLeft" ? (index + destinations.length - 1) % destinations.length :
        event.key === "ArrowRight" ? (index + 1) % destinations.length : undefined;
    if (next === undefined) return;
    event.preventDefault(); onSelect(destinations[next], true);
  };
  return <nav className="race-hub-tabs" aria-label={tr("RaceTo10.MULTIPLAYER_BUTTON")}>
    <div role="tablist">{destinations.map((tab, index) => <button key={tab}
      ref={element => {tabs.current[index] = element;}} role="tab" type="button"
      aria-selected={destination === tab} tabIndex={destination === tab ? 0 : -1}
      onClick={() => onSelect(tab)} onKeyDown={event => key(event, index)}>
      {tr(tab === "play" ? "RaceTo10.HUB_PLAY" : tab === "activity" ? "RaceTo10.HUB_ACTIVITY" : "RaceTo10.HUB_TOURNAMENTS")}
    </button>)}</div>
  </nav>;
}

/** Reads only validated official standings; native scores never become game authority. */
function RaceTournamentBoard({locale, tournamentLocale, tournaments, coins, onClose, navigation, presentation, playerOverlay, platformPlayerId}: RaceTournamentEntryProps & {
  /** Target-only navigation stays inside the modal focus boundary. */ navigation: ReactNode;
}) {
  /** Latest exact-schema server standings for the selected game language. */
  const [tournament, setTournament] = useState<ListFacebookTournamentResponse | null>(null);
  /** Read retry generation. */
  const [retry, setRetry] = useState(0);
  /** The board cannot expose a stale score while its read is pending. */
  const [loading, setLoading] = useState(true);
  /** Provider failure is presented through existing localized copy. */
  const [error, setError] = useState<string | null>(tournamentLocale && tournamentLocale !== locale ? "RaceTo10.ERROR_LOCALE_MISMATCH" : null);
  /** Synchronous barrier contains duplicate clicks before React commits disabled controls. */
  const sharing = useRef(false);
  /** Visible provider dialog state. */
  const [busy, setBusy] = useState(false);
  /** Prevents a retired board from accepting late provider or authority responses. */
  const active = useRef(true);
  /** Board owns the same modal focus boundary as live play. */
  const dialogRef = useRef<HTMLElement | null>(null);
  /** No nested quit confirmation exists on a read-only board. */
  const quitDialogRef = useRef<HTMLDivElement | null>(null);
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: false, dismissQuitConfirmation: () => {}, requestClose: onClose});
  useEffect(() => {active.current = true; return () => {active.current = false;};}, []);
  useEffect(() => {
    /** Effect lifetime prevents stale tournament reads from updating a retired board. */
    let current = true;
    setLoading(true); setTournament(null);
    /** A silent provider cannot leave this read-only destination permanently loading. */
    const timeout = window.setTimeout(() => {if (current) {current = false; setError("RaceTo10.ERROR_GENERIC"); setLoading(false);}}, 8000);
    /** Enforces locale and window identity before rendering an official row. */
    const accept = (value: unknown) => {
      /** Validated provider outcome controls the board refresh and localized error state. */
      const result = ListFacebookTournamentResponseSchema.parse(value);
      if (result.locale !== locale) throw new Error("Tournament locale mismatch");
      return result;
    };
    void Promise.resolve().then(() => tournaments!.list(locale)).then(accept).then(value => {if (current) setTournament(value);})
      .catch(() => {if (current) setError("RaceTo10.ERROR_GENERIC");})
      .finally(() => {window.clearTimeout(timeout); if (current) setLoading(false);});
    return () => {current = false; window.clearTimeout(timeout);};
  }, [locale, tournaments, retry]);
  /** Target adapter fetches the fresh official best and owns its SDK dialog guard. */
  const share = async () => {
    if (sharing.current || !tournaments?.share) return;
    sharing.current = true; setBusy(true);
    try {
      /** Validated provider outcome controls the board refresh and localized error state. */
      const result = await tournaments.share(locale);
      if (!active.current) return;
      if (result.status === "success") {setError(null); setRetry(value => value + 1);}
      else if (result.status !== "cancelled") setError(result.message === "RaceTo10.ERROR_LOCALE_MISMATCH"
        ? "RaceTo10.ERROR_LOCALE_MISMATCH" : "RaceTo10.ERROR_GENERIC");
    } catch {if (active.current) setError("RaceTo10.ERROR_GENERIC");}
    finally {sharing.current = false; if (active.current) setBusy(false);}
  };
  return <section ref={dialogRef} className="race-screen" role="dialog" aria-modal="true" aria-labelledby={presentation.titleId}
    tabIndex={-1} data-analytics-screen={presentation.analyticsScreen}>
    <header className="race-topbar"><h1 id={presentation.titleId}>{tr("RaceTo10.HUB_TOURNAMENTS")}</h1>
      <div className="race-topbar-actions"><strong aria-label={tr("Profile.TOTAL_COINS_LABEL")}>{coins.toLocaleString()}</strong>
        <button className="race-close" aria-label={tr("RaceTo10.CLOSE")} onClick={onClose}>×</button></div></header>
    {navigation}
    {playerOverlay && platformPlayerId && <PlatformPlayerOverlay overlay={playerOverlay} playerId={platformPlayerId} />}
    {error && <div className="race-error" role="alert">{tr(error)}<button onClick={() => {setError(null); setRetry(value => value + 1);}}>{tr("RaceTo10.RETRY")}</button></div>}
    <RaceTournamentPanel tournament={tournament} loading={loading} sharing={busy} onShare={tournaments?.share ? () => void share() : undefined} />
  </section>;
}
