import {useCallback, useEffect, useRef, useState, type ReactNode, type KeyboardEvent} from "react";
import {ListFacebookTournamentResponseSchema, type ListFacebookTournamentResponse, type LiveRaceView} from "@qwordly/core/race";
import {RaceTo10Game} from "../play/race/RaceTo10Game";
import type {RaceTo10GameProps} from "../play/race/RaceTo10Game.types";
import {RaceTournamentPanel} from "../play/race/components/RaceLobbyPanels";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {tr} from "../play/i18n";
import {useRaceDialogFocus} from "../play/race/hooks/useRaceDialogFocus";

/** Keeps Meta's official tournament destination alongside the shared live PvP intro. */
export function FacebookRaceEntry(props: RaceTo10GameProps) {
  return <FacebookRaceDestination key={JSON.stringify([props.ownerId, props.locale])} {...props} />;
}

/** Account and language lifetimes retire target-owned navigation and result effects. */
function FacebookRaceDestination(props: RaceTo10GameProps) {
  /** Valid native entry selects the board without changing the player's content language. */
  const [board, setBoard] = useState(Boolean(props.tournaments && props.tournamentLocale));
  /** Keyboard selection retains focus when the destination replaces its modal tree. */
  const keyboardSelection = useRef(false);
  /** Submit an opaque ticket only; the callable independently verifies private match state. */
  const completed = useCallback((view: LiveRaceView) => {
    props.onLiveResult?.(view);
    if (!props.tournaments || view.result !== "win" || view.player.correctCount !== 10 || !view.run ||
      view.run.runId !== view.ticketId || view.run.locale !== props.locale) return;
    void Promise.resolve().then(() => props.tournaments!.record(view.ticketId, props.locale)).catch(error => captureBrowserException(error,
      {component: "facebook_tournament", operation: "record_live_result"}));
  }, [props.tournaments, props.locale, props.onLiveResult]);
  if (!props.tournaments) return <RaceTo10Game {...props} />;
  /** Provider navigation is unavailable during an owned live race. */
  const navigation = <FacebookRaceNavigation board={board} focusSelection={keyboardSelection.current}
    onSelect={(destination, keyboard = false) => {keyboardSelection.current = keyboard; setBoard(destination);}} />;
  return board ? <FacebookTournamentBoard {...props} navigation={navigation} />
    : <RaceTo10Game {...props} introNavigation={navigation} onLiveResult={completed} />;
}

/** Two accessible tabs expose only live play and the configured Meta board. */
function FacebookRaceNavigation({board, focusSelection, onSelect}: {
  /** Current destination. */ board: boolean;
  /** A keyboard navigation must focus the newly mounted selected tab. */ focusSelection: boolean;
  /** Switches presentation without creating or abandoning a race. */ onSelect: (board: boolean, keyboard?: boolean) => void;
}) {
  /** Roving keyboard focus follows the selected destination. */
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (!focusSelection) return;
    const frame = window.requestAnimationFrame(() => tabs.current[board ? 1 : 0]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [board, focusSelection]);
  /** Arrow and endpoint keys select and focus the next supported destination. */
  const key = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 :
      event.key === "ArrowLeft" || event.key === "ArrowRight" ? 1 - index : undefined;
    if (next === undefined) return;
    event.preventDefault(); onSelect(next === 1, true);
  };
  return <nav className="race-hub-tabs" aria-label={tr("RaceTo10.MULTIPLAYER_BUTTON")}>
    <div role="tablist">{[false, true].map((destination, index) => <button key={String(destination)}
      ref={element => {tabs.current[index] = element;}} role="tab" type="button"
      aria-selected={board === destination} tabIndex={board === destination ? 0 : -1}
      onClick={() => onSelect(destination)} onKeyDown={event => key(event, index)}>
      {tr(destination ? "RaceTo10.HUB_TOURNAMENTS" : "RaceTo10.HUB_PLAY")}
    </button>)}</div>
  </nav>;
}

/** Reads only validated official standings; native scores never become game authority. */
function FacebookTournamentBoard({locale, tournamentLocale, tournaments, coins, onClose, navigation}: RaceTo10GameProps & {
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
    let current = true;
    setLoading(true); setTournament(null);
    /** A silent provider cannot leave this read-only destination permanently loading. */
    const timeout = window.setTimeout(() => {if (current) {current = false; setError("RaceTo10.ERROR_GENERIC"); setLoading(false);}}, 8000);
    /** Enforces locale and window identity before rendering an official row. */
    const accept = (value: unknown) => {
      const result = ListFacebookTournamentResponseSchema.parse(value);
      if (result.locale !== locale) throw new Error("Tournament locale mismatch");
      return result;
    };
    void Promise.resolve().then(() => tournaments!.list(locale)).then(accept).then(value => {if (current) setTournament(value);})
      .catch(() => {if (current) setError("RaceTo10.ERROR_GENERIC");})
      .finally(() => {window.clearTimeout(timeout); if (current) setLoading(false);});
    return () => {current = false; window.clearTimeout(timeout);};
  }, [locale, tournaments, retry]);
  /** Meta adapter fetches the fresh official best and owns its SDK dialog guard. */
  const share = async () => {
    if (sharing.current || !tournaments?.share) return;
    sharing.current = true; setBusy(true);
    try {
      const result = await tournaments.share(locale);
      if (!active.current) return;
      if (result.status === "success") {setError(null); setRetry(value => value + 1);}
      else if (result.status !== "cancelled") setError(result.message === "RaceTo10.ERROR_LOCALE_MISMATCH"
        ? "RaceTo10.ERROR_LOCALE_MISMATCH" : "RaceTo10.ERROR_GENERIC");
    } catch {if (active.current) setError("RaceTo10.ERROR_GENERIC");}
    finally {sharing.current = false; if (active.current) setBusy(false);}
  };
  return <section ref={dialogRef} className="race-screen" role="dialog" aria-modal="true" aria-labelledby="facebook-tournament-title"
    tabIndex={-1} data-analytics-screen="facebook_tournament">
    <header className="race-topbar"><h1 id="facebook-tournament-title">{tr("RaceTo10.HUB_TOURNAMENTS")}</h1>
      <div className="race-topbar-actions"><strong aria-label={tr("Profile.TOTAL_COINS_LABEL")}>{coins.toLocaleString()}</strong>
        <button className="race-close" aria-label={tr("RaceTo10.CLOSE")} onClick={onClose}>×</button></div></header>
    {navigation}
    {error && <div className="race-error" role="alert">{tr(error)}<button onClick={() => {setError(null); setRetry(value => value + 1);}}>{tr("RaceTo10.RETRY")}</button></div>}
    <RaceTournamentPanel tournament={tournament} loading={loading} sharing={busy} onShare={tournaments?.share ? () => void share() : undefined} />
  </section>;
}
