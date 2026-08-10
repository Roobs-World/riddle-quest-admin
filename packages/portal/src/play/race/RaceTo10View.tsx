import type {RefObject} from "react";
import type {Feedback, ScoredGuess} from "@qwordly/core/game";
import type {
  ListRaceCategoriesResponse,
  PublishRaceChallengeResponse,
  RaceCategoryId,
  RaceChallengePreview,
  RaceInboxItem,
  RaceOutcome,
  RaceRunView,
} from "@qwordly/core/race";
import {tr} from "../i18n";
import {SpinningWheelLoader} from "../SpinningWheelLoader";
import {RaceCountdown} from "./components/RaceCountdown";
import {RaceGameplay} from "./components/RaceGameplay";
import {RaceTopbar} from "./components/RaceHeader";
import {RaceCategoriesPanel, RaceChallengePanel, RaceInboxPanel} from "./components/RaceLobbyPanels";
import {RaceQuitDialog} from "./components/RaceQuitDialog";
import {RaceResultPanel} from "./components/RaceResultPanel";
import type {RaceOperation} from "./logic/raceOperations";

/** Describes race stage. */
export type RaceStage = "categories" | "challenge" | "inbox" | "countdown" | "racing" | "result";

/** Describes race to10 view props. */
export type RaceTo10ViewProps = {
  /** Stores stage. */
  stage: RaceStage;
  /** Stores coins. */
  coins: number;
  /** Stores error. */
  error: string | null;
  /** Stores categories. */
  categories: ListRaceCategoriesResponse["categories"];
  /** Stores inbox items. */
  inboxItems: RaceInboxItem[];
  /** Stores challenge. */
  challenge: RaceChallengePreview | null;
  /** Stores countdown. */
  countdown: number;
  /** Stores run. */
  run: RaceRunView | null;
  /** Stores outcome. */
  outcome: RaceOutcome | null;
  /** Stores published. */
  published: PublishRaceChallengeResponse | null;
  /** Stores pending. */
  pending: RaceOperation | null;
  /** Stores adjusted now. */
  adjustedNow: number;
  /** Stores ghost correct. */
  ghostCorrect: number;
  /** Stores feedback. */
  feedback: "correct" | "incorrect" | null;
  /** Stores penalty flash. */
  penaltyFlash: string | null;
  /** Stores current letters. */
  currentLetters: string[];
  /** Stores active slot index. */
  activeSlotIndex: number;
  /** Stores race guesses. */
  raceGuesses: ScoredGuess[];
  /** Stores letter states. */
  letterStates: Record<string, Feedback>;
  /** Stores quit confirmation open. */
  quitConfirmationOpen: boolean;
  /** Stores race guess loading. */
  raceGuessLoading: boolean;
  /** Stores dialog ref. */
  dialogRef: RefObject<HTMLElement | null>;
  /** Stores gameplay viewport ref. */
  gameplayViewportRef: RefObject<HTMLDivElement | null>;
  /** Stores gameplay ref. */
  gameplayRef: RefObject<HTMLDivElement | null>;
  /** Stores quit dialog ref. */
  quitDialogRef: RefObject<HTMLDivElement | null>;
  /** Stores on close. */
  onClose: () => void;
  /** Stores on retry. */
  onRetry: () => void;
  /** Stores on request close. */
  onRequestClose: () => void;
  /** Stores on show inbox. */
  onShowInbox: () => void;
  /** Stores on choose category. */
  onChooseCategory: () => void;
  /** Stores on select category. */
  onSelectCategory: (categoryId: RaceCategoryId) => void;
  /** Stores on inbox rematch. */
  onInboxRematch: (item: RaceInboxItem) => void;
  /** Stores on select slot. */
  onSelectSlot: (index: number) => void;
  /** Stores on letter. */
  onLetter: (letter: string) => void;
  /** Stores on backspace. */
  onBackspace: () => void;
  /** Stores on hint. */
  onHint: () => void;
  /** Stores on submit. */
  onSubmit: () => void;
  /** Stores on skip. */
  onSkip: () => void;
  /** Stores on publish. */
  onPublish: () => void;
  /** Stores on share. */
  onShare: () => void;
  /** Stores on rematch. */
  onRematch: (categoryId?: RaceCategoryId, rivalryId?: string) => void;
  /** Stores on dismiss quit. */
  onDismissQuit: () => void;
  /** Stores on abandon. */
  onAbandon: () => void;
};

/** Pure presentation for the Race to 10 state machine. */
export function RaceTo10View(props: RaceTo10ViewProps) {
  const {
    stage, coins, error, categories, inboxItems, challenge, countdown, run, outcome, published, pending,
    adjustedNow, ghostCorrect, feedback, penaltyFlash, currentLetters, activeSlotIndex, raceGuesses,
    letterStates, quitConfirmationOpen, raceGuessLoading, dialogRef, gameplayViewportRef, gameplayRef,
    quitDialogRef, onClose, onRetry, onRequestClose, onShowInbox, onChooseCategory, onSelectCategory,
    onInboxRematch, onSelectSlot, onLetter, onBackspace, onHint, onSubmit, onSkip, onPublish, onShare,
    onRematch, onDismissQuit, onAbandon,
  } = props;
  return (
    <section ref={dialogRef} className={stage === "racing" ? "race-screen race-screen-gameplay" : "race-screen"}
      data-analytics-screen={`multiplayer_${stage}`} role="dialog" aria-modal="true" aria-labelledby="race-title" tabIndex={-1}>
      {stage !== "racing" && stage !== "countdown" && <RaceTopbar coins={coins} onClose={onRequestClose} />}
      {error && <div className="race-error" role="alert">{error}<button onClick={onRetry}>{tr("RaceTo10.RETRY")}</button></div>}
      {stage === "categories" && <RaceCategoriesPanel categories={categories} loading={pending === "raceCategories"}
        onSelect={onSelectCategory} onShowInbox={onShowInbox} />}
      {stage === "inbox" && <RaceInboxPanel items={inboxItems} loading={pending === "raceInbox"}
        onRematch={onInboxRematch} onChooseCategory={onChooseCategory} />}
      {stage === "challenge" && <RaceChallengePanel challenge={challenge} onAccept={onSelectCategory} />}
      {stage === "countdown" && <RaceCountdown countdown={countdown} loading={pending === "raceStart"}
        coins={coins} onClose={onRequestClose} />}
      {stage === "racing" && run && <RaceGameplay viewportRef={gameplayViewportRef} gameplayRef={gameplayRef}
        run={run} adjustedNow={adjustedNow} ghostCorrect={ghostCorrect} feedback={feedback} coins={coins}
        currentLetters={currentLetters} activeSlotIndex={activeSlotIndex} guesses={raceGuesses}
        letterStates={letterStates} pending={Boolean(pending)} onClose={onRequestClose} onSelectSlot={onSelectSlot}
        onLetter={onLetter} onBackspace={onBackspace} onHint={onHint} onSubmit={onSubmit} onSkip={onSkip} />}
      {stage === "racing" && penaltyFlash && <div className="race-penalty-flash" role="status">{penaltyFlash}</div>}
      {stage === "result" && outcome && <RaceResultPanel outcome={outcome} run={run} publication={published}
        publishing={Boolean(pending)} onPublish={onPublish} onShare={onShare} onRematch={onRematch}
        onChooseCategory={() => onRematch()} onClose={onClose} />}
      {quitConfirmationOpen && run?.status === "active" && <RaceQuitDialog dialogRef={quitDialogRef} error={error}
        abandoning={pending === "raceAbandon"} onCancel={onDismissQuit} onConfirm={onAbandon} />}
      {raceGuessLoading && <SpinningWheelLoader overlay className="race-operation-loader" />}
    </section>
  );
}
