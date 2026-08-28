import {useState} from "react";
import type {GameSessionState} from "../../gameSession";
import {tr} from "../../i18n";
import {LEADERBOARD_PAGE_SIZE, paginateLeaderboard} from "./leaderboardPagination";

/** Supported server-authoritative leaderboard measurements. */
type LeaderboardType = GameSessionState["leaderboardType"];

/** Properties required by the leaderboard modal page. */
export type LeaderboardModalPageProps = {
  /** Current leaderboard entries returned by the host. */
  entries: GameSessionState["leaderboard"];
  /** Whether the host is loading the selected leaderboard. */
  loading: boolean;
  /** Measurement currently selected by the player. */
  leaderboardType: LeaderboardType;
  /** Requests one leaderboard measurement from the host. */
  onRequestLeaderboard: (type: LeaderboardType) => void;
};

/** Stable tab order used by every leaderboard render. */
const LEADERBOARD_TYPES: readonly LeaderboardType[] = ["xp", "totalWins", "bestStreak"];

/** Renders the paginated, server-backed leaderboard modal. */
export function LeaderboardModalPage({
  entries,
  loading,
  leaderboardType,
  onRequestLeaderboard,
}: LeaderboardModalPageProps) {
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
            key={type}
            onClick={() => onRequestLeaderboard(type)}
          >
            {tr(
              type === "xp"
                ? "Leaderboard.TAB_XP"
                : type === "totalWins"
                  ? "Leaderboard.TAB_WINS"
                  : "Leaderboard.TAB_STREAK",
            )}
          </button>
        ))}
      </div>
      <ol className="leaderboard-list" aria-busy={loading}>
        {!loading && entries.length === 0 ? <li>{tr("Leaderboard.NO_SCORES_YET")}</li> : null}
        {!loading
          ? visibleEntries.map((entry, index) => (
              <li key={entry.userId}>
                <b>{pageStart + index + 1}</b>
                {entry.avatarUrl ? (
                  <img className="leaderboard-avatar" src={entry.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className="leaderboard-avatar-fallback" aria-hidden="true">
                    {entry.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span>{entry.username}</span>
                <strong>
                  {leaderboardType === "xp"
                    ? entry.xp
                    : leaderboardType === "totalWins"
                      ? entry.totalWins
                      : entry.bestStreak}
                </strong>
              </li>
            ))
          : null}
      </ol>
      {!loading && entries.length > LEADERBOARD_PAGE_SIZE ? (
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
