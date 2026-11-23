import {useEffect, useState} from "react";
import {ListLiveRaceHistoryResponseSchema, type ListLiveRaceHistoryResponse, type LiveRaceCapability, type RaceLocale} from "@riddle-quest/core/race";
import {tr} from "../../i18n";
import {LiveRaceSafety} from "./LiveRaceSafety";
import {liveRacePlayerName} from "../logic/liveRacePlayerName";

/** A provider's history read and content locale own the visible rows and their actions. */
type LiveRaceHistoryProps = {
  /** Owning provider supplies its authenticated history transport. */
  transport: LiveRaceCapability;
  /** Exact active content language. */
  locale: RaceLocale;
  /** Explicit selection leaves Activity before opening an owned private lobby. */
  onRematch?: (selection: {
    /** Original validated content category. */ categoryId: ListLiveRaceHistoryResponse["entries"][number]["categoryId"];
    /** Caller-owned retained terminal ticket. */ rematchOfTicketId: string;
  }) => void;
};

/** Provider replacement retires old rows and controls before any passive cleanup. */
export function LiveRaceHistory(props: LiveRaceHistoryProps) {
  /** React keeps abandoned replacements from changing the committed panel's identity. */
  const [lifetime, setLifetime] = useState(() => ({transport: props.transport, read: props.transport.history,
    locale: props.locale, version: 0}));
  if (lifetime.transport !== props.transport || lifetime.read !== props.transport.history || lifetime.locale !== props.locale)
    setLifetime({transport: props.transport, read: props.transport.history, locale: props.locale, version: lifetime.version + 1});
  return <LiveRaceHistoryPanel key={lifetime.version} {...props} />;
}

/** Locale-bound result reads grant nothing; explicit actions use only this panel's provider. */
function LiveRaceHistoryPanel({transport, locale, onRematch}: LiveRaceHistoryProps) {
  /** A new read never exposes results from an earlier account, locale or tab. */
  const [history, setHistory] = useState<ListLiveRaceHistoryResponse | null>(null);
  /** Each retry owns a new bounded observer. */
  const [retry, setRetry] = useState(0);
  /** Existing translated loading and failure messages remain provider-neutral. */
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  /** A confirmed block retires every visible row before a fresh private projection. */
  const [blockedNotice, setBlockedNotice] = useState(false);
  useEffect(() => {
    /** Retired reads cannot render late rows after a locale, account or tab change. */
    let current = true;
    setHistory(null); setFailed(false); setLoading(true);
    /** Missing authority releases the panel so a deliberate retry remains available. */
    const timeout = window.setTimeout(() => {if (current) {current = false; setFailed(true); setLoading(false);}}, 8000);
    /** The deferred read cannot borrow a replacement callback from a mutable provider. */
    const read = transport.history;
    void Promise.resolve().then(() => current ? read!.call(transport, locale) : undefined).then(value => {
      if (!current) return;
      /** Strict ordering, retention and response locale precede every rendered row. */
      const result = ListLiveRaceHistoryResponseSchema.parse(value);
      if (result.locale !== locale) throw new Error("History locale mismatch");
      if (current) setHistory(result);
    }).catch(() => {if (current) setFailed(true);})
      .finally(() => {window.clearTimeout(timeout); if (current) setLoading(false);});
    return () => {current = false; window.clearTimeout(timeout);};
  }, [transport, locale, retry]);
  return <div className="race-panel live-race-history" data-rewards-enabled="false">
    <h2>{tr("RaceTo10.LIVE_HISTORY_TITLE")}</h2>
    {blockedNotice && <p role="status">{tr("RaceTo10.BLOCK_SUCCESS")}</p>}
    {loading && <p role="status">{tr("RaceTo10.RESULTS_LOADING")}</p>}
    {failed && <div className="race-error" role="alert">{tr("RaceTo10.ERROR_GENERIC")}
      <button type="button" onClick={() => setRetry(value => value + 1)}>{tr("RaceTo10.RETRY")}</button></div>}
    {!loading && !failed && history?.entries.length === 0 && <p>{tr("RaceTo10.LIVE_HISTORY_EMPTY")}</p>}
    {history && <ol className="live-race-history-list">{history.entries.map(entry => {
      /** A retired row never renders the previous name, photo, level or score. */
      const masked = !entry.opponentAvailable && !entry.opponent.bot;
      return <li key={entry.ticketId} className="live-race-history-entry">
        <header><strong>{tr(entry.result === "win" ? "RaceTo10.RESULT_PLAYER_WIN" : entry.result === "loss" ? "RaceTo10.RESULT_OPPONENT_WIN" : "RaceTo10.RESULT_TIE")}</strong>
          <time dateTime={new Date(entry.createdAtMs).toISOString()}>{new Intl.DateTimeFormat(locale, {dateStyle: "short", timeStyle: "short"}).format(entry.createdAtMs)}</time></header>
        <div className="live-race-history-score"><span><span>{tr("RaceTo10.YOU")}</span><strong>{entry.correctCount}/10</strong></span>
          <span><span>{masked ? tr("RaceTo10.LIVE_OPPONENT") : liveRacePlayerName(entry.opponent)}</span>
            <strong>{masked ? "—" : `${entry.opponent.correctCount}/10`}</strong></span></div>
        {entry.rewardCoins === 50 && <p>{tr("RaceTo10.LIVE_REWARD", {coins: entry.rewardCoins})}</p>}
        {entry.opponentAvailable && !entry.opponent.bot && transport.rematch && onRematch &&
          <button className="race-secondary live-race-rematch" onClick={() => onRematch({categoryId: entry.categoryId, rematchOfTicketId: entry.ticketId})}>
            {tr("RaceTo10.REMATCH")}</button>}
        {!masked && entry.opponentAvailable && transport.blockOpponent && transport.reportOpponent &&
          <LiveRaceSafety transport={transport} ticketId={entry.ticketId} onBlocked={() => {
            setHistory(null); setLoading(true); setBlockedNotice(true); setRetry(value => value + 1);
          }} />}
      </li>;
    })}</ol>}
  </div>;
}
