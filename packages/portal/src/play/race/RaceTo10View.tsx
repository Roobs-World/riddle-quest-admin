import type {RefObject} from "react";
import type {Feedback, ScoredGuess} from "@qwordly/core/game";
import type {
  ListRaceCategoriesResponse,
  PublishRaceChallengeResponse,
  RaceCategoryId,
  RaceChallengePreview,
  RaceEntryResponse,
  RaceInboxItem,
  RaceOutcome,
  RaceRunView,
  SocialReportCategory,
  ListFacebookTournamentResponse,
  ListFacebookContextBoardResponse,
} from "@qwordly/core/race";
import {tr} from "../i18n";
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
export type {RaceStage} from "./RaceSession.types";
import type {RaceStage} from "./RaceSession.types";

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
  /** Rival targeted by the current correlated safety mutation. */
  safetyTargetUserId: string | null;
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
  /** Typed readiness for incoming invitations. */
  entryStatus?: RaceEntryResponse | null;
  /** Creator-only cancellation capability. */
  onCancelInvitation?: () => void;
  /** Stores challenge. */
  challenge: RaceChallengePreview | null;
  /** Stores countdown. */
  countdown: number;
  /** Percentage of race data loaded before countdown begins. */
  loadingProgress: number;
  /** Whether the completed loading state has handed off to 3-2-1. */
  countdownReady: boolean;
  /** Stores run. */
  run: RaceRunView | null;
  /** Stores outcome. */
  outcome: RaceOutcome | null;
  /** Stores published. */
  published: PublishRaceChallengeResponse | null;
  /** Referral reward displayed only when this target can share a published challenge. */
  sharingRewardCoins?: number;
  /** Whether a publish intent is queued or in flight. */
  publishRequested: boolean;
  /** Whether the provider share flow is opening or active. */
  sharing: boolean;
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
  /** Lets the player enter the next answer while the prior guess is confirmed. */
  allowTypingWhilePending: boolean;
  /** Whether close is waiting for a just-started run to be abandoned. */
  closeAfterStart: boolean;
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
  /** Search backoff or terminal failure disables recovery until permitted. */
  retryDisabled?: boolean;
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
  /** Provides {
    stage, coins, error, safety notice, categories, inbox items, tournament, tournament loading,
    context board, context board loading, challenge, countdown, loadingProgress, countdownReady, run, outcome, published, sharing reward coins, pending,
    adjusted now, ghost correct, feedback, penalty flash, current letters, active slot index, race guesses,
    letter states, quit confirmation open, race guess loading, social pending, dialog ref, gameplay viewport ref, gameplay ref,
    quit dialog ref, on close, on retry, on request close, on show inbox, on show tournaments, on choose category, on select category,
    on inbox rematch, on block rival, on report rival, on select slot, on letter, on text, on backspace, on hint, on submit, on skip, on publish, on share,
    on rematch, on dismiss quit, on abandon, on choose native context, on match native player,
    player overlay, platform player id,
  } behavior. */
  const {
    stage,
    coins,
    error,
    safetyNotice,
    safetyTargetUserId,
    categories,
    inboxItems,
    tournament,
    tournamentLoading,
    contextBoard,
    contextBoardLoading,
    challenge,
    entryStatus,
    onCancelInvitation,
    countdown,
    loadingProgress,
    countdownReady,
    run,
    outcome,
    published,
    sharingRewardCoins,
    publishRequested,
    sharing,
    pending,
    adjustedNow,
    ghostCorrect,
    feedback,
    penaltyFlash,
    currentLetters,
    activeSlotIndex,
    raceGuesses,
    letterStates,
    quitConfirmationOpen,
    raceGuessLoading,
    allowTypingWhilePending,
    closeAfterStart,
    socialPending,
    dialogRef,
    gameplayViewportRef,
    gameplayRef,
    quitDialogRef,
    onClose,
    onRetry,
    retryDisabled = false,
    onRequestClose,
    onShowInbox,
    onShowTournaments,
    onChooseCategory,
    onSelectCategory,
    onInboxRematch,
    onBlockRival,
    onReportRival,
    onSelectSlot,
    onLetter,
    onText,
    onBackspace,
    onHint,
    onSubmit,
    onSkip,
    onPublish,
    onShare,
    onRematch,
    onDismissQuit,
    onAbandon,
    onChooseNativeContext,
    onMatchNativePlayer,
    playerOverlay,
    platformPlayerId,
  } = props;
  return (
    <section
      ref={dialogRef}
      className={stage === "racing" ? "race-screen race-screen-gameplay" : "race-screen"}
      data-analytics-screen={`multiplayer_${stage}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="race-title"
      tabIndex={-1}
    >
      {stage !== "racing" && stage !== "countdown" && <RaceTopbar coins={coins} onClose={onRequestClose} />}
      {error && (
        <div className="race-error" role="alert">
          {error}
          <button onClick={onRetry} disabled={retryDisabled}>{tr("RaceTo10.RETRY")}</button>
        </div>
      )}
      {safetyNotice && (
        <p className="race-safety-notice" role="status">
          {safetyNotice}
        </p>
      )}
      {(stage === "categories" || stage === "inbox" || stage === "tournaments") && (
        <RaceHubTabs
          active={stage === "inbox" ? "activity" : stage === "tournaments" ? "tournaments" : "play"}
          onPlay={onChooseCategory}
          onActivity={onShowInbox}
          onTournaments={onShowTournaments}
          onChooseContext={onChooseNativeContext}
          onMatchPlayer={onMatchNativePlayer}
          socialPending={socialPending}
        />
      )}
      {(stage === "inbox" || stage === "tournaments") && playerOverlay && platformPlayerId && (
        <PlatformPlayerOverlay overlay={playerOverlay} playerId={platformPlayerId} />
      )}
      {stage === "categories" && (
        <RaceCategoriesPanel
          categories={categories}
          loading={pending === "raceCategories"}
          onSelect={onSelectCategory}
          onShowInbox={onShowInbox}
        />
      )}
      {stage === "inbox" && (
        <RaceInboxPanel
          items={inboxItems}
          loading={pending === "raceInbox"}
          contextBoard={contextBoard}
          contextBoardLoading={contextBoardLoading}
          safetyPending={
            (pending === "raceBlock" || pending === "raceReport") && safetyTargetUserId
              ? {operation: pending, targetUserId: safetyTargetUserId}
              : null
          }
          onRematch={onInboxRematch}
          onBlock={onBlockRival}
          onReport={onReportRival}
          onChooseCategory={onChooseCategory}
        />
      )}
      {stage === "tournaments" && <RaceTournamentPanel tournament={tournament} loading={tournamentLoading} />}
      {stage === "challenge" && <RaceChallengePanel challenge={challenge} entryStatus={entryStatus} onAccept={onSelectCategory} onCancel={onCancelInvitation} busy={Boolean(pending)} />}
      {stage === "countdown" && (
        <RaceCountdown
          countdown={countdown}
          loading={!countdownReady}
          loadingProgress={loadingProgress}
          closing={closeAfterStart}
          coins={coins}
          onClose={onRequestClose}
        />
      )}
      {stage === "racing" && run && (
        <RaceGameplay
          viewportRef={gameplayViewportRef}
          gameplayRef={gameplayRef}
          run={run}
          adjustedNow={adjustedNow}
          ghostCorrect={ghostCorrect}
          feedback={feedback}
          coins={coins}
          currentLetters={currentLetters}
          activeSlotIndex={activeSlotIndex}
          guesses={raceGuesses}
          letterStates={letterStates}
          pending={Boolean(pending)}
          allowTypingWhilePending={allowTypingWhilePending}
          onClose={onRequestClose}
          onSelectSlot={onSelectSlot}
          onLetter={onLetter}
          onText={onText}
          onBackspace={onBackspace}
          onHint={onHint}
          onSubmit={onSubmit}
          onSkip={onSkip}
        />
      )}
      {stage === "racing" && penaltyFlash && (
        <div className="race-penalty-flash" role="status">
          {penaltyFlash}
        </div>
      )}
      {stage === "result" && outcome && (
        <RaceResultPanel
          outcome={outcome}
          run={run}
          publication={published}
          publishing={publishRequested || pending === "racePublish"}
          sharing={sharing}
          sharingRewardCoins={sharingRewardCoins}
          onPublish={onPublish}
          onShare={onShare}
          onRematch={onRematch}
          onChooseCategory={() => onRematch()}
          onClose={onClose}
        />
      )}
      {quitConfirmationOpen && run?.status === "active" && (
        <RaceQuitDialog
          dialogRef={quitDialogRef}
          error={error}
          abandoning={pending === "raceAbandon"}
          onCancel={onDismissQuit}
          onConfirm={onAbandon}
        />
      )}
      {(raceGuessLoading || ((stage === "racing" || stage === "result") && Boolean(pending) && pending !== "raceHint" && pending !== "raceSkip")) && (
        <div className="race-operation-loader" role="status" aria-label={tr("Accessibility.LOADING")} />
      )}
    </section>
  );
}
