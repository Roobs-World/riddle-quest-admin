import type {CSSProperties} from "react";
import type {RaceRunView} from "@riddle-quest/core/race";
import {tr} from "../../i18n";
import {formatRaceTime} from "../logic/racePresentation";
import {RaceRailHeader} from "./RaceHeader";
import {LiveRaceElapsedTime, type LiveRaceClockAnchor} from "./LiveRaceElapsedTime";

/** Displays authoritative progress and timing in the right-hand multiplayer rail. */
export function RaceScoreboard({
  run,
  live = false,
  adjustedNow,
  liveClock,
  opponentCorrect,
  feedback,
  coins,
  onClose,
}: {
  /** Stores run. */
  run: RaceRunView;
  /** Selects live PvP header wording. */
  live?: boolean;
  /** Stores adjusted now. */
  adjustedNow: number;
  /** Live clock animates independently of the board and keyboard. */
  liveClock?: LiveRaceClockAnchor;
  /** Server-confirmed opponent score. */
  opponentCorrect: number;
  /** Stores feedback. */
  feedback: "correct" | "incorrect" | null;
  /** Stores coins. */
  coins: number;
  /** Stores on close. */
  onClose: () => void;
}) {
  /** Converts a completed-riddle count into progress toward this race's target. */
  const progressPercent = (correctCount: number) => `${(correctCount / run.rules.targetCorrect) * 100}%`;
  /** Formats the visible score so the bar's purpose and target are explicit. */
  const formatScore = (correctCount: number) =>
    `${tr("RaceTo10.PROGRESS_LABEL")}: ${correctCount} / ${run.rules.targetCorrect}`;

  return (
    <section className="race-scoreboard" aria-label={tr("RaceTo10.PROGRESS_LABEL")}>
      <RaceRailHeader live={live} coins={coins} onClose={onClose} />
      <div className="race-rail-game-info">
        <div className="race-header-clock" aria-live="polite">
          <span>{tr("RaceTo10.ADJUSTED_TIME")}</span>
          <strong>{liveClock && run.status !== "completed" ? <LiveRaceElapsedTime anchor={liveClock} penaltyMs={run.totalPenaltyMs} /> : formatRaceTime(run.status === "completed" ? run.adjustedElapsedMs : adjustedNow)}</strong>
          <small aria-label={tr("RaceTo10.PENALTIES", {time: formatRaceTime(run.totalPenaltyMs)})}>
            +{formatRaceTime(run.totalPenaltyMs)}
          </small>
        </div>
        <div
          className={`race-feedback ${feedback ?? "idle"}`}
          role="status"
          aria-live="polite"
          aria-hidden={feedback ? undefined : true}
        >
          {feedback ? tr(feedback === "correct" ? "RaceTo10.CORRECT" : "RaceTo10.TRY_AGAIN") : "\u00a0"}
        </div>
        <div className="race-progress">
          <div style={{"--race-progress": progressPercent(run.correctCount)} as CSSProperties}>
            <span title={tr("RaceTo10.YOU")}>{tr("RaceTo10.YOU")}</span>
            <strong aria-label={formatScore(run.correctCount)}><span className="sr-only">{tr("RaceTo10.PROGRESS_LABEL")}: </span>{run.correctCount} / {run.rules.targetCorrect}</strong>
            <div className="race-progress-track" aria-hidden="true">
              <i />
            </div>
            <progress className="sr-only" max="10" value={run.correctCount}>
              {run.correctCount}/10
            </progress>
          </div>
          {run.opponent && (
            <div style={{"--race-progress": progressPercent(opponentCorrect)} as CSSProperties}>
              <span title={run.opponent.displayName}>{run.opponent.displayName}</span>
              <strong aria-label={formatScore(opponentCorrect)}><span className="sr-only">{tr("RaceTo10.PROGRESS_LABEL")}: </span>{opponentCorrect} / {run.rules.targetCorrect}</strong>
              <div className="race-progress-track" aria-hidden="true">
                <i />
              </div>
              <progress className="sr-only" max="10" value={opponentCorrect}>
                {opponentCorrect}/10
              </progress>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
