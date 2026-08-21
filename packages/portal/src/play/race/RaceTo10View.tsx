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
  SocialReportCategory,
  ListFacebookTournamentResponse,
  ListFacebookContextBoardResponse,
} from "@qwordly/core/race";
import {tr} from "../i18n";
import {SpinningWheelLoader} from "../SpinningWheelLoader";
import {RaceCountdown} from "./components/RaceCountdown";
import {RaceGameplay} from "./components/RaceGameplay";
import {RaceHubTabs} from "./components/RaceHubTabs";
import {RaceTopbar} from "./components/RaceHeader";
import {
  RaceCategoriesPanel,
  RaceChallengePanel,
  RaceInboxPanel,
  RaceTournamentPanel,
} from "./components/RaceLobbyPanels";
import {RaceQuitDialog} from "./components/RaceQuitDialog";
import {RaceResultPanel} from "./components/RaceResultPanel";
import {PlatformPlayerOverlay} from "./components/PlatformPlayerOverlay";
import type {RaceOperation} from "./logic/raceOperations";
import type {OverlayCapability} from "../../platform/types";

/** Describes race stage. */
export type RaceStage = "categories" | "challenge" | "inbox" | "tournaments" | "countdown" | "racing" | "result";

/** Describes race to10 view props. */
export type RaceTo10ViewProps = {
  /** Stores stage. */
  stage: RaceStage;
  /** Stores coins. */
  coins: number;
  /** Stores error. */
  error: string | null;
  /** Stores the latest successful social-safety action. */
  safetyNotice: string | null;
  /** Stores categories. */
  categories: ListRaceCategoriesResponse["categories"];
  /** Stores inbox items. */
  inboxItems: RaceInboxItem[];
  /** Identity-free active Facebook tournament view. */
  tournament: ListFacebookTournamentResponse | null;
  /** Whether the optional tournament view is loading. */
  tournamentLoading: boolean;
  /** Identity-free active Facebook context board. */
  contextBoard: ListFacebookContextBoardResponse | null;
  /** Whether the optional current-context board is loading. */
  contextBoardLoading: boolean;
  /** Provider-owned current-player identity renderer for Facebook social surfaces. */
  playerOverlay?: OverlayCapability;
  /** Stores platform player id. */
  platformPlayerId?: string;
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
  /** Stores the active Facebook social picker operation. */
  socialPending: "context" | "match" | null;
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
  /** Opens the optional platform tournament view. */
  onShowTournaments?: () => void;
  /** Stores on choose category. */
  onChooseCategory: () => void;
  /** Stores on select category. */
  onSelectCategory: (categoryId: RaceCategoryId) => void;
  /** Stores on inbox rematch. */
  onInboxRematch: (item: RaceInboxItem) => void;
  /** Immediately blocks a linked rival from the activity list. */
  onBlockRival: (item: RaceInboxItem) => void;
  /** Sends one categorized linked-rival report. */
  onReportRival: (item: RaceInboxItem, category: SocialReportCategory) => void;
  /** Stores on select slot. */
  onSelectSlot: (index: number) => void;
  /** Stores on letter. */
  onLetter: (letter: string) => void;
  /** Commits one complete device-keyboard composition or paste. */
  onText: (text: string) => void;
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
  /** Opens the platform friend/thread/group context picker when supported. */
  onChooseNativeContext?: () => void;
  /** Starts locale-isolated offline platform matchmaking when supported. */
  onMatchNativePlayer?: () => void;
};

/** Pure presentation for the Race to 10 state machine. */
export function RaceTo10View(props: RaceTo10ViewProps) {
  const {
    stage, coins, error, safetyNotice, categories, inboxItems, tournament, tournamentLoading,
    contextBoard, contextBoardLoading, challenge, countdown, run, outcome, published, pending,
    adjustedNow, ghostCorrect, feedback, penaltyFlash, currentLetters, activeSlotIndex, raceGuesses,
    letterStates, quitConfirmationOpen, raceGuessLoading, socialPending, dialogRef, gameplayViewportRef, gameplayRef,
    quitDialogRef, onClose, onRetry, onRequestClose, onShowInbox, onShowTournaments, onChooseCategory, onSelectCategory,
    onInboxRematch, onBlockRival, onReportRival, onSelectSlot, onLetter, onText, onBackspace, onHint, onSubmit, onSkip, onPublish, onShare,
    onRematch, onDismissQuit, onAbandon, onChooseNativeContext, onMatchNativePlayer,
    playerOverlay, platformPlayerId,
  } = props;
  return (
    <section ref={dialogRef} className={stage === "racing" ? "race-screen race-screen-gameplay" : "race-screen"}
      data-analytics-screen={`multiplayer_${stage}`} role="dialog" aria-modal="true" aria-labelledby="race-title" tabIndex={-1}>
      {stage !== "racing" && stage !== "countdown" && <RaceTopbar coins={coins} onClose={onRequestClose} />}
      {error && <div className="race-error" role="alert">{error}<button onClick={onRetry}>{tr("RaceTo10.RETRY")}</button></div>}
      {safetyNotice && <p className="race-safety-notice" role="status">{safetyNotice}</p>}
      {(stage === "categories" || stage === "inbox" || stage === "tournaments") && <RaceHubTabs
        active={stage === "inbox" ? "activity" : stage === "tournaments" ? "tournaments" : "play"}
        onPlay={onChooseCategory}
        onActivity={onShowInbox}
        onTournaments={onShowTournaments}
        onChooseContext={onChooseNativeContext}
        onMatchPlayer={onMatchNativePlayer}
        socialPending={socialPending}
      />}
      {(stage === "inbox" || stage === "tournaments") && playerOverlay && platformPlayerId &&
        <PlatformPlayerOverlay overlay={playerOverlay} playerId={platformPlayerId} />}
      {stage === "categories" && <RaceCategoriesPanel categories={categories} loading={pending === "raceCategories"}
        onSelect={onSelectCategory} onShowInbox={onShowInbox} />}
      {stage === "inbox" && <RaceInboxPanel items={inboxItems} loading={pending === "raceInbox"}
        contextBoard={contextBoard} contextBoardLoading={contextBoardLoading}
        safetyPending={pending === "raceBlock" || pending === "raceReport"}
        onRematch={onInboxRematch} onBlock={onBlockRival} onReport={onReportRival}
        onChooseCategory={onChooseCategory} />}
      {stage === "tournaments" && <RaceTournamentPanel tournament={tournament} loading={tournamentLoading} />}
      {stage === "challenge" && <RaceChallengePanel challenge={challenge} onAccept={onSelectCategory} />}
      {stage === "countdown" && <RaceCountdown countdown={countdown} loading={pending === "raceStart"}
        coins={coins} onClose={onRequestClose} />}
      {stage === "racing" && run && <RaceGameplay viewportRef={gameplayViewportRef} gameplayRef={gameplayRef}
        run={run} adjustedNow={adjustedNow} ghostCorrect={ghostCorrect} feedback={feedback} coins={coins}
        currentLetters={currentLetters} activeSlotIndex={activeSlotIndex} guesses={raceGuesses}
        letterStates={letterStates} pending={Boolean(pending)} onClose={onRequestClose} onSelectSlot={onSelectSlot}
        onLetter={onLetter} onText={onText} onBackspace={onBackspace} onHint={onHint} onSubmit={onSubmit} onSkip={onSkip} />}
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
