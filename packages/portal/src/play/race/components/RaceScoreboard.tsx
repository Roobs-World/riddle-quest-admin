import type {CSSProperties} from "react";
import {RACE_TARGET_CORRECT, type RaceRunView} from "@qwordly/core/race";
import {tr} from "../../i18n";
import {formatRaceTime} from "../logic/racePresentation";
import {RaceRailHeader} from "./RaceHeader";

/** Displays authoritative progress and timing in the right-hand multiplayer rail. */
export function RaceScoreboard({
  run,
  adjustedNow,
  ghostCorrect,
  feedback,
  coins,
  onClose,
}: {
  /** Stores run. */
  run: RaceRunView;
  /** Stores adjusted now. */
  adjustedNow: number;
  /** Stores ghost correct. */
  ghostCorrect: number;
  /** Stores feedback. */
  feedback: "correct" | "incorrect" | null;
  /** Stores coins. */
  coins: number;
  /** Stores on close. */
  onClose: () => void;
}) {
  return (
    <section className="race-scoreboard" aria-label={tr("RaceTo10.PROGRESS_LABEL")}>
      <RaceRailHeader coins={coins} onClose={onClose} />
      <div className="race-rail-game-info">
        <div className="race-header-clock" aria-live="polite">
          <span>{tr("RaceTo10.ADJUSTED_TIME")}</span>
          <strong>{formatRaceTime(adjustedNow)}</strong>
          <small aria-label={tr("RaceTo10.PENALTIES", {time: formatRaceTime(run.totalPenaltyMs)})}>
            +{formatRaceTime(run.totalPenaltyMs)}
          </small>
        </div>
        {run.currentRiddle && (
          <div className="race-rail-status">
            <span>
              {tr("RaceTo10.RIDDLES_REMAINING", {
                count: Math.max(0, RACE_TARGET_CORRECT - run.correctCount),
              })}
            </span>
            <span id="race-attempts">
              {tr("RaceTo10.GUESSES_REMAINING", {count: run.currentRiddle.guessesRemaining})}
            </span>
          </div>
        )}
        {feedback && (
          <div className={`race-feedback ${feedback}`} role="status" aria-live="polite">
            {tr(feedback === "correct" ? "RaceTo10.CORRECT" : "RaceTo10.TRY_AGAIN")}
          </div>
        )}
        <div className="race-progress">
          <div style={{"--race-progress": `${run.correctCount * 10}%`} as CSSProperties}>
            <span title={tr("RaceTo10.YOU")}>{tr("RaceTo10.YOU")}</span>
            <strong>{run.correctCount}</strong>
            <div className="race-progress-track" aria-hidden="true">
              <i />
            </div>
            <progress className="sr-only" max="10" value={run.correctCount}>
              {run.correctCount}/10
            </progress>
          </div>
          {run.opponent && (
            <div style={{"--race-progress": `${ghostCorrect * 10}%`} as CSSProperties}>
              <span title={run.opponent.displayName}>{run.opponent.displayName}</span>
              <strong>{ghostCorrect}</strong>
              <div className="race-progress-track" aria-hidden="true">
                <i />
              </div>
              <progress className="sr-only" max="10" value={ghostCorrect}>
                {ghostCorrect}/10
              </progress>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
