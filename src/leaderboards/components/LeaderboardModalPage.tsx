import {RankedAvatar} from "../../progression/components/ranks/RankedAvatar";
import {useState} from "react";
import type {GameSessionState} from "../../gameplay/session/gameSession";
import {useTranslator} from "../../localization/browser/i18n";
import {PulsingSpinner} from "../../app/components/feedback/SpinningWheelLoader";
import {LEADERBOARD_PAGE_SIZE, paginateLeaderboard} from "../browser/leaderboardPagination";

/** Supported server-authoritative leaderboard measurements. */
type LeaderboardType = GameSessionState["leaderboardType"];

/** Properties required by the leaderboard modal page. */
export type LeaderboardModalPageProps = {
  /** Current leaderboard entries returned by the host. */
  entries: GameSessionState["leaderboard"];
  /** Whether the host is loading the selected leaderboard. */
  loading: boolean;
  /** The latest request failed rather than returning an empty ranking. */
  loadError?: boolean;
  /** Measurement currently selected by the player. */
  leaderboardType: LeaderboardType;
  /** Requests one leaderboard measurement from the host. */
  onRequestLeaderboard: (type: LeaderboardType) => void;
};

/** Stable tab order used by every leaderboard render. */
const LEADERBOARD_TYPES: readonly LeaderboardType[] = ["xp", "totalWins", "bestStreak", "multiplayerWins"];

/** Renders the paginated, server-backed leaderboard modal. */
export function LeaderboardModalPage({
  entries,
  loading,
  loadError = false,
  leaderboardType,
  onRequestLeaderboard,
}: LeaderboardModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Zero-based page requested by the player. */
  const [requestedPage, setRequestedPage] = useState(0);
  /** Pagination values derived from the latest server entries. */
  const {activePage, pageCount, pageStart, visibleEntries} = paginateLeaderboard(entries, requestedPage);

  return (
    <div className="leaderboard-panel">
      <div className="leaderboard-tabs">
        {LEADERBOARD_TYPES.map((type) => (
          <button
            className={leaderboardType === type ? "active" : ""}
            disabled={loading}
            key={type}
            onClick={() => {
              setRequestedPage(0);
              onRequestLeaderboard(type);
            }}
            aria-pressed={leaderboardType === type}
          >
            {tr(
              type === "xp"
                ? "Leaderboard.TAB_XP"
                : type === "totalWins"
                  ? "Leaderboard.TAB_WINS"
                  : type === "multiplayerWins"
                    ? "Leaderboard.TAB_MULTIPLAYER_WINS"
                    : "Leaderboard.TAB_STREAK",
            )}
          </button>
        ))}
      </div>
      <div className="leaderboard-content">
      {loading ? (
        <div className="leaderboard-loading" role="status" aria-label={tr("Accessibility.LOADING")}>
          <PulsingSpinner />
        </div>
      ) : null}
      {!loading && loadError ? (
        <div className="leaderboard-error" role="alert">
          <p>{tr("Leaderboard.LOAD_ERROR")}</p>
          <button className="play-secondary compact" onClick={() => onRequestLeaderboard(leaderboardType)}>
            {tr("Leaderboard.RETRY_BUTTON")}
          </button>
        </div>
      ) : null}
      <ol className="leaderboard-list" aria-busy={loading} aria-label={tr("Leaderboard.TITLE")} tabIndex={0} start={pageStart + 1}>
        {!loading && !loadError && entries.length === 0 ? <li className="leaderboard-empty"><span aria-hidden="true">🏆</span><p>{tr("Leaderboard.NO_SCORES_YET")}</p></li> : null}
        {visibleEntries.map((entry, index) => (
              <li key={entry.userId} data-placement={pageStart + index + 1}>
                <b>{pageStart + index + 1}</b>
                <RankedAvatar avatarUrl={entry.avatarUrl} level={entry.level} size={30}
                  fallback={entry.username.slice(0, 1).toUpperCase()} imageClassName="leaderboard-avatar"
                  fallbackClassName="leaderboard-avatar-fallback" />
                <span className="leaderboard-player"><span title={entry.username}>{entry.username}</span><small>{tr("Ranks.LEVEL_REQUIREMENT_PREFIX")}{entry.level}</small></span>
                <strong>
                  {leaderboardType === "xp"
                    ? entry.xp
                    : leaderboardType === "totalWins"
                      ? entry.totalWins
                      : leaderboardType === "multiplayerWins"
                        ? entry.multiplayerWins ?? 0
                        : entry.bestStreak}
                </strong>
              </li>
            ))}
      </ol>
      </div>
      {entries.length > LEADERBOARD_PAGE_SIZE ? (
        <nav className="leaderboard-pagination" aria-label={tr("Leaderboard.PAGINATION_LABEL")}>
          <button
            className="play-secondary compact"
            disabled={activePage === 0}
            onClick={() => setRequestedPage((page) => Math.max(0, page - 1))}
          >
            {tr("Leaderboard.PREVIOUS_PAGE")}
          </button>
          <span>
            {activePage + 1} / {pageCount}
          </span>
          <button
            className="play-secondary compact"
            disabled={activePage === pageCount - 1}
            onClick={() => setRequestedPage((page) => Math.min(pageCount - 1, page + 1))}
          >
            {tr("Leaderboard.NEXT_PAGE")}
          </button>
        </nav>
      ) : null}
    </div>
  );
}
