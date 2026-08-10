import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import "../../styles.race-lobby.css";
import "../../styles.race-gameplay.css";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {parseHostToGameMessage} from "@qwordly/core/bridge";
import type {ScoredGuess} from "@qwordly/core/game";
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
  type RaceLocale,
  type RaceRunView,
} from "@qwordly/core/race";
import {tr} from "../i18n";
import {HOST_TO_GAME_EVENT} from "../localBridge";
import {createRaceAnalyticsMessage} from "./logic/raceAnalytics";
import {getRaceCountdownStep, RACE_COUNTDOWN_START} from "./logic/raceCountdown";
import {deleteRaceLetter, insertRaceLetter, isRaceSlotEditable} from "./logic/raceInput";
import type {RaceOperation} from "./logic/raceOperations";
import {getGhostCorrectCount} from "./logic/racePlayback";
import {createRaceAttempt, findFirstEditableRaceSlot, getAdjustedRaceTime, getRaceLetterStates} from "./logic/racePresentation";
import {useRaceDialogFocus, useRaceGameplayFit, useRaceGameplayKeyboard, useRaceOperationLifecycle} from "./hooks";
import {trackEvent, trackScreen} from "../../analytics/googleAnalytics";
import {RaceTo10View, type RaceStage} from "./RaceTo10View";

/** Screens controlled by the Race to 10 client state machine. */
/** Stable empty category list used as the default prop value. */
const EMPTY_CATEGORIES: ListRaceCategoriesResponse["categories"] = [];

/** Local-storage key used to remember the currently active race run. */
const ACTIVE_RACE_KEY = "riddleQuest:activeRaceRun";
/** Coordinates the complete server-authoritative Race to 10 multiplayer experience. */
export function RaceTo10Game({
  locale,
  challengeId,
  openInbox = false,
  coins,
  postToHost,
  onClose,
  initialCategories = EMPTY_CATEGORIES,
}: {
  locale: RaceLocale;
  challengeId?: string;
  openInbox?: boolean;
  coins: number;
  postToHost: (message: GameToHostMessage) => void;
  onClose: () => void;
  initialCategories?: ListRaceCategoriesResponse["categories"];
}) {
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
  /** Temporary text describing a server-applied time penalty. */
  const [penaltyFlash, setPenaltyFlash] = useState<string | null>(null);
  /** Whether the active-race abandonment confirmation is visible. */
  const [quitConfirmationOpen, setQuitConfirmationOpen] = useState(false);
  /** Latest recoverable multiplayer error shown to the player. */
  const [error, setError] = useState<string | null>(null);
  /** Published challenge created from the completed run. */
  const [published, setPublished] = useState<ReturnType<typeof PublishRaceChallengeResponseSchema.parse> | null>(null);
  /** Local receipt time used to advance the displayed authoritative clock. */
  const [receivedAtMs, setReceivedAtMs] = useState(Date.now());
  /** Render trigger used to refresh the displayed race clock. */
  const [, setTick] = useState(0);
  const {
    expectedRequestRef,
    finishOperation,
    pending,
    raceGuessLoading,
    send,
    setRaceGuessAwaitingOutcome,
  } = useRaceOperationLifecycle({postToHost, setError});
  /** Latest rivalry identifier available synchronously to rematch callbacks. */
  const rivalryChallengeIdRef = useRef<string | undefined>(undefined);
  /** Root race dialog used for focus containment and viewport measurement. */
  const dialogRef = useRef<HTMLElement | null>(null);
  /** Viewport whose height is adjusted when gameplay is scaled. */
  const gameplayViewportRef = useRef<HTMLDivElement | null>(null);
  /** Natural gameplay surface measured for responsive scaling. */
  const gameplayRef = useRef<HTMLDivElement | null>(null);
  /** Quit dialog used for focus management while abandonment is confirmed. */
  const quitDialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    trackScreen(`multiplayer_${stage}`);
  }, [stage]);

  useEffect(() => {
    if (!challengeId) trackEvent("race_mode_viewed");
  }, [challengeId]);

  /** Resets local answer input from the latest authoritative riddle. */
  const resetAttempt = useCallback((nextRun: RaceRunView) => {
    setCurrentLetters(createRaceAttempt(nextRun.currentRiddle));
    setActiveSlotIndex(findFirstEditableRaceSlot(nextRun.currentRiddle));
    setRaceGuesses([]);
    setFeedback(null);
  }, []);

  /** Emits a schema-constrained multiplayer analytics event through the host. */
  const analytics = useCallback(
    (eventName: RaceAnalyticsEventName, params: Record<string, string | number | boolean> = {}) =>
      postToHost(createRaceAnalyticsMessage(eventName, params)),
    [postToHost],
  );
  /** Opens and refreshes the multiplayer results inbox. */
  const showInbox = useCallback(() => {
    setStage("inbox");
    send("raceInbox", "game:listRaceInbox", {limit: 20});
  }, [send]);

  /** Closes the race or opens confirmation when an active run would be abandoned. */
  const requestClose = useCallback(() => {
    if (stage === "racing" && run?.status === "active") {
      setQuitConfirmationOpen(true);
      return;
    }
    onClose();
  }, [onClose, run?.status, stage]);

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
      else if (challengeId) send("raceChallenge", "game:getRaceChallenge", {challengeId});
      else {
        // Opening multiplayer from the main game always starts at a fresh lobby.
        // A previous browser session must never jump the player into an expired
        // run or its time-up result screen.
        window.localStorage.removeItem(ACTIVE_RACE_KEY);
        if (initialCategories.length === 0) send("raceCategories", "game:listRaceCategories", {locale});
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [analytics, challengeId, initialCategories, locale, openInbox, send]);

  useEffect(() => {
    /** Processes correlated race-operation responses emitted by the host bridge. */
    const handle = (event: Event) => {
      let message;
      try {
        message = parseHostToGameMessage((event as CustomEvent<unknown>).detail);
      } catch {
        return;
      }
      if (message.type !== "host:operationResult" || !message.payload.operation.startsWith("race")) return;
      if (message.requestId !== expectedRequestRef.current) return;
      const operation = message.payload.operation as RaceOperation;
      if (!message.payload.ok) {
        setError(message.payload.error ?? tr("RaceTo10.ERROR_GENERIC"));
        if (operation === "raceStart") {
          setRun(null);
          setStage(activeChallengeId ? "challenge" : "categories");
        }
        finishOperation(operation);
        return;
      }
      try {
        if (operation === "raceCategories") {
          setCategories(ListRaceCategoriesResponseSchema.parse(message.payload.data).categories);
        } else if (operation === "raceInbox") {
          const inbox = ListRaceInboxResponseSchema.parse(message.payload.data);
          setInboxItems(inbox.items);
          setStage("inbox");
          analytics("race_inbox_viewed", {resultCount: inbox.items.length});
        } else if (operation === "raceChallenge") {
          const preview = RaceChallengePreviewSchema.parse(message.payload.data);
          setChallenge(preview);
          analytics("race_link_entered");
        } else if (operation === "raceStart") {
          const nextRun = RaceRunResponseSchema.parse(message.payload.data).run;
          updateRun(nextRun);
          resetAttempt(nextRun);
          analytics("race_started", {kind: activeChallengeId ? "challenge" : "creator"});
          if (operation === "raceStart") analytics("race_attempt_started", {categoryId: nextRun.categoryId});
        } else if (operation === "raceAbandon") {
          const abandoned = AbandonRaceRunResponseSchema.parse(message.payload.data);
          if (abandoned.run.status !== "abandoned" || abandoned.result !== null) throw new Error("Invalid abandon response");
          window.localStorage.removeItem(ACTIVE_RACE_KEY);
          setRun(abandoned.run);
          setQuitConfirmationOpen(false);
          onClose();
        } else if (operation === "raceGuess") {
          const result = SubmitRaceGuessResponseSchema.parse(message.payload.data);
          const previousRiddle = run?.currentRiddle?.riddleId;
          setRaceGuessAwaitingOutcome(result.run.status !== "active");
          updateRun(result.run);
          if (result.autoSkipped) setPenaltyFlash(tr("RaceTo10.SKIP_PENALTY"));
          if (previousRiddle !== result.run.currentRiddle?.riddleId) {
            resetAttempt(result.run);
          } else {
            setRaceGuesses((guesses) => [
              ...guesses,
              {guess: currentLetters, feedback: result.feedback.map(({status}) => status)},
            ]);
            setCurrentLetters(createRaceAttempt(result.run.currentRiddle));
            setActiveSlotIndex(findFirstEditableRaceSlot(result.run.currentRiddle));
          }
          setFeedback(result.isCorrect ? "correct" : "incorrect");
        } else if (operation === "raceHint") {
          const result = RequestRaceHintResponseSchema.parse(message.payload.data);
          updateRun(result.run);
          setCurrentLetters((letters) => {
            const next = [...letters];
            next[result.index] = result.revealedLetter;
            return next;
          });
          if (activeSlotIndex === result.index) setActiveSlotIndex(findFirstEditableRaceSlot(result.run.currentRiddle));
          setPenaltyFlash(tr("RaceTo10.HINT_PENALTY"));
          analytics("race_hint_used", {penaltyMs: 15_000});
        } else if (operation === "raceSkip") {
          const result = SkipRaceRiddleResponseSchema.parse(message.payload.data);
          updateRun(result.run);
          resetAttempt(result.run);
          setPenaltyFlash(tr("RaceTo10.SKIP_PENALTY"));
          analytics("race_skip_used", {penaltyMs: 45_000});
        } else if (operation === "raceOutcome") {
          setOutcome(RaceOutcomeSchema.parse(message.payload.data));
          setStage("result");
          const result = RaceOutcomeSchema.parse(message.payload.data);
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
        } else if (operation === "racePublish") {
          const publication = PublishRaceChallengeResponseSchema.parse(message.payload.data);
          setPublished(publication);
          analytics("race_challenge_published", {categoryId: publication.preview.categoryId});
          window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {detail: publication}));
        }
      } catch {
        setError(tr("RaceTo10.ERROR_INVALID_RESPONSE"));
      } finally {
        finishOperation(operation);
      }
    };
    window.addEventListener(HOST_TO_GAME_EVENT, handle);
    return () => window.removeEventListener(HOST_TO_GAME_EVENT, handle);
  }, [activeChallengeId, activeSlotIndex, analytics, currentLetters, finishOperation, locale, onClose, resetAttempt, run?.currentRiddle?.riddleId, send, setRaceGuessAwaitingOutcome, updateRun]);

  useEffect(() => {
    if (stage !== "countdown") return;
    /** Next deterministic transition for the synchronized countdown. */
    const step = getRaceCountdownStep(countdown, Boolean(run));
    if (step.kind === "wait") return;
    const timer = window.setTimeout(() => {
      if (step.kind === "start") setStage("racing");
      else setCountdown(step.nextValue);
    }, step.delayMs);
    return () => window.clearTimeout(timer);
  }, [countdown, run, stage]);

  useEffect(() => {
    if (stage !== "racing") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 100);
    return () => window.clearInterval(timer);
  }, [stage]);

  useRaceGameplayFit({
    active: stage === "racing",
    screenRef: dialogRef,
    viewportRef: gameplayViewportRef,
    gameplayRef,
  });

  useEffect(() => {
    if (!penaltyFlash) return;
    const timer = window.setTimeout(() => setPenaltyFlash(null), 1_600);
    return () => window.clearTimeout(timer);
  }, [penaltyFlash]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1_600);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  /** Authoritative adjusted elapsed time advanced locally since the last response. */
  const adjustedNow = getAdjustedRaceTime(run, receivedAtMs);

  useEffect(() => {
    if (!run) return;
    if (run.status === "active") window.localStorage.setItem(ACTIVE_RACE_KEY, run.runId);
    else window.localStorage.removeItem(ACTIVE_RACE_KEY);
  }, [run]);
  /** Opponent score replayed against the adjusted race clock. */
  const ghostCorrect = useMemo(() => getGhostCorrectCount(run?.opponent, adjustedNow), [adjustedNow, run?.opponent]);
  /** Best server-scored feedback seen for each keyboard letter. */
  const letterStates = useMemo(() => getRaceLetterStates(raceGuesses), [raceGuesses]);

  /** Starts an authoritative run and displays its synchronized countdown. */
  const begin = (
    categoryId: RaceCategoryId,
    startContext?: {challengeId?: string; rivalryChallengeId?: string},
  ) => {
    const challengeIdForStart = startContext ? startContext.challengeId : activeChallengeId;
    const rivalryIdForStart = startContext ? startContext.rivalryChallengeId : rivalryChallengeId;
    analytics("race_category_selected", {categoryId});
    if (rivalryChallengeIdRef.current) analytics("race_counter_challenge_started", {categoryId});
    setCountdown(RACE_COUNTDOWN_START);
    setStage("countdown");
    send(
      "raceStart",
      "game:startRace",
      challengeIdForStart
        ? {locale, challengeId: challengeIdForStart}
        : {locale, categoryId, ...(rivalryIdForStart ? {rivalryChallengeId: rivalryIdForStart} : {})},
    );
  };
  /** Submits the complete current answer attempt to the server. */
  const submit = () => {
    if (
      !run?.currentRiddle ||
      currentLetters.length !== run.currentRiddle.answerLength ||
      currentLetters.some((letter) => !letter) ||
      pending
    ) return;
    send("raceGuess", "game:submitRaceGuess", {
      runId: run.runId,
      riddleId: run.currentRiddle.riddleId,
      guess: currentLetters.join(""),
    });
  };
  /** Requests the next server-selected hint for the active riddle. */
  const requestHint = () => {
    if (!run?.currentRiddle || pending) return;
    send("raceHint", "game:requestRaceHint", {
      runId: run.runId,
      riddleId: run.currentRiddle.riddleId,
    });
  };
  /** Requests a server-authoritative skip after the first guess. */
  const skip = () => {
    if (!run?.currentRiddle || pending) return;
    send("raceSkip", "game:skipRaceRiddle", {runId: run.runId, riddleId: run.currentRiddle.riddleId});
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
    active: stage === "racing",
    onLetter: typeLetter,
    onBackspace: backspace,
    onSubmit: submit,
  });

  /** Publishes a completed creator run as a shareable challenge. */
  const publish = () => {
    if (!run || pending) return;
    send("racePublish", "game:publishRace", {runId: run.runId});
  };
  /** Opens the host share flow for a published race challenge. */
  const share = () => {
    if (!published || !outcome) return;
    analytics("race_share_dialog_opened", {categoryId: published.preview.categoryId});
    window.dispatchEvent(
      new CustomEvent("riddle-quest:share-race", {
        detail: {challengeId: published.challengeId, preview: published.preview, outcome},
      }),
    );
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
  const retry = () => {
    if (stage === "inbox") send("raceInbox", "game:listRaceInbox", {limit: 20});
    else if (activeChallengeId) send("raceChallenge", "game:getRaceChallenge", {challengeId: activeChallengeId});
    else send("raceCategories", "game:listRaceCategories", {locale});
  };
  return (
    <RaceTo10View
      {...{
        stage, coins, error, categories, inboxItems, challenge, countdown, run, outcome, pending, adjustedNow,
        ghostCorrect, feedback, penaltyFlash, currentLetters, activeSlotIndex, raceGuesses, letterStates,
        quitConfirmationOpen, raceGuessLoading, published, dialogRef, gameplayViewportRef, gameplayRef, quitDialogRef,
      }}
      onClose={onClose} onRetry={retry} onRequestClose={requestClose} onShowInbox={showInbox}
      onChooseCategory={() => setStage("categories")} onSelectCategory={begin} onInboxRematch={startInboxRematch}
      onSelectSlot={selectSlot} onLetter={typeLetter} onBackspace={backspace} onHint={requestHint}
      onSubmit={submit} onSkip={skip} onPublish={publish} onShare={share} onRematch={resetForNewRace}
      onDismissQuit={dismissQuitConfirmation}
      onAbandon={() => run && send("raceAbandon", "game:abandonRace", {runId: run.runId})}
    />
  );
}
