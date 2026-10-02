import {useState, type CSSProperties} from "react";
import type {
  ListRaceCategoriesResponse,
  RaceCategoryId,
  RaceChallengePreview,
  RaceEntryResponse,
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
  busy = false,
  onSelect,
  onShowInbox,
}: {
  /** Stores categories. */
  categories: ListRaceCategoriesResponse["categories"];
  /** Stores loading. */
  loading: boolean;
  /** Prevents category starts while another race operation owns the session. */
  busy?: boolean;
  /** Stores on select. */
  onSelect: (categoryId: RaceCategoryId) => void;
  /** Stores on show inbox. */
  onShowInbox: () => void;
}) {
  return (
    <div className="race-panel">
      <h2>{tr("RaceTo10.CHOOSE_CATEGORY")}</h2>
      <p>{tr("RaceTo10.FIRST_TO_TEN")} · {tr("RaceTo10.HINT_BUTTON")} {tr("RaceTo10.HINT_PENALTY")} · {tr("RaceTo10.SKIP_BUTTON")} {tr("RaceTo10.SKIP_PENALTY")}</p>
      <div className="race-category-grid">
        {categories.map((category) => (
          <button
            key={category.categoryId}
            disabled={loading || busy}
            style={{"--race-color": category.colorToken} as CSSProperties}
            onClick={() => onSelect(category.categoryId)}
          >
            <strong>{tr(category.nameKey)}</strong>
            <span>{tr(category.descriptionKey)}</span>
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
  sharing = false,
  onShare,
}: {
  /** Stores tournament. */
  tournament: ListFacebookTournamentResponse | null;
  /** Stores loading. */
  loading: boolean;
  /** One player-requested native share is pending. */
  sharing?: boolean;
  /** Present only when the target exposes a real native tournament dialog. */
  onShare?: () => void;
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
              <strong dir="ltr">#{standing.rank}</strong>
              <span dir="ltr">{formatRaceTime(standing.adjustedTimeMs)}</span>
            </li>
          ))}
        </ol>
      )}
      {!loading && tournament?.currentPlayer && onShare && (
        <button className="race-secondary" disabled={sharing} aria-busy={sharing} onClick={onShare}>
          {tr("RaceTo10.SHARE_TOURNAMENT")}
        </button>
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
  /** Safety mutation whose initiating control should display progress. */
  safetyPending: {
    /** Correlated safety operation in flight. */
    operation: "raceBlock" | "raceReport";
    /** Rival whose safety mutation is in flight. */
    targetUserId: string;
  } | null;
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
                  <button
                    type="button"
                    disabled={Boolean(safetyPending)}
                    aria-busy={safetyPending?.operation === "raceBlock" && safetyPending.targetUserId === item.opponentUserId}
                    onClick={() => onBlock(item)}
                  >
                    {tr("RaceTo10.BLOCK_RIVAL")}
                  </button>
                  <label>
                    <span>{tr("RaceTo10.REPORT_REASON")}</span>
                    <select
                      value={reportCategories[item.itemId] ?? "harassment"}
                      disabled={Boolean(safetyPending)}
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
                    disabled={Boolean(safetyPending)}
                    aria-busy={safetyPending?.operation === "raceReport" && safetyPending.targetUserId === item.opponentUserId}
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
  entryStatus,
  busy = false,
  onCancel,
  onAccept,
  onShowResults,
}: {
  /** Stores challenge. */
  challenge: RaceChallengePreview | null;
  /** Typed invitation/readiness facts from authority. */
  entryStatus?: RaceEntryResponse | null;
  /** Prevents duplicate cancellation commands. */
  busy?: boolean;
  /** Creator cancellation adapter, absent for public challenges. */
  onCancel?: () => void;
  /** Stores on accept. */
  onAccept: (categoryId: RaceCategoryId) => void;
  /** Opens the creator’s results without starting another attempt. */
  onShowResults?: () => void;
}) {
  /** Accepted viewer role determines whether the challenge card offers results or acceptance. */
  const isCreator = entryStatus?.status === "ready" && (entryStatus.viewerRole === "creator" || entryStatus.invitation?.role === "creator");
  return (
    <div className="race-panel race-challenge-card">
      {entryStatus?.status === "ready" && entryStatus.existingRunId ? <p role="status">{tr("RaceTo10.LOADING_CHALLENGE")}</p> : challenge ? (
        <>
          <h2>{isCreator ? tr("RaceTo10.RESULT_RECORDED") : tr("RaceTo10.CHALLENGED_BY", {name: challenge.creator.displayName})}</h2>
          <p>{tr("RaceTo10.TIME_TO_BEAT", {time: formatRaceTime(challenge.adjustedTimeToBeatMs)})}</p>
          <p>{tr("RaceTo10.FIRST_TO_TEN")} · {tr("RaceTo10.HINT_BUTTON")} {tr("RaceTo10.HINT_PENALTY")} · {tr("RaceTo10.SKIP_BUTTON")} {tr("RaceTo10.SKIP_PENALTY")}</p>
          {challenge.status === "active" && !isCreator ? (
            <button className="race-primary" onClick={() => onAccept(challenge.categoryId)}>
              {tr("RaceTo10.ACCEPT_CHALLENGE")}
            </button>
          ) : challenge.status !== "active" ? (
            <p role="alert">{tr("RaceTo10.ERROR_GENERIC")}</p>
          ) : null}
          {isCreator && onShowResults && <button className="race-primary" onClick={onShowResults}>{tr("RaceTo10.CHECK_RESULTS")}</button>}
        </>
      ) : (
        <p role="status">{tr(entryStatus?.status === "waiting" ? "RaceTo10.WAITING_PUBLICATION" : entryStatus?.status === "cancelled" ? "RaceTo10.INVITATION_CANCELLED" : entryStatus?.status === "expired" ? "RaceTo10.INVITATION_EXPIRED" : entryStatus?.status === "unavailable" ? "RaceTo10.ERROR_GENERIC" : "RaceTo10.LOADING_CHALLENGE")}</p>
      )}
      {entryStatus && (entryStatus.status === "waiting" || entryStatus.status === "ready") && entryStatus.invitation?.canCancel && onCancel && (
        <button className="race-secondary" disabled={busy} onClick={onCancel}>{tr("RaceTo10.CANCEL_INVITATION")}</button>
      )}
    </div>
  );
}
