import type {
  PublishRaceChallengeResponse,
  RaceCategoryId,
  RaceOutcome,
  RaceRunView,
} from "@qwordly/core/race";
import {tr} from "../../i18n";
import {JEST_REFERRAL_REWARD_COINS} from "@qwordly/core/referrals";
import {formatRaceTime} from "../logic/racePresentation";

/** Displays authoritative race timing, publication, and rematch actions. */
export function RaceResultPanel({
  outcome,
  run,
  publication,
  publishing,
  onPublish,
  onShare,
  onRematch,
  onChooseCategory,
  onClose,
}: {
  outcome: RaceOutcome;
  run: RaceRunView | null;
  publication: PublishRaceChallengeResponse | null;
  publishing: boolean;
  onPublish: () => void;
  onShare: () => void;
  onRematch: (categoryId: RaceCategoryId) => void;
  onChooseCategory: () => void;
  onClose: () => void;
}) {
  return (
    <div className="race-panel race-result" aria-live="polite">
      <h2>{tr(`RaceTo10.RESULT_${outcome.result.toUpperCase()}`)}</h2>
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
      {outcome.publishable && !publication && (
        <button className="race-primary" onClick={onPublish} disabled={publishing}>
          {tr("RaceTo10.CREATE_CHALLENGE")}
        </button>
      )}
      {publication && (
        <>
          <p>{tr("RaceTo10.CHALLENGE_READY")}</p>
          <button className="race-primary" onClick={onShare}>
            {tr("RaceTo10.SHARE_CHALLENGE", {coins: JEST_REFERRAL_REWARD_COINS})}
          </button>
        </>
      )}
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
