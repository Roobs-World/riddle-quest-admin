import type {PublishRaceChallengeResponse, RaceCategoryId, RaceOutcome, RaceRunView} from "../../contracts/index";
import {tr} from "../../../localization/browser/i18n";
import {formatRaceTime} from "../../presentation/racePresentation";
import {getGhostCorrectCount} from "../../presentation/racePlayback";

/** Displays authoritative race timing, publication, and rematch actions. */
export function RaceResultPanel({
  outcome,
  run,
  publication,
  publishing,
  sharing = false,
  sharingRewardCoins,
  sharingLabel,
  sharingReadyText,
  onPublish,
  onShare,
  onRematch,
  onChooseCategory,
  onClose,
}: {
  /** Stores outcome. */
  outcome: RaceOutcome;
  /** Stores run. */
  run: RaceRunView | null;
  /** Stores publication. */
  publication: PublishRaceChallengeResponse | null;
  /** Stores publishing. */
  publishing: boolean;
  /** Whether the provider-owned share flow is opening or active. */
  sharing?: boolean;
  /** Stores sharing reward coins. */
  sharingRewardCoins?: number;
  /** Target-owned native share button text. */
  sharingLabel?: string;
  /** Target-owned share instructions. */
  sharingReadyText?: string;
  /** Stores on publish. */
  onPublish: () => void;
  /** Stores on share. */
  onShare: () => void;
  /** Stores on rematch. */
  onRematch: (categoryId: RaceCategoryId) => void;
  /** Stores on choose category. */
  onChooseCategory: () => void;
  /** Stores on close. */
  onClose: () => void;
}) {
  /** Opponent's final replay score at the player's terminal adjusted time. */
  const opponentCorrect = getGhostCorrectCount(run?.opponent, outcome.adjustedFinishMs);
  return (
    <div className="race-panel race-result" aria-live="polite">
      <h2>{tr(`RaceTo10.RESULT_${(outcome.result === "ghost_win" ? "opponent_win" : outcome.result).toUpperCase()}`)}</h2>
      {run?.opponent ? (
        <div className="race-result-score" role="group" aria-label={tr("RaceTo10.PROGRESS_LABEL")}>
          <span>
            <small>{tr("RaceTo10.YOU")}</small>
            <strong>{outcome.correctCount}/{run.rules.targetCorrect}</strong>
          </span>
          <span>
            <small>{run.opponent.displayName}</small>
            <strong>{opponentCorrect}/{run.rules.targetCorrect}</strong>
          </span>
        </div>
      ) : null}
      <div className="race-result-grid">
        <span>
          {tr("RaceTo10.WALL_TIME")}
          <strong>{formatRaceTime(outcome.wallFinishMs)}</strong>
        </span>
        <span>
          {tr("RaceTo10.HINT_TIME")}
          <strong>+{formatRaceTime(outcome.hintPenaltyMs)}</strong>
        </span>
        <span>
          {tr("RaceTo10.SKIP_TIME")}
          <strong>+{formatRaceTime(outcome.skipPenaltyMs)}</strong>
        </span>
        <span>
          {tr("RaceTo10.FINAL_TIME")}
          <strong>{formatRaceTime(outcome.adjustedFinishMs)}</strong>
        </span>
      </div>
      {sharingRewardCoins !== undefined && outcome.publishable ? <p>{sharingReadyText ?? tr("RaceTo10.CHALLENGE_FRIEND")}</p> : null}
      {sharingRewardCoins !== undefined && outcome.publishable && !publication ? (
        <button className="race-primary" onClick={onPublish} disabled={publishing} aria-busy={publishing}>
          {tr("RaceTo10.CREATE_CHALLENGE")}
        </button>
      ) : null}
      {sharingRewardCoins !== undefined && publication ? (
        <button className="race-primary" onClick={onShare} disabled={sharing} aria-busy={sharing}>
          {sharingLabel ?? tr("RaceTo10.SHARE_CHALLENGE", {coins: sharingRewardCoins})}
        </button>
      ) : null}
      {outcome.rematchEligible && run && (
        <div className="race-rematch-actions">
          <button className="race-primary" onClick={() => onRematch(run.categoryId)}>
            {tr("RaceTo10.TITLE")} · {tr(`RaceTo10.CATEGORY_${run.categoryId.toUpperCase()}_NAME`)}
          </button>
          <button onClick={onChooseCategory}>{tr("RaceTo10.CHOOSE_CATEGORY")}</button>
        </div>
      )}
      <button onClick={onClose}>{tr("RaceTo10.BACK_TO_GAME")}</button>
    </div>
  );
}
