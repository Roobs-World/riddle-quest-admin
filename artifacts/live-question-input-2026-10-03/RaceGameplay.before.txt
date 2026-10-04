import type {Feedback, ScoredGuess} from "@qwordly/core/game";
import type {RaceRunView} from "@qwordly/core/race";
import {useRef, type RefObject} from "react";
import {tr} from "../../i18n";
import {ControlledGuessBoard, ControlledKeyboard, ForwardIcon, HintIcon} from "../../GameFrameControls";
import {raceBoardAttempts} from "../logic/raceBoardAttempts";
import {RaceScoreboard} from "./RaceScoreboard";
import {NativeAnswerInput} from "./NativeAnswerInput";
import type {LiveRaceClockAnchor} from "./LiveRaceElapsedTime";

/** Renders the active riddle, controlled input, actions, and multiplayer rail. */
export function RaceGameplay({
  viewportRef,
  gameplayRef,
  run,
  live = false,
  adjustedNow,
  liveClock,
  opponentCorrect,
  feedback,
  coins,
  currentLetters,
  activeSlotIndex,
  guesses,
  letterStates,
  pending,
  allowTypingWhilePending,
  requiresRunRefresh = false,
  onClose,
  onSelectSlot,
  onLetter,
  onText,
  onBackspace,
  onHint,
  onSubmit,
  onSkip,
}: {
  /** Stores viewport ref. */
  viewportRef: RefObject<HTMLDivElement | null>;
  /** Stores gameplay ref. */
  gameplayRef: RefObject<HTMLDivElement | null>;
  /** Stores run. */
  run: RaceRunView;
  /** Selects live PvP header wording. */
  live?: boolean;
  /** Stores adjusted now. */
  adjustedNow: number;
  /** Live clock animates without rerendering the answer controls. */
  liveClock?: LiveRaceClockAnchor;
  /** Server-confirmed opponent score. */
  opponentCorrect: number;
  /** Stores feedback. */
  feedback: "correct" | "incorrect" | null;
  /** Stores coins. */
  coins: number;
  /** Stores current letters. */
  currentLetters: string[];
  /** Stores active slot index. */
  activeSlotIndex: number;
  /** Stores guesses. */
  guesses: ScoredGuess[];
  /** Stores letter states. */
  letterStates: Record<string, Feedback>;
  /** Stores pending. */
  pending: boolean;
  /** Keeps mutations disabled until uncertain delivery is reconciled. */
  requiresRunRefresh?: boolean;
  /** Allows editing a projected next clue before the previous result arrives. */
  allowTypingWhilePending: boolean;
  /** Stores on close. */
  onClose: () => void;
  /** Stores on select slot. */
  onSelectSlot: (index: number) => void;
  /** Stores on letter. */
  onLetter: (letter: string) => void;
  /** Stores on text. */
  onText: (text: string) => void;
  /** Stores on backspace. */
  onBackspace: () => void;
  /** Stores on hint. */
  onHint: () => void;
  /** Stores on submit. */
  onSubmit: () => void;
  /** Stores on skip. */
  onSkip: () => void;
}) {
  /** Provides native input ref behavior. */
  const nativeInputRef = useRef<HTMLInputElement>(null);
  return (
    <div ref={viewportRef} className="race-gameplay-viewport">
      <div ref={gameplayRef} className="race-gameplay">
        <RaceScoreboard live={live}
          run={run}
          adjustedNow={adjustedNow}
          liveClock={liveClock}
          opponentCorrect={opponentCorrect}
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
                guesses={raceBoardAttempts(guesses, run.currentRiddle.guessesUsed,
                  pending && allowTypingWhilePending && feedback === "incorrect")}
                onSelectSlot={(index) => {
                  onSelectSlot(index);
                  nativeInputRef.current?.focus({preventScroll: true});
                }}
                disabled={pending && !allowTypingWhilePending}
              />
              <NativeAnswerInput
                ref={nativeInputRef}
                disabled={pending && !allowTypingWhilePending}
                locale={run.locale}
                onText={onText}
                onBackspace={onBackspace}
                onSubmit={onSubmit}
              />
            </section>
            <ControlledKeyboard
              letterStates={letterStates}
              onLetter={onLetter}
              onBackspace={onBackspace}
              disabled={pending && !allowTypingWhilePending}
            />
          </>
        )}
        {!run.currentRiddle && run.status !== "active" && (
          <p className="race-outcome-loading" role="status">
            {tr(live ? run.status === "scheduled" ? "Accessibility.LOADING" : "RaceTo10.LIVE_WAITING_FINISH" : "RaceTo10.RESULTS_LOADING")}
          </p>
        )}
        <div className="game-input-actions race-actions">
          <button onClick={onHint} disabled={pending || requiresRunRefresh || !run.currentRiddle?.hintAvailable}>
            <HintIcon />
            <span>
              {tr("RaceTo10.HINT_BUTTON")} <small>{tr("RaceTo10.HINT_PENALTY")}</small>
            </span>
          </button>
          <button
            className="submit-action"
            onClick={onSubmit}
            disabled={
              pending || requiresRunRefresh ||
              currentLetters.length !== run.currentRiddle?.answerLength ||
              currentLetters.some((letter) => !letter)
            }
          >
            {tr("RaceTo10.SUBMIT")}
          </button>
          <button onClick={onSkip} disabled={pending || requiresRunRefresh || !run.currentRiddle}>
            <ForwardIcon />
            <span>
              {tr("RaceTo10.SKIP_BUTTON")} <small>{tr("RaceTo10.SKIP_PENALTY")}</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
