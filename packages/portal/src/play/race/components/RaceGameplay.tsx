import type {Feedback, ScoredGuess} from "@qwordly/core/game";
import type {RaceRunView} from "@qwordly/core/race";
import type {RefObject} from "react";
import {tr} from "../../i18n";
import {ControlledGuessBoard, ControlledKeyboard, ForwardIcon, HintIcon} from "../../GameFrameControls";
import {RaceScoreboard} from "./RaceScoreboard";

/** Renders the active riddle, controlled input, actions, and multiplayer rail. */
export function RaceGameplay({
  viewportRef,
  gameplayRef,
  run,
  adjustedNow,
  ghostCorrect,
  feedback,
  coins,
  currentLetters,
  activeSlotIndex,
  guesses,
  letterStates,
  pending,
  onClose,
  onSelectSlot,
  onLetter,
  onBackspace,
  onHint,
  onSubmit,
  onSkip,
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
  gameplayRef: RefObject<HTMLDivElement | null>;
  run: RaceRunView;
  adjustedNow: number;
  ghostCorrect: number;
  feedback: "correct" | "incorrect" | null;
  coins: number;
  currentLetters: string[];
  activeSlotIndex: number;
  guesses: ScoredGuess[];
  letterStates: Record<string, Feedback>;
  pending: boolean;
  onClose: () => void;
  onSelectSlot: (index: number) => void;
  onLetter: (letter: string) => void;
  onBackspace: () => void;
  onHint: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  return (
    <div ref={viewportRef} className="race-gameplay-viewport">
      <div ref={gameplayRef} className="race-gameplay">
        <RaceScoreboard
          run={run}
          adjustedNow={adjustedNow}
          ghostCorrect={ghostCorrect}
          feedback={feedback}
          coins={coins}
          onClose={onClose}
        />
        {run.currentRiddle && (
          <>
            <section className="riddle-surface race-riddle-surface">
              <div className="riddle-card">
                <h2>{run.currentRiddle.text}</h2>
              </div>
              <ControlledGuessBoard
                answerLength={run.currentRiddle.answerLength}
                currentLetters={currentLetters}
                activeSlotIndex={activeSlotIndex}
                hintRevealedIndices={run.currentRiddle.revealedLetters.map(({index}) => index)}
                guesses={guesses}
                onSelectSlot={onSelectSlot}
                disabled={pending}
              />
            </section>
            <ControlledKeyboard
              letterStates={letterStates}
              onLetter={onLetter}
              onBackspace={onBackspace}
              disabled={pending}
            />
          </>
        )}
        <div className="game-input-actions race-actions" aria-describedby="race-attempts">
          <button onClick={onHint} disabled={pending || !run.currentRiddle?.hintAvailable}>
            <HintIcon />
            <span>{tr("RaceTo10.HINT_BUTTON")} <small>{tr("RaceTo10.HINT_PENALTY")}</small></span>
          </button>
          <button
            className="submit-action"
            onClick={onSubmit}
            disabled={pending || currentLetters.length !== run.currentRiddle?.answerLength || currentLetters.some((letter) => !letter)}
          >
            {tr("RaceTo10.SUBMIT")}
          </button>
          <button onClick={onSkip} disabled={pending || (run.currentRiddle?.guessesUsed ?? 0) < 1}>
            <ForwardIcon />
            <span>{tr("RaceTo10.SKIP_BUTTON")} <small>{tr("RaceTo10.SKIP_PENALTY")}</small></span>
          </button>
        </div>
      </div>
    </div>
  );
}
