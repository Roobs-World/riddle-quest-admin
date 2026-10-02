import {useEffect, useRef, useState, type CSSProperties} from "react";
import {parseHostToGameMessage} from "@qwordly/core/bridge";
import {ListRaceCategoriesResponseSchema, type RaceCategoryId} from "@qwordly/core/race";
import "../../styles.race-lobby.css";
import "../../styles.race-gameplay.css";
import {tr} from "../i18n";
import {HOST_TO_GAME_EVENT} from "../localBridge";
import {createRequestId} from "../requestIds";
import {LiveRaceGame} from "./LiveRaceGame";
import {RaceTopbar} from "./components/RaceHeader";
import {useRaceDialogFocus} from "./hooks";
import {EMPTY_RACE_CATEGORIES, type RaceTo10GameProps} from "./RaceTo10Game.types";

/** All multiplayer entries, including retired challenge links, open the live PvP intro. */
export function RaceTo10Game(props: RaceTo10GameProps) {
  return <LiveRaceEntry key={JSON.stringify([props.ownerId ?? null, props.locale])} {...props} />;
}

/** Owns live category selection without resuming or creating recorded races. */
function LiveRaceEntry(props: RaceTo10GameProps) {
  /** Category whose live seat is currently mounted. */
  const [playing, setPlaying] = useState<RaceCategoryId | null>(null);
  if (playing && props.matchmaking?.live) return <LiveRaceGame key={playing} transport={props.matchmaking.live}
    locale={props.locale} categoryId={playing} coins={props.coins} ownerId={props.ownerId} onClose={() => setPlaying(null)} />;
  return <LiveRaceIntro {...props} onStart={setPlaying} />;
}

/** Loads only the category catalog and starts the target's live matchmaking capability. */
function LiveRaceIntro({locale, coins, initialCategories = EMPTY_RACE_CATEGORIES, matchmaking, postToHost, onClose, onStart}: RaceTo10GameProps & {
  /** Opens a live seat in the selected category. */
  onStart: (categoryId: RaceCategoryId) => void;
}) {
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
  return <section ref={dialogRef} className="race-screen" role="dialog" aria-modal="true" aria-labelledby="race-title"
    tabIndex={-1} data-analytics-screen="multiplayer_live_intro">
    <RaceTopbar live coins={coins} onClose={onClose} />
    <div className="race-panel">
      <h2>{tr("RaceTo10.CHOOSE_CATEGORY")}</h2>
      <p>{tr("RaceTo10.FIRST_TO_TEN")}</p>
      <div className="race-category-grid">
        {categories.map(category => <button key={category.categoryId} aria-pressed={selected === category.categoryId}
          disabled={loading || !matchmaking?.live} style={{"--race-color": category.colorToken} as CSSProperties}
          onClick={() => setSelection(category.categoryId)}>
          <strong>{tr(category.nameKey)}</strong><span>{tr(category.descriptionKey)}</span>
        </button>)}
      </div>
      {loading && <p role="status">{tr("RaceTo10.LOADING_CATEGORIES")}</p>}
      {(failed || !matchmaking?.live) && <div className="race-error" role="alert">
        {tr(matchmaking?.live ? "RaceTo10.ERROR_GENERIC" : "RaceTo10.MATCH_UNAVAILABLE")}
        {failed && <button onClick={() => setRetry(current => current + 1)}>{tr("RaceTo10.RETRY")}</button>}
      </div>}
      <button className="race-primary live-race-start" disabled={loading || failed || !selected || !matchmaking?.live}
        onClick={() => {if (selected && matchmaking?.live) onStart(selected);}}>{tr("RaceTo10.LIVE_START")}</button>
    </div>
  </section>;
}
