import {useCallback, useEffect, useRef, useState, type ReactNode, type KeyboardEvent} from "react";
import {ListFacebookTournamentResponseSchema, type ListFacebookTournamentResponse, type LiveRaceView, type LiveRaceCapability} from "../../contracts/index";
import {RaceTo10Game} from "../recorded/RaceTo10Game";
import type {RaceTo10GameProps} from "../recorded/RaceTo10Game.types.ts";
import {RaceTournamentPanel} from "./RaceLobbyPanels";
import {tr} from "../../../localization/browser/i18n";
import {RaceActivity} from "../history/RaceActivity";
import {LiveRaceGame} from "../live/LiveRaceGame";
import type {LiveRaceHistory} from "../history/LiveRaceHistory";
import {useRaceDialogFocus} from "../../hooks/useRaceDialogFocus";

/** Target-specific identifiers and fixed diagnostics keep provider logic outside shared presentation. */
export type RaceTournamentEntryProps = RaceTo10GameProps & {
  /** Stable target-owned board presentation, with no provider SDK. */
  presentation: {
    /** Accessible title identity retained by the owning target. */ titleId: string;
    /** Existing target analytics screen name. */ analyticsScreen: string;
    /** Reports an optional background record failure. */ onRecordFailure: (error: unknown) => void;
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
  /** The selected destination must remain available before any child commits. */
  const destinations: Destination[] = ["play", ...(props.matchmaking?.live?.history ? ["activity" as const] : []),
    ...(props.tournaments ? ["tournaments" as const] : [])];
  /** A native tournament entry selects only the configured official board. */
  const [destination, setDestination] = useState<Destination>(props.tournaments && props.tournamentLocale ? "tournaments" : "play");
  /** Immutable history selection retires Activity and owns one private live journey. */
  const [rematch, setRematch] = useState<(Parameters<NonNullable<Parameters<typeof LiveRaceHistory>[0]["onRematch"]>>[0] & {
    /** The history selection belongs only to this authenticated provider. */ transport: LiveRaceCapability;
    /** Withdrawal or replacement of this operation retires the selected rematch. */ create: NonNullable<LiveRaceCapability["rematch"]>;
  }) | null>(null);
  if (rematch && (rematch.transport !== props.matchmaking?.live || rematch.create !== props.matchmaking?.live?.rematch)) {
    // Align before children commit; an abandoned render cannot retire the original journey.
    setRematch(null);
  }
  /** Keyboard selection retains focus across destination replacement. */
  const keyboardSelection = useRef(false);
  if (!destinations.includes(destination)) setDestination("play");
  /** Submit opaque tickets independently; optional board failures cannot suppress live completion. */
  const completed = useCallback((view: LiveRaceView) => {
    props.onLiveResult?.(view);
    if (view.result !== "win" || view.player.correctCount !== 10 || !view.run ||
      view.run.runId !== view.ticketId || view.run.locale !== props.locale) return;
    if (props.tournaments) void Promise.resolve().then(() => props.tournaments!.record(view.ticketId, props.locale))
      .catch(props.presentation.onRecordFailure);
  }, [props.tournaments, props.locale, props.onLiveResult, props.presentation]);
  if (rematch && props.matchmaking?.live?.rematch) return <LiveRaceGame key={rematch.rematchOfTicketId}
    transport={rematch.transport} locale={props.locale} categoryId={rematch.categoryId} rematchOfTicketId={rematch.rematchOfTicketId}
    coins={props.coins} ownerId={props.ownerId} localPlayer={props.localPlayer} onCompleted={completed}
    onRematch={rematchOfTicketId => setRematch({...rematch, rematchOfTicketId})} onClose={() => setRematch(null)} />;
  if (!props.tournaments && !props.matchmaking?.live?.history) return <RaceTo10Game {...props} />;
  const navigation = <RaceTournamentNavigation destination={destination} destinations={destinations} focusSelection={keyboardSelection.current}
    onSelect={(next, keyboard = false) => {keyboardSelection.current = keyboard; setDestination(next);}} />;
  return destination === "tournaments" ? <RaceTournamentBoard {...props} navigation={navigation} />
    : destination === "activity" ? <RaceActivity {...props} navigation={navigation}
      onRematch={selection => {
        /** Only the capability that admitted this selection may create its private journey. */
        const transport = props.matchmaking?.live;
        if (!transport?.rematch) return;
        setDestination("play"); setRematch({...selection, transport, create: transport.rematch});
      }} />
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
      /** Mounted selected tab provides this destination's current dialog scope. */
      const tab = tabs.current[selected];
      /** Destination replacement mounts a separate modal focus boundary. */
      const dialog = tab?.closest<HTMLElement>("[role='dialog']");
      /** A later native action keeps focus on its current eligible dialog control. */
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
    // An already selected destination keeps this tab mounted and needs no deferred restoration.
    if (next === selected) tabs.current[next]?.focus();
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

/** Tournament presentation retains the owning target's navigation and provider contract. */
type RaceTournamentBoardProps = RaceTournamentEntryProps & {
  /** Target-only navigation stays inside the modal focus boundary. */ navigation: ReactNode;
};

/** Retires provider projections and native feedback before a replacement board commits. */
function RaceTournamentBoard(props: RaceTournamentBoardProps) {
  /** Immutable read ownership keeps abandoned renders independent of the committed board. */
  const [lifetime, setLifetime] = useState(() => ({provider: props.tournaments, read: props.tournaments?.list,
    locale: props.locale, tournamentLocale: props.tournamentLocale, version: 0}));
  if (lifetime.provider !== props.tournaments || lifetime.read !== props.tournaments?.list ||
    lifetime.locale !== props.locale || lifetime.tournamentLocale !== props.tournamentLocale)
    setLifetime({provider: props.tournaments, read: props.tournaments?.list, locale: props.locale,
      tournamentLocale: props.tournamentLocale, version: lifetime.version + 1});
  return <RaceTournamentBoardPanel key={lifetime.version} {...props} />;
}

/** Reads only validated official standings; native scores never become game authority. */
function RaceTournamentBoardPanel({locale, tournamentLocale, tournaments, coins, onClose, navigation, presentation}: RaceTournamentBoardProps) {
  /** Latest exact-schema server standings for the selected game language. */
  const [tournament, setTournament] = useState<ListFacebookTournamentResponse | null>(null);
  /** Read retry generation. */
  const [retry, setRetry] = useState(0);
  /** The board cannot expose a stale score while its read is pending. */
  const [loading, setLoading] = useState(true);
  /** Provider failure is presented through existing localized copy. */
  const [error, setError] = useState<string | null>(tournamentLocale && tournamentLocale !== locale ? "RaceTo10.ERROR_LOCALE_MISMATCH" : null);
  /** Board owns the same modal focus boundary as live play. */
  const dialogRef = useRef<HTMLElement | null>(null);
  /** No nested quit confirmation exists on a read-only board. */
  const quitDialogRef = useRef<HTMLDivElement | null>(null);
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: false, dismissQuitConfirmation: () => {}, requestClose: onClose});
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
    /** Deferred admission belongs only to this still-mounted provider read. */
    const read = tournaments?.list;
    void Promise.resolve().then(() => current ? read!.call(tournaments, locale) : undefined)
      .then(value => {if (current) setTournament(accept(value));})
      .catch(() => {if (current) setError("RaceTo10.ERROR_GENERIC");})
      .finally(() => {window.clearTimeout(timeout); if (current) setLoading(false);});
    return () => {current = false; window.clearTimeout(timeout);};
  }, [locale, tournaments, retry]);
  return <section ref={dialogRef} className="race-screen" role="dialog" aria-modal="true" aria-labelledby={presentation.titleId}
    tabIndex={-1} data-analytics-screen={presentation.analyticsScreen}>
    <header className="race-topbar"><h1 id={presentation.titleId}>{tr("RaceTo10.HUB_TOURNAMENTS")}</h1>
      <div className="race-topbar-actions"><strong aria-label={tr("Profile.TOTAL_COINS_LABEL")}>{coins.toLocaleString()}</strong>
        <button className="race-close" aria-label={tr("RaceTo10.CLOSE")} onClick={onClose}>×</button></div></header>
    {navigation}
    {error && <div className="race-error" role="alert">{tr(error)}<button onClick={() => {setError(null); setRetry(value => value + 1);}}>{tr("RaceTo10.RETRY")}</button></div>}
    <RaceTournamentPanel tournament={tournament} loading={loading} />
  </section>;
}
