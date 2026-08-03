import type {CSSProperties} from "react";
import type {
  ListRaceCategoriesResponse,
  RaceCategoryId,
  RaceChallengePreview,
  RaceInboxItem,
} from "@qwordly/core/race";
import {tr} from "../../i18n";
import {formatRaceTime} from "../logic/racePresentation";

/** Displays available server-provided categories and navigation to race results. */
export function RaceCategoriesPanel({
  categories,
  loading,
  onSelect,
  onShowInbox,
}: {
  categories: ListRaceCategoriesResponse["categories"];
  loading: boolean;
  onSelect: (categoryId: RaceCategoryId) => void;
  onShowInbox: () => void;
}) {
  return (
    <div className="race-panel">
      <h2>{tr("RaceTo10.CHOOSE_CATEGORY")}</h2>
      <p>{tr("RaceTo10.RULES_SUMMARY")}</p>
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

/** Displays completed multiplayer results and rematch controls. */
export function RaceInboxPanel({
  items,
  loading,
  onRematch,
  onChooseCategory,
}: {
  items: RaceInboxItem[];
  loading: boolean;
  onRematch: (item: RaceInboxItem) => void;
  onChooseCategory: () => void;
}) {
  return (
    <div className="race-panel race-inbox">
      <h2>{tr("RaceTo10.RESULTS_TITLE")}</h2>
      {loading ? (
        <p aria-live="polite">{tr("RaceTo10.RESULTS_LOADING")}</p>
      ) : items.length === 0 ? (
        <p>{tr("RaceTo10.RESULTS_EMPTY")}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.itemId}>
              {item.opponentAvatarUrl ? <img src={item.opponentAvatarUrl} alt="" /> : <span aria-hidden="true">⚔️</span>}
              <div>
                <strong>{tr(
                  item.result === "win"
                    ? "RaceTo10.RESULT_PLAYER_WIN"
                    : item.result === "loss"
                      ? "RaceTo10.RESULT_GHOST_WIN"
                      : "RaceTo10.RESULT_TIE",
                )}</strong>
                <span>{item.opponentDisplayName}</span>
                <small>{tr("RaceTo10.RESULT_MARGIN", {time: formatRaceTime(Math.abs(item.adjustedDeltaMs))})}</small>
              </div>
              <button className="race-primary" onClick={() => onRematch(item)}>
                {tr("RaceTo10.REMATCH")}
              </button>
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
  challenge: RaceChallengePreview | null;
  onAccept: (categoryId: RaceCategoryId) => void;
}) {
  return (
    <div className="race-panel race-challenge-card">
      {challenge ? (
        <>
          <h2>{tr("RaceTo10.CHALLENGED_BY", {name: challenge.creator.displayName})}</h2>
          <p>{tr("RaceTo10.TIME_TO_BEAT", {time: formatRaceTime(challenge.adjustedTimeToBeatMs)})}</p>
          <p>{tr("RaceTo10.RULES_SUMMARY")}</p>
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
