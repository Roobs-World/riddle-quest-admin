import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import "../../styles.race-lobby.css";
import "../../styles.race-gameplay.css";
import {parseHostToGameMessage} from "@qwordly/core/bridge";
import {computeFeedback, type ScoredGuess} from "@qwordly/core/game";
import {
  AbandonRaceRunResponseSchema,
  ListRaceCategoriesResponseSchema,
  ListRaceInboxResponseSchema,
  PublishRaceChallengeResponseSchema,
  RaceChallengePreviewSchema,
  RaceOutcomeSchema,
  RaceRunResponseSchema,
  RequestRaceHintResponseSchema,
  SkipRaceRiddleResponseSchema,
  SubmitRaceGuessResponseSchema,
  type ListRaceCategoriesResponse,
  type RaceInboxItem,
  type RaceCategoryId,
  type RaceChallengePreview,
  type RaceOutcome,
  type RaceAnalyticsEventName,
  type RaceRunView,
  type ListFacebookTournamentResponse,
  type ListFacebookContextBoardResponse,
} from "@qwordly/core/race";
import {tr} from "../i18n";
import {HOST_TO_GAME_EVENT} from "../localBridge";
import {createRaceAnalyticsMessage} from "./logic/raceAnalytics";
import {RACE_COUNTDOWN_START} from "./logic/raceCountdown";
import {deleteRaceLetter, insertRaceLetter, insertRaceText, isRaceSlotEditable} from "./logic/raceInput";
import type {RaceOperation} from "./logic/raceOperations";
import {getGhostCorrectCount} from "./logic/racePlayback";
import {applyRaceOutcome, createRaceAttempt, findFirstEditableRaceSlot, getAdjustedRaceTime, getRaceLetterStates, projectInstantRaceSkip, projectRaceOutcome} from "./logic/racePresentation";
import {useRaceDialogFocus, useRaceGameplayFit, useRaceGameplayKeyboard, useRaceOperationLifecycle} from "./hooks";
import {RaceTo10View, type RaceStage} from "./RaceTo10View";
import {readActiveRace, clearActiveRace} from "./logic/activeRaceStorage";
import {EMPTY_RACE_CATEGORIES, type RaceTo10GameProps} from "./RaceTo10Game.types";
import {useActiveRacePersistence, useRaceClockEffects, useRaceEntryTracking, useRaceFeedbackTimers} from "./hooks/useRaceRuntimeEffects";
import {useReferralSharing} from "../sharing/ReferralSharingCapability";

/** Coordinates the complete server-authoritative Race to 10 multiplayer experience. */
export function RaceTo10Game({
  locale,
  challengeId,
  openInbox = false,
  coins,
  ownerId,
  postToHost,
  onClose,
  initialCategories = EMPTY_RACE_CATEGORIES,
  nativeSocial,
  matchmaking,
  playerOverlay,
  platformPlayerId,
  tournaments,
  contextBoard,
}: RaceTo10GameProps) {
  /** Optional outbound sharing supplied by the active release target. */
  const referralSharing = useReferralSharing();
  /** Currently visible multiplayer screen. */
  const [stage, setStage] = useState<RaceStage>(openInbox ? "inbox" : challengeId ? "challenge" : "categories");
  /** Challenge being loaded or accepted by this client. */
  const [activeChallengeId, setActiveChallengeId] = useState(openInbox ? undefined : challengeId);
  /** Challenge used to establish a rematch rivalry. */
  const [rivalryChallengeId, setRivalryChallengeId] = useState<string>();
  /** Server-provided categories available to the player. */
  const [categories, setCategories] = useState<ListRaceCategoriesResponse["categories"]>(initialCategories);
  /** Preview of an incoming multiplayer challenge. */
  const [challenge, setChallenge] = useState<RaceChallengePreview | null>(null);
  /** Completed race results available in the multiplayer inbox. */
  const [inboxItems, setInboxItems] = useState<RaceInboxItem[]>([]);
  /** Briefly reuses this mounted player session’s activity results. */
  const inboxLoadedAtRef = useRef(0);
  /** Provides [tournament, set tournament] behavior. */
  const [tournament, setTournament] = useState<ListFacebookTournamentResponse | null>(null);
  /** Provides [tournament loading, set tournament loading] behavior. */
  const [tournamentLoading, setTournamentLoading] = useState(false);
  /** Provides [context board data, set context board data] behavior. */
  const [contextBoardData, setContextBoardData] = useState<ListFacebookContextBoardResponse | null>(null);
  /** Provides [context board loading, set context board loading] behavior. */
  const [contextBoardLoading, setContextBoardLoading] = useState(false);
  /** Latest authoritative view of the active or completed run. */
  const [run, setRun] = useState<RaceRunView | null>(null);
  /** Authoritative outcome returned after a run finishes. */
  const [outcome, setOutcome] = useState<RaceOutcome | null>(null);
  /** Number currently displayed by the pre-race countdown. */
  const [countdown, setCountdown] = useState(RACE_COUNTDOWN_START);
  /** Letters currently entered for the active riddle. */
  const [currentLetters, setCurrentLetters] = useState<string[]>([]);
  /** Answer slot that receives the next keyboard input. */
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  /** Locally rendered history of guesses scored by the server. */
  const [raceGuesses, setRaceGuesses] = useState<ScoredGuess[]>([]);
  /** Temporary correctness feedback for the latest submitted guess. */
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  /** Marks a local row that the next authoritative guess response must replace or undo. */
  const previewedGuessRef = useRef(false);
  /** Authoritative view restored if an instant local skip cannot be recorded by the server. */
  const skipRollbackRef = useRef<RaceRunView | null>(null);
  /** Temporary text describing a server-applied time penalty. */
  const [penaltyFlash, setPenaltyFlash] = useState<string | null>(null);
  /** Whether the active-race abandonment confirmation is visible. */
  const [quitConfirmationOpen, setQuitConfirmationOpen] = useState(false);
  /** Whether close was requested before the authoritative race-start response arrived. */
  const [closeAfterStart, setCloseAfterStart] = useState(false);
  /** Latest recoverable multiplayer error shown to the player. */
  const [error, setError] = useState<string | null>(null);
  /** Latest successful block/report announcement. */
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);
  /** Provides [social pending, set social pending] behavior. */
  const [socialPending, setSocialPending] = useState<"context" | "match" | null>(null);
  /** Published challenge created from the completed run. */
  const [published, setPublished] = useState<ReturnType<typeof PublishRaceChallengeResponseSchema.parse> | null>(null);
  /** Player intent to publish, retained while background outcome reconciliation finishes. */
  const [publishRequested, setPublishRequested] = useState(false);
  /** Whether the provider-owned recipient picker is being prepared or displayed. */
  const [sharing, setSharing] = useState(false);
  /** Local receipt time used to advance the displayed authoritative clock. */
  const [receivedAtMs, setReceivedAtMs] = useState(Date.now());
  /** Render trigger used to refresh the displayed race clock. */
  const [, setTick] = useState(0);
  /** Provides {
    expected request ref,
    finish operation,
    pending,
    race guess loading,
    send,
    set race guess awaiting outcome,
  } behavior. */
  const {expectedRequestRef, finishOperation, pending, raceGuessLoading, send, setRaceGuessAwaitingOutcome} = useRaceOperationLifecycle({postToHost, setError});
  /** Latest rivalry identifier available synchronously to rematch callbacks. */
  const rivalryChallengeIdRef = useRef<string | undefined>(undefined);
  /** Target associated with the one correlated social-safety operation. */
  const safetyTargetRef = useRef<string | null>(null);
  /** Whether a successful publication should immediately open Jest's recipient picker. */
  const shareAfterPublishRef = useRef(false);
  /** Synchronous guard preventing duplicate provider share dialogs. */
  const sharingRef = useRef(false);
  /** Synchronous close intent consumed by the correlated race-start response. */
  const closeAfterStartRef = useRef(false);
  /** Records ed tournament runs ref. */
  const recordedTournamentRunsRef = useRef(new Set<string>());
  /** Records ed context runs ref. */
  const recordedContextRunsRef = useRef(new Set<string>());
  /** Provides close state ref behavior. */
  const closeStateRef = useRef<{
    /** Stores stage. */
    stage: RaceStage; /** Stores run status. */
    /** Stores run status. */
    runStatus?: RaceRunView["status"];
  }>({stage});
  closeStateRef.current = {stage, ...(run?.status ? {runStatus: run.status} : {})};
  /** Root race dialog used for focus containment and viewport measurement. */
  const dialogRef = useRef<HTMLElement | null>(null);
  /** Viewport whose height is adjusted when gameplay is scaled. */
  const gameplayViewportRef = useRef<HTMLDivElement | null>(null);
  /** Natural gameplay surface measured for responsive scaling. */
  const gameplayRef = useRef<HTMLDivElement | null>(null);
  /** Quit dialog used for focus management while abandonment is confirmed. */
  const quitDialogRef = useRef<HTMLDivElement | null>(null);
  useRaceEntryTracking(stage, challengeId);

  /** Resets local answer input from the latest authoritative riddle. */
  const resetAttempt = useCallback((nextRun: RaceRunView) => {
    setCurrentLetters(createRaceAttempt(nextRun.currentRiddle));
    setActiveSlotIndex(findFirstEditableRaceSlot(nextRun.currentRiddle));
    setRaceGuesses([]);
    setFeedback(null);
  }, []);

  /** Emits a schema-constrained multiplayer analytics event through the host. */
  const analytics = useCallback((eventName: RaceAnalyticsEventName, params: Record<string, string | number | boolean> = {}) => postToHost(createRaceAnalyticsMessage(eventName, params)), [postToHost]);
  /** Opens the host-owned recipient picker for an authoritative published challenge. */
  const sharePublishedChallenge = useCallback(
    async (publication: ReturnType<typeof PublishRaceChallengeResponseSchema.parse>) => {
      if (!referralSharing || sharingRef.current) return;
      sharingRef.current = true;
      setSharing(true);
      analytics("race_share_dialog_opened", {categoryId: publication.preview.categoryId});
      try {
        if ((await referralSharing.shareRace({challengeId: publication.challengeId, preview: publication.preview})) === "error") {
          setError(tr("RaceTo10.ERROR_GENERIC"));
        }
      } finally {
        sharingRef.current = false;
        setSharing(false);
      }
    },
    [analytics, referralSharing],
  );
  /** Opens and refreshes the multiplayer results inbox. */
  const showInbox = useCallback(() => {
    setStage("inbox");
    if (Date.now() - inboxLoadedAtRef.current >= 30_000) send("raceInbox", "game:listRaceInbox", {limit: 20});
    if (contextBoard) {
      setContextBoardLoading(true);
      void contextBoard
        .list(locale)
        .then(setContextBoardData)
        .catch(() => setContextBoardData(null))
        .finally(() => setContextBoardLoading(false));
    }
  }, [contextBoard, locale, send]);
  /** Opens and refreshes the identity-free optional Facebook tournament. */
  const showTournaments = useCallback(() => {
    if (!tournaments || tournamentLoading) return;
    setStage("tournaments");
    setTournamentLoading(true);
    setError(null);
    void tournaments
      .list(locale)
      .then(setTournament)
      .catch(() => setError(tr("RaceTo10.ERROR_GENERIC")))
      .finally(() => setTournamentLoading(false));
  }, [locale, tournamentLoading, tournaments]);

  /** Closes the race or opens confirmation when an active run would be abandoned. */
  const requestClose = useCallback(() => {
    if (closeStateRef.current.stage === "countdown" && pending === "raceStart") {
      closeAfterStartRef.current = true;
      setCloseAfterStart(true);
      return;
    }
    if (closeStateRef.current.stage === "racing" && closeStateRef.current.runStatus === "active") {
      setQuitConfirmationOpen(true);
      return;
    }
    onClose();
  }, [onClose, pending]);

  /** Hides the active-race abandonment confirmation. */
  const dismissQuitConfirmation = useCallback(() => setQuitConfirmationOpen(false), []);
  useRaceDialogFocus({
    dialogRef,
    quitDialogRef,
    quitConfirmationOpen,
    dismissQuitConfirmation,
    requestClose,
  });

  /** Stores a new authoritative run view and requests its outcome when complete. */
  const updateRun = useCallback(
    (next: RaceRunView) => {
      setRun(next);
      setReceivedAtMs(Date.now());
      if (next.status !== "active") {
        send("raceOutcome", "game:getRaceOutcome", {runId: next.runId});
      }
    },
    [send],
  );

  useEffect(() => {
    /** Deferred request used to avoid issuing host messages during render. */
    const timer = window.setTimeout(() => {
      if (openInbox) send("raceInbox", "game:listRaceInbox", {limit: 20});
      else if (challengeId) send("raceChallenge", "game:getRaceChallenge", {challengeId, locale});
      else {
        /** Provides active run id behavior. */
        const activeRunId = readActiveRace(ownerId);
        if (activeRunId) send("raceResume", "game:resumeRace", {runId: activeRunId, includeEvaluation: true});
        else if (initialCategories.length === 0) send("raceCategories", "game:listRaceCategories", {locale});
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [challengeId, initialCategories.length, locale, openInbox, ownerId, send]);

  useEffect(() => {
    /** Processes correlated race-operation responses emitted by the host bridge. */
    const handle = (event: Event) => {
      /** Provides message behavior. */
      let message;
      try {
        message = parseHostToGameMessage((event as CustomEvent<unknown>).detail);
      } catch {
        return;
      }
      if (message.type !== "host:operationResult" || !message.payload.operation.startsWith("race")) return;
      if (message.requestId !== expectedRequestRef.current) return;
      /** Provides operation behavior. */
      const operation = message.payload.operation as RaceOperation;
      if (!message.payload.ok) {
        if (operation === "raceGuess" && previewedGuessRef.current) {
          setRaceGuesses((guesses) => guesses.slice(0, -1));
          setFeedback(null);
          previewedGuessRef.current = false;
        }
        if (operation === "racePublish") {
          shareAfterPublishRef.current = false;
          setPublishRequested(false);
        }
        if (operation === "raceSkip" && skipRollbackRef.current) {
          const rollback = skipRollbackRef.current;
          skipRollbackRef.current = null;
          setRun(rollback);
          setReceivedAtMs(Date.now());
          resetAttempt(rollback);
          setPenaltyFlash(null);
        }
        if (operation === "raceChallenge" && activeChallengeId?.startsWith("jest-invite-") && message.payload.error?.includes("not found")) {
          setError(null);
        } else if (operation === "raceGuess" && message.payload.error?.includes("no longer active")) {
          // The local ghost clock presents the terminal result as soon as this
          // request settles, then reconciles the authoritative outcome.
          setError(null);
        } else {
          setError(message.payload.error === "RaceTo10.ERROR_LOCALE_MISMATCH" ? tr("RaceTo10.ERROR_LOCALE_MISMATCH") : (message.payload.error ?? tr("RaceTo10.ERROR_GENERIC")));
        }
        if (operation === "raceBlock" || operation === "raceReport") safetyTargetRef.current = null;
        if (operation === "raceStart") {
          setRun(null);
          if (closeAfterStartRef.current) {
            closeAfterStartRef.current = false;
            setCloseAfterStart(false);
            onClose();
          } else {
            setStage(activeChallengeId ? "challenge" : "categories");
          }
        } else if (operation === "raceAbandon" && closeAfterStartRef.current) {
          closeAfterStartRef.current = false;
          setCloseAfterStart(false);
          setStage("racing");
        } else if (operation === "raceResume") {
          clearActiveRace(ownerId);
          setRun(null);
          setStage("categories");
          if (initialCategories.length === 0) send("raceCategories", "game:listRaceCategories", {locale});
        }
        finishOperation(operation);
        return;
      }
      try {
        if (operation === "raceCategories") {
          setCategories(ListRaceCategoriesResponseSchema.parse(message.payload.data).categories);
        } else if (operation === "raceResume") {
          /** Provides next run behavior. */
          const nextRun = RaceRunResponseSchema.parse(message.payload.data).run;
          setStage("racing");
          updateRun(nextRun);
          if (nextRun.status === "active") resetAttempt(nextRun);
        } else if (operation === "raceInbox") {
          /** Provides inbox behavior. */
          const inbox = ListRaceInboxResponseSchema.parse(message.payload.data);
          setInboxItems(inbox.items);
          inboxLoadedAtRef.current = Date.now();
          // Navigation belongs to the player; a delayed refresh only updates data.
          analytics("race_inbox_viewed", {resultCount: inbox.items.length});
        } else if (operation === "raceBlock") {
          /** Provides target user id behavior. */
          const targetUserId = safetyTargetRef.current;
          if (
            !targetUserId ||
            typeof message.payload.data !== "object" ||
            message.payload.data === null ||
            (
              message.payload.data as {
                /** Stores blocked. */
                blocked?: unknown;
              }
            ).blocked !== true
          )
            throw new Error("Invalid block response");
          setInboxItems((items) => items.filter((item) => item.opponentUserId !== targetUserId));
          setSafetyNotice(tr("RaceTo10.BLOCK_SUCCESS"));
          safetyTargetRef.current = null;
        } else if (operation === "raceReport") {
          if (
            typeof message.payload.data !== "object" ||
            message.payload.data === null ||
            (
              message.payload.data as {
                /** Stores queued. */
                queued?: unknown;
              }
            ).queued !== true
          )
            throw new Error("Invalid report response");
          setSafetyNotice(tr("RaceTo10.REPORT_SUCCESS"));
          safetyTargetRef.current = null;
        } else if (operation === "raceChallenge") {
          /** Provides preview behavior. */
          const preview = RaceChallengePreviewSchema.parse(message.payload.data);
          setChallenge(preview);
          setError(null);
          analytics("race_link_entered");
        } else if (operation === "raceStart") {
          /** Provides next run behavior. */
          const nextRun = RaceRunResponseSchema.parse(message.payload.data).run;
          updateRun(nextRun);
          if (closeAfterStartRef.current) {
            send("raceAbandon", "game:abandonRace", {runId: nextRun.runId});
          } else {
            resetAttempt(nextRun);
            analytics("race_started", {kind: activeChallengeId ? "challenge" : "creator"});
            analytics("race_attempt_started", {categoryId: nextRun.categoryId});
          }
        } else if (operation === "raceAbandon") {
          /** Provides abandoned behavior. */
          const abandoned = AbandonRaceRunResponseSchema.parse(message.payload.data);
          if (abandoned.run.status !== "abandoned" || abandoned.result !== null) throw new Error("Invalid abandon response");
          clearActiveRace(ownerId);
          closeAfterStartRef.current = false;
          setCloseAfterStart(false);
          setRun(abandoned.run);
          setQuitConfirmationOpen(false);
          onClose();
        } else if (operation === "raceGuess") {
          /** Provides result behavior. */
          const result = SubmitRaceGuessResponseSchema.parse(message.payload.data);
          /** Provides previous riddle behavior. */
          const previousRiddle = run?.currentRiddle?.riddleId;
          setRaceGuessAwaitingOutcome(result.run.status !== "active");
          updateRun(result.run);
          if (result.autoSkipped) setPenaltyFlash(tr("RaceTo10.SKIP_PENALTY"));
          if (previousRiddle !== result.run.currentRiddle?.riddleId) {
            resetAttempt(result.run);
          } else {
            /** Whether this response replaces feedback already projected before the host round trip. */
            const replacesPreview = previewedGuessRef.current;
            setRaceGuesses((guesses) => [
              ...(replacesPreview ? guesses.slice(0, -1) : guesses),
              {guess: currentLetters, feedback: result.feedback.map(({status}) => status)},
            ]);
            setCurrentLetters(createRaceAttempt(result.run.currentRiddle));
            setActiveSlotIndex(findFirstEditableRaceSlot(result.run.currentRiddle));
          }
          previewedGuessRef.current = false;
          setFeedback(result.isCorrect ? "correct" : "incorrect");
        } else if (operation === "raceHint") {
          /** Provides result behavior. */
          const result = RequestRaceHintResponseSchema.parse(message.payload.data);
          updateRun(result.run);
          setCurrentLetters((letters) => {
            /** Provides next behavior. */
            const next = [...letters];
            next[result.index] = result.revealedLetter;
            return next;
          });
          if (activeSlotIndex === result.index) setActiveSlotIndex(findFirstEditableRaceSlot(result.run.currentRiddle));
          setPenaltyFlash(tr("RaceTo10.HINT_PENALTY"));
          analytics("race_hint_used", {penaltyMs: 15_000});
        } else if (operation === "raceSkip") {
          /** Provides result behavior. */
          const result = SkipRaceRiddleResponseSchema.parse(message.payload.data);
          skipRollbackRef.current = null;
          updateRun(result.run);
          resetAttempt(result.run);
          setPenaltyFlash(tr("RaceTo10.SKIP_PENALTY"));
          analytics("race_skip_used", {penaltyMs: 45_000});
        } else if (operation === "raceOutcome") {
          /** Confirmed outcome replacing any immediate deterministic projection. */
          const result = RaceOutcomeSchema.parse(message.payload.data);
          setOutcome(result);
          setRun((current) => current && current.runId === result.runId ? applyRaceOutcome(current, result) : current);
          setReceivedAtMs(Date.now());
          setStage("result");
          analytics("race_completed", {
            result: result.result,
            correctCount: result.correctCount,
            hintPenaltyMs: result.hintPenaltyMs,
            skipPenaltyMs: result.skipPenaltyMs,
            adjustedFinishMs: result.adjustedFinishMs,
          });
          analytics("race_attempt_completed", {
            result: result.result,
            adjustedFinishMs: result.adjustedFinishMs,
          });
          analytics("race_result_viewed", {result: result.result});
          if (tournaments && run?.runId && !recordedTournamentRunsRef.current.has(run.runId)) {
            /** Provides tournament run id behavior. */
            const tournamentRunId = run.runId;
            recordedTournamentRunsRef.current.add(tournamentRunId);
            void tournaments.record(tournamentRunId, locale).catch(() => {
              recordedTournamentRunsRef.current.delete(tournamentRunId);
            });
          }
          if (contextBoard && run?.runId && !recordedContextRunsRef.current.has(run.runId)) {
            /** Provides context run id behavior. */
            const contextRunId = run.runId;
            recordedContextRunsRef.current.add(contextRunId);
            void contextBoard.record(contextRunId, locale).catch(() => {
              recordedContextRunsRef.current.delete(contextRunId);
            });
          }
        } else if (operation === "racePublish") {
          /** Provides publication behavior. */
          const publication = PublishRaceChallengeResponseSchema.parse(message.payload.data);
          setPublished(publication);
          setPublishRequested(false);
          analytics("race_challenge_published", {categoryId: publication.preview.categoryId});
          window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {detail: publication}));
          if (shareAfterPublishRef.current) {
            shareAfterPublishRef.current = false;
            void sharePublishedChallenge(publication);
          }
        }
      } catch {
        if (operation === "raceGuess" && previewedGuessRef.current) {
          setRaceGuesses((guesses) => guesses.slice(0, -1));
          setFeedback(null);
          previewedGuessRef.current = false;
        }
        if (operation === "raceSkip" && skipRollbackRef.current) {
          const rollback = skipRollbackRef.current;
          skipRollbackRef.current = null;
          setRun(rollback);
          setReceivedAtMs(Date.now());
          resetAttempt(rollback);
          setPenaltyFlash(null);
        }
        setError(tr("RaceTo10.ERROR_INVALID_RESPONSE"));
      } finally {
        finishOperation(operation);
      }
    };
    window.addEventListener(HOST_TO_GAME_EVENT, handle);
    return () => window.removeEventListener(HOST_TO_GAME_EVENT, handle);
  }, [activeChallengeId, activeSlotIndex, analytics, currentLetters, finishOperation, initialCategories.length, locale, onClose, ownerId, referralSharing, resetAttempt, run?.currentRiddle?.riddleId, send, setRaceGuessAwaitingOutcome, sharePublishedChallenge, updateRun]);

  useEffect(() => {
    if (stage !== "challenge" || !activeChallengeId?.startsWith("jest-invite-") || challenge || pending === "raceChallenge") return;
    /** Retry timer while the creator records the invitation's time to beat. */
    const timer = window.setTimeout(() => {
      send("raceChallenge", "game:getRaceChallenge", {challengeId: activeChallengeId, locale});
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [activeChallengeId, challenge, locale, pending, send, stage]);

  useRaceClockEffects(stage, countdown, closeAfterStart ? null : run, setStage, setCountdown, setTick);

  useRaceGameplayFit({
    active: stage === "racing",
    screenRef: dialogRef,
    viewportRef: gameplayViewportRef,
    gameplayRef,
  });

  useRaceFeedbackTimers(penaltyFlash, feedback, setPenaltyFlash, setFeedback);

  /** Authoritative adjusted elapsed time advanced locally since the last response. */
  const adjustedNow = getAdjustedRaceTime(run, receivedAtMs);

  useEffect(() => {
    if (stage !== "racing" || !run || outcome) return;
    // A mutation already in flight may still establish a last-moment win.
    if (run.status === "active" && pending) return;
    /** Immediate result determined entirely by the latest authoritative run and shared clock. */
    const projected = projectRaceOutcome(run, adjustedNow);
    if (!projected) return;
    setError(null);
    setOutcome(projected);
    setStage("result");
    if (run.status === "active") send("raceOutcome", "game:getRaceOutcome", {runId: run.runId});
  }, [adjustedNow, outcome, pending, run, send, stage]);

  useEffect(() => {
    if (!publishRequested || published || pending || !referralSharing || !run || run.status !== "completed") return;
    shareAfterPublishRef.current = true;
    send("racePublish", "game:publishRace", {runId: run.runId});
  }, [pending, publishRequested, published, referralSharing, run, send]);

  useActiveRacePersistence(run, ownerId);
  /** Opponent score replayed against the adjusted race clock. */
  const ghostCorrect = useMemo(() => getGhostCorrectCount(run?.opponent, adjustedNow), [adjustedNow, run?.opponent]);
  /** Best server-scored feedback seen for each keyboard letter. */
  const letterStates = useMemo(() => getRaceLetterStates(raceGuesses), [raceGuesses]);

  /** Starts an authoritative run and displays its synchronized countdown. */
  const begin = (
    categoryId: RaceCategoryId,
    startContext?: {
      /** Stores challenge id. */
      challengeId?: string; /** Stores rivalry challenge id. */
      /** Stores rivalry challenge id. */
      rivalryChallengeId?: string;
    },
  ) => {
    /** Provides challenge id for start behavior. */
    const challengeIdForStart = startContext ? startContext.challengeId : activeChallengeId;
    /** Provides rivalry id for start behavior. */
    const rivalryIdForStart = startContext ? startContext.rivalryChallengeId : rivalryChallengeId;
    analytics("race_category_selected", {categoryId});
    if (rivalryChallengeIdRef.current) analytics("race_counter_challenge_started", {categoryId});
    inboxLoadedAtRef.current = 0;
    setCountdown(RACE_COUNTDOWN_START);
    setStage("countdown");
    send("raceStart", "game:startRace", challengeIdForStart ? {locale, challengeId: challengeIdForStart, includeEvaluation: true} : {locale, categoryId, includeEvaluation: true, ...(rivalryIdForStart ? {rivalryChallengeId: rivalryIdForStart} : {})});
  };
  /** Submits the complete current answer attempt to the server. */
  const submit = () => {
    if (!run?.currentRiddle || currentLetters.length !== run.currentRiddle.answerLength || currentLetters.some((letter) => !letter) || pending) return;
    if (run.currentRiddle.evaluation) {
      /** The scored used by the current operation. */
      const scored = computeFeedback(currentLetters.join(""), run.currentRiddle.evaluation.answer);
      previewedGuessRef.current = true;
      setRaceGuesses((guesses) => [...guesses, {guess: [...currentLetters], feedback: scored}]);
      setFeedback(scored.every((status) => status === "green") ? "correct" : "incorrect");
    }
    send("raceGuess", "game:submitRaceGuess", {
      runId: run.runId,
      riddleId: run.currentRiddle.riddleId,
      guess: currentLetters.join(""),
      includeEvaluation: true,
    });
  };
  /** Requests the next server-selected hint for the active riddle. */
  const requestHint = () => {
    if (!run?.currentRiddle || pending) return;
    send("raceHint", "game:requestRaceHint", {
      runId: run.runId,
      riddleId: run.currentRiddle.riddleId,
      includeEvaluation: true,
    });
  };
  /** Requests a server-authoritative skip with the published time penalty. */
  const skip = () => {
    if (!run?.currentRiddle || pending) return;
    /** Next riddle projected entirely from the deck downloaded before the countdown. */
    const projected = projectInstantRaceSkip(run);
    if (projected) {
      skipRollbackRef.current = run;
      setRun(projected);
      setReceivedAtMs(Date.now());
      resetAttempt(projected);
      setPenaltyFlash(tr("RaceTo10.SKIP_PENALTY"));
    }
    send("raceSkip", "game:skipRaceRiddle", {runId: run.runId, riddleId: run.currentRiddle.riddleId, includeEvaluation: true});
  };
  /** Selects an editable answer position. */
  const selectSlot = (index: number) => {
    if (!run?.currentRiddle || !isRaceSlotEditable(run.currentRiddle, index)) return;
    setActiveSlotIndex(index);
  };
  /** Writes a keyboard letter into the active editable answer position. */
  const typeLetter = (letter: string) => {
    /** Current authoritative riddle accepting the letter. */
    const riddle = run?.currentRiddle;
    if (!riddle || pending) return;
    /** Input state produced by the pure multiplayer editing rules. */
    const nextState = insertRaceLetter(riddle, {letters: currentLetters, activeSlotIndex}, letter);
    if (nextState.letters === currentLetters) return;
    setCurrentLetters(nextState.letters);
    setActiveSlotIndex(nextState.activeSlotIndex);
  };
  /** Commits a complete device-keyboard composition or paste in one React state transition. */
  const typeText = (text: string) => {
    /** Provides riddle behavior. */
    const riddle = run?.currentRiddle;
    if (!riddle || pending) return;
    /** Provides next state behavior. */
    const nextState = insertRaceText(riddle, {letters: currentLetters, activeSlotIndex}, text);
    if (nextState.letters === currentLetters) return;
    setCurrentLetters(nextState.letters);
    setActiveSlotIndex(nextState.activeSlotIndex);
  };
  /** Clears the active or nearest previous editable answer position. */
  const backspace = () => {
    /** Current authoritative riddle accepting deletion. */
    const riddle = run?.currentRiddle;
    if (!riddle || pending) return;
    /** Input state produced by the pure multiplayer deletion rules. */
    const nextState = deleteRaceLetter(riddle, {letters: currentLetters, activeSlotIndex});
    if (nextState.letters === currentLetters) return;
    setCurrentLetters(nextState.letters);
    setActiveSlotIndex(nextState.activeSlotIndex);
  };

  useRaceGameplayKeyboard({
    active: stage === "racing" && !quitConfirmationOpen && !pending,
    onLetter: typeLetter,
    onBackspace: backspace,
    onSubmit: submit,
  });

  /** Publishes a completed creator run as a shareable challenge. */
  const publish = () => {
    if (!referralSharing || !run || published || publishRequested) return;
    setPublishRequested(true);
  };
  /** Opens the host share flow for a published race challenge. */
  const share = () => {
    if (!referralSharing || !published) return;
    void sharePublishedChallenge(published);
  };
  /** Clears completed-run presentation state and optionally starts a rematch. */
  const resetForNewRace = (categoryId?: RaceCategoryId, rivalryId?: string) => {
    /** Challenge identifier carried into the next rivalry attempt. */
    const nextRivalryChallengeId = rivalryId ?? run?.challengeId ?? run?.rivalryChallengeId ?? challenge?.challengeId;
    rivalryChallengeIdRef.current = nextRivalryChallengeId;
    setRivalryChallengeId(nextRivalryChallengeId);
    setActiveChallengeId(undefined);
    setRun(null);
    setOutcome(null);
    setPublished(null);
    setPublishRequested(false);
    closeAfterStartRef.current = false;
    setCloseAfterStart(false);
    sharingRef.current = false;
    setSharing(false);
    setCurrentLetters([]);
    setActiveSlotIndex(0);
    setRaceGuesses([]);
    setFeedback(null);
    setPenaltyFlash(null);
    if (categoryId) begin(categoryId, {rivalryChallengeId: nextRivalryChallengeId});
    else {
      setStage("categories");
      if (categories.length === 0) send("raceCategories", "game:listRaceCategories", {locale});
    }
  };
  /** Starts a rivalry rematch from a multiplayer inbox item. */
  const startInboxRematch = (item: RaceInboxItem) => {
    analytics("race_rematch_started", {categoryId: item.categoryId, result: item.result});
    resetForNewRace(item.categoryId, item.challengeId);
  };
  /** Immediately blocks a linked rival through the authenticated host boundary. */
  const blockInboxRival = (item: RaceInboxItem) => {
    if (!item.opponentUserId || pending) return;
    safetyTargetRef.current = item.opponentUserId;
    setSafetyNotice(null);
    send("raceBlock", "game:blockRival", {targetUserId: item.opponentUserId});
  };
  /** Sends one categorized report through the authenticated host boundary. */
  const reportInboxRival = (item: RaceInboxItem, category: import("@qwordly/core/race").SocialReportCategory) => {
    if (!item.opponentUserId || pending) return;
    safetyTargetRef.current = item.opponentUserId;
    setSafetyNotice(null);
    send("raceReport", "game:reportRival", {targetUserId: item.opponentUserId, category});
  };
  /** Provides retry behavior. */
  const retry = () => {
    if (stage === "result" && run) send("raceOutcome", "game:getRaceOutcome", {runId: run.runId});
    else if (stage === "tournaments") showTournaments();
    else if (stage === "inbox") send("raceInbox", "game:listRaceInbox", {limit: 20});
    else if (activeChallengeId) send("raceChallenge", "game:getRaceChallenge", {challengeId: activeChallengeId, locale});
    else send("raceCategories", "game:listRaceCategories", {locale});
  };
  /** Provides run native social behavior. */
  const runNativeSocial = async (kind: "context" | "match") => {
    if (!nativeSocial || socialPending) return;
    setSocialPending(kind);
    setError(null);
    try {
      /** Provides result behavior. */
      const result = kind === "context" ? await nativeSocial.chooseContext() : await nativeSocial.matchPlayer(`race10_v1:${locale}`);
      if (result.status !== "success" && result.status !== "cancelled") {
        setError(tr("RaceTo10.ERROR_GENERIC"));
      }
    } catch {
      setError(tr("RaceTo10.ERROR_GENERIC"));
    } finally {
      setSocialPending(null);
    }
  };
  /** Finds offline match. */
  const findOfflineMatch = async () => {
    if (!matchmaking || socialPending) return;
    setSocialPending("match");
    setError(null);
    try {
      /** Provides result behavior. */
      const result = await matchmaking.find(locale);
      if (result.status === "success" && result.value.status === "matched") {
        setActiveChallengeId(result.value.challenge.challengeId);
        setChallenge(result.value.challenge);
        setStage("challenge");
      } else if (result.status === "success" && result.value.status === "empty") {
        setError(tr("RaceTo10.RESULTS_EMPTY"));
      } else if (result.status !== "cancelled") setError(tr("RaceTo10.ERROR_GENERIC"));
    } catch {
      setError(tr("RaceTo10.ERROR_GENERIC"));
    } finally {
      setSocialPending(null);
    }
  };
  return (
    <RaceTo10View
      {...{
        stage,
        coins,
        error,
        safetyNotice,
        safetyTargetUserId: safetyTargetRef.current,
        categories,
        inboxItems,
        tournament,
        tournamentLoading,
        contextBoard: contextBoardData,
        contextBoardLoading,
        challenge,
        countdown,
        run,
        outcome,
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
        closeAfterStart,
        published,
        dialogRef,
        gameplayViewportRef,
        gameplayRef,
        quitDialogRef,
        socialPending,
        playerOverlay,
        platformPlayerId,
        sharingRewardCoins: referralSharing?.rewardCoins,
        publishRequested,
        sharing,
      }}
      onClose={onClose}
      onRetry={retry}
      onRequestClose={requestClose}
      onShowInbox={showInbox}
      onShowTournaments={tournaments ? showTournaments : undefined}
      onChooseCategory={() => setStage("categories")}
      onSelectCategory={begin}
      onInboxRematch={startInboxRematch}
      onBlockRival={blockInboxRival}
      onReportRival={reportInboxRival}
      onSelectSlot={selectSlot}
      onLetter={typeLetter}
      onText={typeText}
      onBackspace={backspace}
      onHint={requestHint}
      onSubmit={submit}
      onSkip={skip}
      onPublish={publish}
      onShare={share}
      onRematch={resetForNewRace}
      onDismissQuit={dismissQuitConfirmation}
      onChooseNativeContext={nativeSocial ? () => void runNativeSocial("context") : undefined}
      onMatchNativePlayer={matchmaking ? () => void findOfflineMatch() : nativeSocial ? () => void runNativeSocial("match") : undefined}
      onAbandon={() => run && send("raceAbandon", "game:abandonRace", {runId: run.runId})}
    />
  );
}
