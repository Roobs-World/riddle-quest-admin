import {useState, type CSSProperties} from "react";
import type {
  ListRaceCategoriesResponse,
  RaceCategoryId,
  RaceChallengePreview,
  RaceInboxItem,
  SocialReportCategory,
  ListFacebookTournamentResponse,
  ListFacebookContextBoardResponse,
} from "@qwordly/core/race";
import {tr} from "../../i18n";
import {formatRaceTime} from "../logic/racePresentation";

/** Displays available server-provided categories and navigation to race results. */
export function RaceCategoriesPanel({
  categories,
  loading,
  onSelect,
  onShowInbox,
  onInviteChallenge,
  inviting = false,
  canChallenge = false,
}: {
  /** Stores categories. */
  categories: ListRaceCategoriesResponse["categories"];
  /** Stores loading. */
  loading: boolean;
  /** Stores on select. */
  onSelect: (categoryId: RaceCategoryId) => void;
  /** Stores on show inbox. */
  onShowInbox: () => void;
  /** Opens Jest's recipient dialog before beginning a creator run. */
  onInviteChallenge?: () => void;
  /** Whether the Jest share dialog is open. */
  inviting?: boolean;
  /** Whether the active platform can send a completed race to another player. */
  canChallenge?: boolean;
}) {
  return (
    <div className="race-panel">
      {canChallenge && (
        <div className="race-lobby-challenge">
          <button
            type="button"
            className="race-primary"
            disabled={loading || inviting || !categories.some((category) => category.categoryId === "mixed")}
            aria-describedby="race-challenge-help"
            onClick={onInviteChallenge ?? (() => onSelect("mixed"))}
          >
            {tr("RaceTo10.CHALLENGE_PLAYER")}
          </button>
          <p id="race-challenge-help">{tr("RaceTo10.CHALLENGE_PLAYER_HELP")}</p>
        </div>
      )}
      <h2>{tr("RaceTo10.CHOOSE_CATEGORY")}</h2>
      <p>{tr("RaceTo10.FIRST_TO_TEN")} · {tr("RaceTo10.HINT_BUTTON")} {tr("RaceTo10.HINT_PENALTY")} · {tr("RaceTo10.SKIP_BUTTON")} {tr("RaceTo10.SKIP_PENALTY")}</p>
      <div className="race-category-grid">
        {categories.map((category) => (
          <button
            key={category.categoryId}
            style={{"--race-color": category.colorToken} as CSSProperties}
            onClick={() => onSelect(category.categoryId)}
          >
            <strong>{tr(category.nameKey)}</strong>
            <span>{tr(category.descriptionKey)}</span>
            <small>
              {category.availableRiddleCount} {tr("RaceTo10.RIDDLES")}
            </small>
          </button>
        ))}
      </div>
      {loading && <p aria-live="polite">{tr("RaceTo10.LOADING_CATEGORIES")}</p>}
      <button className="race-secondary" onClick={onShowInbox}>
        {tr("RaceTo10.CHECK_RESULTS")}
      </button>
    </div>
  );
}

/** Displays identity-free server-authoritative tournament standings. */
export function RaceTournamentPanel({
  tournament,
  loading,
}: {
  /** Stores tournament. */
  tournament: ListFacebookTournamentResponse | null;
  /** Stores loading. */
  loading: boolean;
}) {
  return (
    <div className="race-panel race-tournaments" data-rewards-enabled="false">
      <h2>{tr("RaceTo10.HUB_TOURNAMENTS")}</h2>
      {loading ? (
        <p aria-live="polite">{tr("RaceTo10.RESULTS_LOADING")}</p>
      ) : !tournament || tournament.standings.length === 0 ? (
        <p>{tr("RaceTo10.RESULTS_EMPTY")}</p>
      ) : (
        <ol>
          {tournament.standings.map((standing, index) => (
            <li
              key={`${standing.rank}-${standing.adjustedTimeMs}-${index}`}
              aria-current={standing.isCurrentPlayer || undefined}
            >
              <strong>#{standing.rank}</strong>
              <span>{formatRaceTime(standing.adjustedTimeMs)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Displays completed multiplayer results and rematch controls. */
export function RaceInboxPanel({
  items,
  loading,
  safetyPending,
  contextBoard,
  contextBoardLoading,
  onRematch,
  onBlock,
  onReport,
  onChooseCategory,
}: {
  /** Stores items. */
  items: RaceInboxItem[];
  /** Stores loading. */
  loading: boolean;
  /** Stores safety pending. */
  safetyPending: boolean;
  /** Stores context board. */
  contextBoard?: ListFacebookContextBoardResponse | null;
  /** Stores context board loading. */
  contextBoardLoading?: boolean;
  /** Stores on rematch. */
  onRematch: (item: RaceInboxItem) => void;
  /** Stores on block. */
  onBlock: (item: RaceInboxItem) => void;
  /** Stores on report. */
  onReport: (item: RaceInboxItem, category: SocialReportCategory) => void;
  /** Stores on choose category. */
  onChooseCategory: () => void;
}) {
  /** Provides [report categories, set report categories] behavior. */
  const [reportCategories, setReportCategories] = useState<Record<string, SocialReportCategory>>({});
  return (
    <div className="race-panel race-inbox">
      <h2>{tr("RaceTo10.RESULTS_TITLE")}</h2>
      {contextBoardLoading ? (
        <p aria-live="polite">{tr("RaceTo10.RESULTS_LOADING")}</p>
      ) : contextBoard && contextBoard.standings.length > 0 ? (
        <ol className="race-context-board" aria-label={tr("RaceTo10.HUB_ACTIVITY")} data-rewards-enabled="false">
          {contextBoard.standings.map((standing, index) => (
            <li
              key={`${standing.rank}-${standing.adjustedTimeMs}-${index}`}
              aria-current={standing.isCurrentPlayer || undefined}
            >
              <strong>#{standing.rank}</strong>
              <span>{formatRaceTime(standing.adjustedTimeMs)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {loading && items.length === 0 ? (
        <p aria-live="polite">{tr("RaceTo10.RESULTS_LOADING")}</p>
      ) : items.length === 0 ? (
        <p>{tr("RaceTo10.RESULTS_EMPTY")}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.itemId}>
              {item.opponentAvatarUrl ? (
                <img src={item.opponentAvatarUrl} alt="" />
              ) : (
                <span aria-hidden="true">⚔️</span>
              )}
              <div>
                <strong>
                  {tr(
                    item.result === "win"
                      ? "RaceTo10.RESULT_PLAYER_WIN"
                      : item.result === "loss"
                        ? "RaceTo10.RESULT_GHOST_WIN"
                        : "RaceTo10.RESULT_TIE",
                  )}
                </strong>
                <span>{item.opponentDisplayName}</span>
                <small>{tr("RaceTo10.RESULT_MARGIN", {time: formatRaceTime(Math.abs(item.adjustedDeltaMs))})}</small>
              </div>
              <button className="race-primary" onClick={() => onRematch(item)}>
                {tr("RaceTo10.REMATCH")}
              </button>
              {item.opponentUserId ? (
                <details className="race-safety-actions">
                  <summary>{tr("RaceTo10.SAFETY_ACTIONS")}</summary>
                  <button type="button" disabled={safetyPending} onClick={() => onBlock(item)}>
                    {tr("RaceTo10.BLOCK_RIVAL")}
                  </button>
                  <label>
                    <span>{tr("RaceTo10.REPORT_REASON")}</span>
                    <select
                      value={reportCategories[item.itemId] ?? "harassment"}
                      disabled={safetyPending}
                      onChange={(event) =>
                        setReportCategories((current) => ({
                          ...current,
                          [item.itemId]: event.target.value as SocialReportCategory,
                        }))
                      }
                    >
                      <option value="harassment">{tr("RaceTo10.REPORT_HARASSMENT")}</option>
                      <option value="cheating">{tr("RaceTo10.REPORT_CHEATING")}</option>
                      <option value="inappropriate_identity">{tr("RaceTo10.REPORT_IDENTITY")}</option>
                      <option value="spam">{tr("RaceTo10.REPORT_SPAM")}</option>
                      <option value="other">{tr("RaceTo10.REPORT_OTHER")}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={safetyPending}
                    onClick={() => onReport(item, reportCategories[item.itemId] ?? "harassment")}
                  >
                    {tr("RaceTo10.REPORT_RIVAL")}
                  </button>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <button onClick={onChooseCategory}>{tr("RaceTo10.CHOOSE_CATEGORY")}</button>
    </div>
  );
}

/** Displays an incoming challenge preview and its acceptance action. */
export function RaceChallengePanel({
  challenge,
  onAccept,
}: {
  /** Stores challenge. */
  challenge: RaceChallengePreview | null;
  /** Stores on accept. */
  onAccept: (categoryId: RaceCategoryId) => void;
}) {
  return (
    <div className="race-panel race-challenge-card">
      {challenge ? (
        <>
          <h2>{tr("RaceTo10.CHALLENGED_BY", {name: challenge.creator.displayName})}</h2>
          <p>{tr("RaceTo10.TIME_TO_BEAT", {time: formatRaceTime(challenge.adjustedTimeToBeatMs)})}</p>
          <p>{tr("RaceTo10.FIRST_TO_TEN")} · {tr("RaceTo10.HINT_BUTTON")} {tr("RaceTo10.HINT_PENALTY")} · {tr("RaceTo10.SKIP_BUTTON")} {tr("RaceTo10.SKIP_PENALTY")}</p>
          {challenge.status === "active" ? (
            <button className="race-primary" onClick={() => onAccept(challenge.categoryId)}>
              {tr("RaceTo10.ACCEPT_CHALLENGE")}
            </button>
          ) : (
            <p role="alert">{tr("RaceTo10.ERROR_GENERIC")}</p>
          )}
        </>
      ) : (
        <p>{tr("RaceTo10.LOADING_CHALLENGE")}</p>
      )}
    </div>
  );
}
