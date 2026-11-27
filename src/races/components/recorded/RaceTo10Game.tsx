import {useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {parseHostToGameMessage} from "../../../platform/bridge/messages";
import {ListRaceCategoriesResponseSchema, type LiveRaceCapability, type RaceCategoryId, type RaceLocale} from "../../contracts/index";
import "../../styles/lobby.css";
import "../../styles/intro.css";
import "../../styles/gameplay.css";
import {tr} from "../../../localization/browser/i18n";
import {HOST_TO_GAME_EVENT} from "../../../platform/bridge/browser/localBridge";
import {createRequestId} from "../../../gameplay/session/requestIds";
import {useReferralSharing} from "../../../sharing/components/ReferralSharingCapability";
import {LiveRaceInvitationCard} from "../invitations/LiveRaceInvitationCard";
import {LiveRaceIdentity} from "../social/LiveRaceIdentity";
import {LiveRaceInbox} from "../invitations/LiveRaceInbox";
import {LiveRaceGame} from "../live/LiveRaceGame";
import {RaceTopbar} from "../gameplay/RaceHeader";
import {RaceCategoryIcon} from "../lobby/RaceCategoryIcon";
import {useRaceDialogFocus} from "../../hooks/useRaceDialogFocus";
import {EMPTY_RACE_CATEGORIES, type RaceTo10GameProps} from "./RaceTo10Game.types.ts";
import {trackEvent, trackScreen} from "../../../observability/analytics/events";
import {withLiveRaceAnalytics} from "../../analytics/liveRaceAnalytics";
import {readLiveRaceLobby} from "../../browser/storage/liveRaceLobbyStorage";

/** Shared invitations enter their private lobby; ordinary multiplayer entries open category selection. */
export function RaceTo10Game(props: RaceTo10GameProps) {
  const provider = props.matchmaking?.live;
  const telemetry = useMemo(() => {
    const lifetime = {active: false};
    return {lifetime, live: provider ? withLiveRaceAnalytics(provider, () => lifetime.active) : undefined};
  }, [provider, props.ownerId]);
  useLayoutEffect(() => {
    telemetry.lifetime.active = true;
    return () => {telemetry.lifetime.active = false;};
  }, [telemetry]);
  const matchmaking = useMemo(() => props.matchmaking ? {...props.matchmaking, live: telemetry.live} : undefined, [props.matchmaking, telemetry]);
  return <LiveRaceEntry key={JSON.stringify([props.ownerId ?? null, props.locale, props.challengeId ?? null])} {...props} matchmaking={matchmaking} />;
}

/** Immutable entry selection for public searches, private lobbies and incoming acceptances. */
type LiveSelection = {
  /** Exact server content category. */ categoryId: RaceCategoryId;
  /** Invitation content language remains authoritative. */ locale: RaceLocale;
  /** Creates a private seat without public matchmaking. */ createChallenge?: boolean;
  /** Accepts this existing server-owned lobby. */ challengeId?: string;
  /** Re-enters an acknowledged creator lobby without creating another invitation. */ resumeChallenge?: boolean;
  /** Recovers the exact acknowledged public seat without creating a replacement. */ resumeTicketId?: string;
  /** Starts a new private invitation for this owned completed seat. */ rematchOfTicketId?: string;
  /** Optional native audience selection owns this private journey's transport. */ transport?: LiveRaceCapability;
};

/** Owns live category selection without resuming or creating recorded races. */
function LiveRaceEntry(props: RaceTo10GameProps) {
  /** Immutable server content and invitation selection for the mounted live seat. */
  const [playing, setPlaying] = useState<LiveSelection | null>(() => {
    /** Validated account-owned lobby hint used to resume an acknowledged seat. */
    const saved = readLiveRaceLobby(props.ownerId, props.locale);
    return saved && !props.challengeId && props.matchmaking?.live ? {
      categoryId: saved.categoryId, locale: saved.locale, ...("challengeId" in saved ?
        {challengeId: saved.challengeId, resumeChallenge: true} : {resumeTicketId: saved.ticketId}),
    } : null;
  });
  /** Opening a shared link enters its lobby once; leaving returns to category selection. */
  const [incomingConsumed, setIncomingConsumed] = useState(false);
  /** A replacement authenticated capability starts at the intro instead of inheriting an old provider's ticket. */
  const [entryProvider, setEntryProvider] = useState(props.matchmaking?.live);
  if (entryProvider !== props.matchmaking?.live) {
    // Adjust before children commit so no old seat can subscribe or dispatch through the replacement provider.
    setEntryProvider(props.matchmaking?.live);
    setPlaying(null);
    setIncomingConsumed(false);
  }
  if (playing && props.matchmaking?.live) return <LiveRaceGame key={JSON.stringify(playing)} transport={playing.transport ?? props.matchmaking.live}
    locale={playing.locale} categoryId={playing.categoryId} createChallenge={playing.createChallenge} challengeId={playing.challengeId} resumeChallenge={playing.resumeChallenge}
    resumeTicketId={playing.resumeTicketId} rematchOfTicketId={playing.rematchOfTicketId} coins={props.coins} ownerId={props.ownerId} localPlayer={props.localPlayer} onCompleted={props.onLiveResult}
    onRematch={rematchOfTicketId => setPlaying({locale: playing.locale, categoryId: playing.categoryId, rematchOfTicketId})}
    onClose={() => setPlaying(null)} />;
  if (!incomingConsumed && props.challengeId && /^live_[a-f0-9]{64}$/.test(props.challengeId) && props.matchmaking?.live?.challenge)
    return <LiveRaceInvitationEntry {...props} challengeId={props.challengeId} transport={props.matchmaking.live}
      onStart={selection => {setIncomingConsumed(true); setPlaying(selection);}} />;
  return <LiveRaceIntro {...props} onStart={setPlaying} />;
}

/** A shared invitation opens its own lobby without loading the public category picker. */
function LiveRaceInvitationEntry({challengeId, transport, locale, coins, localPlayer, onClose, onStart}: {
  /** Opaque invitation received from the owning platform. */ challengeId: string;
  /** Authenticated invitation transport. */ transport: LiveRaceCapability;
  /** Current supported content language. */ locale: RaceLocale;
  /** Current balance displayed in the shared header. */ coins: number;
  /** Cached local identity remains visible while the invitation preview loads. */ localPlayer?: RaceTo10GameProps["localPlayer"];
  /** Leaves multiplayer without creating a seat. */ onClose: () => void;
  /** Uses the server's validated category and invitation selection. */ onStart: (selection: LiveSelection) => void;
}) {
  /** Invitation dialog and inactive quit-dialog references used for focus ownership. */
  const dialogRef = useRef<HTMLElement | null>(null), quitDialogRef = useRef<HTMLDivElement | null>(null);
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: false, dismissQuitConfirmation: () => {}, requestClose: onClose});
  return <section ref={dialogRef} className="race-screen" role="dialog" aria-modal="true" aria-labelledby="race-title"
    tabIndex={-1} data-analytics-screen="multiplayer_friend_lobby_entry">
    <RaceTopbar live coins={coins} onClose={onClose} />
    {localPlayer && <div className="race-panel live-race-self"><LiveRaceIdentity player={localPlayer} /></div>}
    <LiveRaceInvitationCard challengeId={challengeId} transport={transport} locale={locale} onAccept={onStart} autoJoin />
  </section>;
}

/** Loads only the category catalog and starts the target's live matchmaking capability. */
function LiveRaceIntro({locale, coins, challengeId, initialCategories = EMPTY_RACE_CATEGORIES, introNavigation, matchmaking, postToHost, onClose, onStart}: RaceTo10GameProps & {
  /** Opens a live seat in the selected category. */
  onStart: (selection: LiveSelection) => void;
}) {
  /** Only platforms supplying a real native invite dialog expose friend challenges. */
  const sharing = useReferralSharing();
  /** Latest catalog provided by the authenticated host. */
  const [categories, setCategories] = useState(initialCategories);
  /** Explicit category preference; mixed is the default when available. */
  const [selection, setSelection] = useState<RaceCategoryId | null>(null);
  /** Catalog request and recovery presentation. */
  const [loading, setLoading] = useState(initialCategories.length === 0);
  /** Failed catalog delivery or invalid authority response. */
  const [failed, setFailed] = useState(false);
  /** Retry generation for the read-only catalog request. */
  const [retry, setRetry] = useState(0);
  /** Native selection excludes repeated clicks before React disables the intro. */
  const choosing = useRef(false);
  /** Visible provider selection state stays separate from read-only category loading. */
  const [choosingFriends, setChoosingFriends] = useState(false);
  /** Native chooser failures use the existing translated recovery copy. */
  const [chooseFailed, setChooseFailed] = useState(false);
  /** Retirement prevents a late native selection from creating a server seat. */
  const choiceLifetime = useRef<AbortController | null>(null);
  /** Only committed provider replacements retire a pending native choice. */
  const choiceProvider = useRef(matchmaking?.live);
  useLayoutEffect(() => {choiceProvider.current = matchmaking?.live;}, [matchmaking?.live]);
  useEffect(() => {
    /** StrictMode replay owns its own callback lifetime. */
    const lifetime = new AbortController(); choiceLifetime.current = lifetime;
    return () => lifetime.abort();
  }, []);
  /** Modal focus boundary. */
  const dialogRef = useRef<HTMLElement | null>(null);
  /** Shared focus adapter's unused confirmation boundary. */
  const quitDialogRef = useRef<HTMLDivElement | null>(null);
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: false, dismissQuitConfirmation: () => {}, requestClose: onClose});
  useEffect(() => {
    if (initialCategories.length) {
      setCategories(initialCategories);
      setLoading(false);
      setFailed(false);
      return;
    }
    /** Exact receipt prevents late replies from a retired account or retry from changing the catalog. */
    const requestId = createRequestId("live-categories");
    /** Lifetime guard covers transport rejection and synchronous bridge responses. */
    let active = true;
    /** Catalog reads release the intro after eight seconds so the player can retry. */
    const timeout = window.setTimeout(() => finish(null), 8000);
    /** Completes this read exactly once. */
    const finish = (catalog: typeof categories | null) => {
      if (!active) return;
      active = false;
      window.clearTimeout(timeout);
      window.removeEventListener(HOST_TO_GAME_EVENT, receive);
      setLoading(false);
      setFailed(!catalog?.length);
      if (catalog) setCategories(catalog);
    };
    /** Validates an untrusted bridge reply before accepting server categories. */
    const receive = (event: Event) => {
      /** Parsed host envelope remains isolated from malformed bridge payloads. */
      let message;
      try {message = parseHostToGameMessage((event as CustomEvent<unknown>).detail);} catch {return;}
      try {
        if (message.type !== "host:operationResult" || message.requestId !== requestId || message.payload.operation !== "raceCategories") return;
        finish(message.payload.ok ? ListRaceCategoriesResponseSchema.parse(message.payload.data).categories : null);
      } catch {finish(null);}
    };
    setLoading(true);
    setFailed(false);
    window.addEventListener(HOST_TO_GAME_EVENT, receive);
    try {
      void Promise.resolve(postToHost({type: "game:listRaceCategories", requestId, payload: {locale}})).catch(() => finish(null));
    } catch {finish(null);}
    return () => {active = false; window.clearTimeout(timeout); window.removeEventListener(HOST_TO_GAME_EVENT, receive);};
  }, [locale, initialCategories, postToHost, retry]);
  /** Category remains valid if the host refreshes its available catalog. */
  const selected = categories.find(category => category.categoryId === selection)?.categoryId ??
    categories.find(category => category.categoryId === "mixed")?.categoryId ?? categories[0]?.categoryId;
  /** An explicit native audience starts a reserved lobby in the already selected content category. */
  useEffect(() => {trackScreen("multiplayer_live_intro");}, []);
  const chooseFriends = async () => {
    /** Capture exact category, provider and effect lifetime before native UI opens. */
    const categoryId = selected, provider = matchmaking?.live, choose = provider?.chooseChallenge, signal = choiceLifetime.current?.signal;
    if (choosing.current || loading || failed || !categoryId || !choose || !signal || signal.aborted) return;
    choosing.current = true; setChoosingFriends(true); setChooseFailed(false);
    try {
      /** Returned transport preserves the native audience independently of public matching. */
      const result = await choose();
      if (signal.aborted || choiceProvider.current !== provider) return;
      if (result.status === "success") onStart({categoryId, locale, createChallenge: true, transport: result.value});
      else if (result.status !== "cancelled") setChooseFailed(true);
    } catch {if (!signal.aborted && choiceProvider.current === provider) setChooseFailed(true);}
    finally {choosing.current = false; if (!signal.aborted) setChoosingFriends(false);}
  };
  return <section ref={dialogRef} className="race-screen race-screen-intro" role="dialog" aria-modal="true" aria-labelledby="race-title"
    tabIndex={-1} data-analytics-screen="multiplayer_live_intro">
    <RaceTopbar live coins={coins} onClose={onClose} />
    {introNavigation}
    {challengeId && /^live_[a-f0-9]{64}$/.test(challengeId) && matchmaking?.live?.challenge &&
      <LiveRaceInvitationCard key={challengeId} challengeId={challengeId} locale={locale} transport={matchmaking.live} onAccept={onStart} />}
    {matchmaking?.live?.inbox && matchmaking.live.challenge &&
      <LiveRaceInbox transport={matchmaking.live} excludeId={challengeId} locale={locale} onAccept={onStart} />}
    <div className="race-panel race-category-panel">
      <h2>{tr("RaceTo10.CHOOSE_CATEGORY")}</h2>
      <div className="race-category-grid">
        {categories.map(category => <button key={category.categoryId} aria-pressed={selected === category.categoryId}
          disabled={loading || choosingFriends || !matchmaking?.live} style={{"--race-color": category.colorToken} as CSSProperties}
          onClick={() => {setSelection(category.categoryId); trackEvent("race_category_selected", {category_id: category.categoryId});}}>
          <RaceCategoryIcon categoryId={category.categoryId} />
          <strong>{tr(category.nameKey)}</strong><span>{tr(category.descriptionKey)}</span>
        </button>)}
      </div>
      {loading && <p role="status">{tr("RaceTo10.LOADING_CATEGORIES")}</p>}
      {(failed || !matchmaking?.live) && <div className="race-error" role="alert">
        {tr(matchmaking?.live ? "RaceTo10.ERROR_GENERIC" : "RaceTo10.MATCH_UNAVAILABLE")}
        {failed && <button onClick={() => setRetry(current => current + 1)}>{tr("RaceTo10.RETRY")}</button>}
      </div>}
      <button className="race-primary live-race-start" disabled={loading || choosingFriends || failed || !selected || !matchmaking?.live}
        onClick={() => {if (!choosing.current && selected && matchmaking?.live) {trackEvent("live_race_search_requested", {category_id: selected, locale}); onStart({categoryId: selected, locale});}}}>{tr("RaceTo10.LIVE_START")}</button>
      {matchmaking?.live?.chooseChallenge && <button className="race-secondary live-race-context-challenge" aria-busy={choosingFriends}
        disabled={loading || choosingFriends || failed || !selected} onClick={() => void chooseFriends()}>{tr("RaceTo10.CHOOSE_CONTEXT")}</button>}
      {chooseFailed && <div className="race-error" role="alert">{tr("RaceTo10.ERROR_GENERIC")}</div>}
      {(matchmaking?.live?.shareChallenge || sharing?.shareLiveRace) && matchmaking?.live?.challenge && <button className="race-secondary" disabled={loading || choosingFriends || failed || !selected}
        onClick={() => {if (!choosing.current && selected) {trackEvent("live_race_challenge_requested", {category_id: selected, locale}); onStart({categoryId: selected, locale, createChallenge: true});}}}>{tr("RaceTo10.CHALLENGE_FRIEND")}</button>}
    </div>
  </section>;
}
