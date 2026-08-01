import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {parseHostToGameMessage} from "@qwordly/core/bridge";
import type {Feedback, ScoredGuess} from "@qwordly/core/game";
import {
  AbandonRaceRunResponseSchema,
  ListRaceCategoriesResponseSchema,
  PublishRaceChallengeResponseSchema,
  RaceChallengePreviewSchema,
  RaceOutcomeSchema,
  RaceRunResponseSchema,
  RequestRaceHintResponseSchema,
  SkipRaceRiddleResponseSchema,
  SubmitRaceGuessResponseSchema,
  type ListRaceCategoriesResponse,
  type RaceCategoryId,
  type RaceChallengePreview,
  type RaceOutcome,
  type RaceAnalyticsEventName,
  type RaceLocale,
  type RaceRunView,
} from "@qwordly/core/race";
import {tr} from "../i18n";
import {ControlledGuessBoard, ControlledKeyboard, ForwardIcon, HintIcon} from "../GameFrameControls";
import {HOST_TO_GAME_EVENT} from "../localBridge";
import {createRequestId} from "../requestIds";
import {createRaceAnalyticsMessage} from "./raceAnalytics";
import {getGhostCorrectCount} from "./racePlayback";
import {trackEvent, trackScreen} from "../../analytics/googleAnalytics";

type Stage = "categories" | "challenge" | "countdown" | "racing" | "result";
type RaceOperation =
  | "raceCategories"
  | "raceStart"
  | "raceGuess"
  | "raceHint"
  | "raceSkip"
  | "raceResume"
  | "raceAbandon"
  | "racePublish"
  | "raceChallenge"
  | "raceOutcome";

const EMPTY_CATEGORIES: ListRaceCategoriesResponse["categories"] = [];

const ACTIVE_RACE_KEY = "riddleQuest:activeRaceRun";

const formatTime = (milliseconds: number) => {
  const seconds = Math.max(0, milliseconds) / 1_000;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
};

const createAttempt = (riddle: NonNullable<RaceRunView["currentRiddle"]> | null) => {
  if (!riddle) return [];
  const revealed = new Map(riddle.revealedLetters.map(({index, letter}) => [index, letter]));
  return Array.from({length: riddle.answerLength}, (_, index) => revealed.get(index) ?? "");
};

const firstEditableSlot = (riddle: NonNullable<RaceRunView["currentRiddle"]> | null) => {
  if (!riddle) return 0;
  const revealed = new Set(riddle.revealedLetters.map(({index}) => index));
  const index = Array.from({length: riddle.answerLength}, (_, position) => position)
    .find((position) => !revealed.has(position));
  return index ?? 0;
};

export function RaceTo10Game({
  locale,
  challengeId,
  postToHost,
  onClose,
  initialCategories = EMPTY_CATEGORIES,
}: {
  locale: RaceLocale;
  challengeId?: string;
  postToHost: (message: GameToHostMessage) => void;
  onClose: () => void;
  initialCategories?: ListRaceCategoriesResponse["categories"];
}) {
  const [stage, setStage] = useState<Stage>(challengeId ? "challenge" : "categories");
  const [activeChallengeId, setActiveChallengeId] = useState(challengeId);
  const [rivalryChallengeId, setRivalryChallengeId] = useState<string>();
  const [categories, setCategories] = useState<ListRaceCategoriesResponse["categories"]>(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<RaceCategoryId | null>(null);
  const [challenge, setChallenge] = useState<RaceChallengePreview | null>(null);
  const [run, setRun] = useState<RaceRunView | null>(null);
  const [outcome, setOutcome] = useState<RaceOutcome | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [currentLetters, setCurrentLetters] = useState<string[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [raceGuesses, setRaceGuesses] = useState<ScoredGuess[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [penaltyFlash, setPenaltyFlash] = useState<string | null>(null);
  const [quitConfirmationOpen, setQuitConfirmationOpen] = useState(false);
  const [pending, setPending] = useState<RaceOperation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<ReturnType<typeof PublishRaceChallengeResponseSchema.parse> | null>(null);
  const [receivedAtMs, setReceivedAtMs] = useState(Date.now());
  const [, setTick] = useState(0);
  const expectedRequestRef = useRef<string | null>(null);
  const rivalryChallengeIdRef = useRef<string | undefined>(undefined);
  const dialogRef = useRef<HTMLElement | null>(null);
  const quitDialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    trackScreen(`multiplayer_${stage}`);
  }, [stage]);

  useEffect(() => {
    if (!challengeId) trackEvent("race_mode_viewed");
  }, [challengeId]);

  const resetAttempt = useCallback((nextRun: RaceRunView) => {
    setCurrentLetters(createAttempt(nextRun.currentRiddle));
    setActiveSlotIndex(firstEditableSlot(nextRun.currentRiddle));
    setRaceGuesses([]);
    setFeedback(null);
  }, []);

  const send = useCallback(
    (operation: RaceOperation, type: GameToHostMessage["type"], payload: Record<string, unknown>) => {
      const requestId = createRequestId(operation);
      const requiresReceipt = ["raceStart", "raceGuess", "raceHint", "raceSkip", "raceAbandon", "racePublish"].includes(operation);
      expectedRequestRef.current = requestId;
      setPending(operation);
      setError(null);
      postToHost({
        type,
        requestId,
        payload: requiresReceipt ? {...payload, requestId} : payload,
      } as GameToHostMessage);
    },
    [postToHost],
  );
  const analytics = useCallback(
    (eventName: RaceAnalyticsEventName, params: Record<string, string | number | boolean> = {}) =>
      postToHost(createRaceAnalyticsMessage(eventName, params)),
    [postToHost],
  );

  const requestClose = useCallback(() => {
    if (stage === "racing" && run?.status === "active") {
      setQuitConfirmationOpen(true);
      return;
    }
    onClose();
  }, [onClose, run?.status, stage]);

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
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (quitConfirmationOpen) setQuitConfirmationOpen(false);
        else requestClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const activeDialog = quitConfirmationOpen ? quitDialogRef.current : dialogRef.current;
      if (!activeDialog) return;
      const focusable = Array.from(
        activeDialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [quitConfirmationOpen, requestClose]);

  useEffect(() => {
    if (!quitConfirmationOpen) return;
    const frame = window.requestAnimationFrame(() => quitDialogRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [quitConfirmationOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (challengeId) send("raceChallenge", "game:getRaceChallenge", {challengeId});
      else {
        const savedRunId = window.localStorage.getItem(ACTIVE_RACE_KEY);
        if (savedRunId) send("raceResume", "game:resumeRace", {runId: savedRunId});
        else if (initialCategories.length === 0) send("raceCategories", "game:listRaceCategories", {locale});
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [analytics, challengeId, initialCategories, locale, send]);

  useEffect(() => {
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
      setPending(null);
      if (!message.payload.ok) {
        if (operation === "raceResume") {
          window.localStorage.removeItem(ACTIVE_RACE_KEY);
          send("raceCategories", "game:listRaceCategories", {locale});
          return;
        }
        setError(message.payload.error ?? tr("RaceTo10.ERROR_GENERIC"));
        return;
      }
      try {
        if (operation === "raceCategories") {
          setCategories(ListRaceCategoriesResponseSchema.parse(message.payload.data).categories);
        } else if (operation === "raceChallenge") {
          const preview = RaceChallengePreviewSchema.parse(message.payload.data);
          setChallenge(preview);
          setSelectedCategory(preview.categoryId);
          analytics("race_link_entered");
        } else if (operation === "raceStart" || operation === "raceResume") {
          const nextRun = RaceRunResponseSchema.parse(message.payload.data).run;
          updateRun(nextRun);
          resetAttempt(nextRun);
          setStage("racing");
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
          updateRun(result.run);
          setFeedback(result.isCorrect ? tr("RaceTo10.CORRECT") : tr("RaceTo10.TRY_AGAIN"));
          if (result.autoSkipped) setPenaltyFlash(tr("RaceTo10.SKIP_PENALTY"));
          if (previousRiddle !== result.run.currentRiddle?.riddleId) {
            resetAttempt(result.run);
          } else {
            setRaceGuesses((guesses) => [
              ...guesses,
              {guess: currentLetters, feedback: result.feedback.map(({status}) => status)},
            ]);
            setCurrentLetters(createAttempt(result.run.currentRiddle));
            setActiveSlotIndex(firstEditableSlot(result.run.currentRiddle));
          }
        } else if (operation === "raceHint") {
          const result = RequestRaceHintResponseSchema.parse(message.payload.data);
          updateRun(result.run);
          setCurrentLetters((letters) => {
            const next = [...letters];
            next[result.index] = result.revealedLetter;
            return next;
          });
          if (activeSlotIndex === result.index) setActiveSlotIndex(firstEditableSlot(result.run.currentRiddle));
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
      }
    };
    window.addEventListener(HOST_TO_GAME_EVENT, handle);
    return () => window.removeEventListener(HOST_TO_GAME_EVENT, handle);
  }, [activeChallengeId, activeSlotIndex, analytics, currentLetters, locale, onClose, resetAttempt, run?.currentRiddle?.riddleId, send, updateRun]);

  useEffect(() => {
    if (stage !== "countdown") return;
    if (countdown <= 0) {
      send(
        "raceStart",
        "game:startRace",
        activeChallengeId
          ? {locale, challengeId: activeChallengeId}
          : {locale, categoryId: selectedCategory, ...(rivalryChallengeId ? {rivalryChallengeId} : {})},
      );
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 750);
    return () => window.clearTimeout(timer);
  }, [activeChallengeId, countdown, locale, rivalryChallengeId, selectedCategory, send, stage]);

  useEffect(() => {
    if (stage !== "racing") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 100);
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (!penaltyFlash) return;
    const timer = window.setTimeout(() => setPenaltyFlash(null), 1_600);
    return () => window.clearTimeout(timer);
  }, [penaltyFlash]);

  const adjustedNow = run
    ? Math.min(
        run.rules.maxAdjustedTimeMs,
        run.adjustedElapsedMs + (run.status === "active" ? Date.now() - receivedAtMs : 0),
      )
    : 0;

  useEffect(() => {
    if (!run) return;
    if (run.status === "active") window.localStorage.setItem(ACTIVE_RACE_KEY, run.runId);
    else window.localStorage.removeItem(ACTIVE_RACE_KEY);
  }, [run]);
  const ghostCorrect = useMemo(() => getGhostCorrectCount(run?.opponent, adjustedNow), [adjustedNow, run?.opponent]);
  const letterStates = useMemo(() => {
    const states: Record<string, Feedback> = {};
    for (const scoredGuess of raceGuesses) {
      scoredGuess.guess.forEach((letter, index) => {
        const status = scoredGuess.feedback[index];
        if (!letter || !status || states[letter.toLowerCase()] === "green") return;
        states[letter.toLowerCase()] = status;
      });
    }
    return states;
  }, [raceGuesses]);

  const begin = (categoryId: RaceCategoryId) => {
    analytics("race_category_selected", {categoryId});
    if (rivalryChallengeIdRef.current) analytics("race_counter_challenge_started", {categoryId});
    setSelectedCategory(categoryId);
    setCountdown(3);
    setStage("countdown");
  };
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
  const requestHint = () => {
    if (!run?.currentRiddle || pending) return;
    send("raceHint", "game:requestRaceHint", {
      runId: run.runId,
      riddleId: run.currentRiddle.riddleId,
      currentAttempt: currentLetters,
    });
  };
  const skip = () => {
    if (!run?.currentRiddle || pending) return;
    send("raceSkip", "game:skipRaceRiddle", {runId: run.runId, riddleId: run.currentRiddle.riddleId});
  };
  const selectSlot = (index: number) => {
    if (run?.currentRiddle?.revealedLetters.some((letter) => letter.index === index)) return;
    setActiveSlotIndex(index);
  };
  const typeLetter = (letter: string) => {
    const riddle = run?.currentRiddle;
    if (!riddle || pending) return;
    const revealed = new Set(riddle.revealedLetters.map(({index}) => index));
    if (revealed.has(activeSlotIndex)) return;
    const nextLetters = Array.from({length: riddle.answerLength}, (_, index) => currentLetters[index] ?? "");
    nextLetters[activeSlotIndex] = letter;
    setCurrentLetters(nextLetters);
    const nextSlot = Array.from({length: riddle.answerLength}, (_, offset) =>
      (activeSlotIndex + offset + 1) % riddle.answerLength)
      .find((index) => !revealed.has(index) && !nextLetters[index]);
    if (nextSlot !== undefined) setActiveSlotIndex(nextSlot);
  };
  const backspace = () => {
    const riddle = run?.currentRiddle;
    if (!riddle || pending) return;
    const revealed = new Set(riddle.revealedLetters.map(({index}) => index));
    const nextLetters = Array.from({length: riddle.answerLength}, (_, index) => currentLetters[index] ?? "");
    let target = activeSlotIndex;
    if (!nextLetters[target] || revealed.has(target)) {
      target = Array.from({length: riddle.answerLength}, (_, offset) =>
        (activeSlotIndex - offset - 1 + riddle.answerLength) % riddle.answerLength)
        .find((index) => !revealed.has(index) && Boolean(nextLetters[index])) ?? activeSlotIndex;
    }
    if (revealed.has(target)) return;
    nextLetters[target] = "";
    setCurrentLetters(nextLetters);
    setActiveSlotIndex(target);
  };

  useEffect(() => {
    if (stage !== "racing") return;
    const handleGameplayKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        typeLetter(event.key.toUpperCase());
      } else if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
      } else if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    };
    document.addEventListener("keydown", handleGameplayKey);
    return () => document.removeEventListener("keydown", handleGameplayKey);
  });

  const publish = () => {
    if (!run || pending) return;
    send("racePublish", "game:publishRace", {runId: run.runId});
  };
  const share = () => {
    if (!published || !outcome) return;
    analytics("race_share_dialog_opened", {categoryId: published.preview.categoryId});
    window.dispatchEvent(
      new CustomEvent("riddle-quest:share-race", {
        detail: {challengeId: published.challengeId, preview: published.preview, outcome},
      }),
    );
  };
  const resetForNewRace = (categoryId?: RaceCategoryId) => {
    const nextRivalryChallengeId = run?.challengeId ?? run?.rivalryChallengeId ?? challenge?.challengeId;
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
    if (categoryId) begin(categoryId);
    else {
      setSelectedCategory(null);
      setStage("categories");
      if (categories.length === 0) send("raceCategories", "game:listRaceCategories", {locale});
    }
  };

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
      {stage !== "racing" && (
        <header className="race-topbar">
          <div>
            <span className="race-kicker">{tr("RaceTo10.MODE_LABEL")}</span>
            <h1 id="race-title">{tr("RaceTo10.TITLE")}</h1>
          </div>
          <button className="race-close" onClick={requestClose} aria-label={tr("RaceTo10.CLOSE")}>
            ×
          </button>
        </header>
      )}
      {error && (
        <div className="race-error" role="alert">
          {error}
          <button
            onClick={() =>
              activeChallengeId
                ? send("raceChallenge", "game:getRaceChallenge", {challengeId: activeChallengeId})
                : send("raceCategories", "game:listRaceCategories", {locale})
            }
          >
            {tr("RaceTo10.RETRY")}
          </button>
        </div>
      )}

      {stage === "categories" && (
        <div className="race-panel">
          <h2>{tr("RaceTo10.CHOOSE_CATEGORY")}</h2>
          <p>{tr("RaceTo10.RULES_SUMMARY")}</p>
          <div className="race-category-grid">
            {categories.map((category) => (
              <button
                key={category.categoryId}
                style={{"--race-color": category.colorToken} as React.CSSProperties}
                onClick={() => begin(category.categoryId)}
              >
                <strong>{tr(category.nameKey)}</strong>
                <span>{tr(category.descriptionKey)}</span>
                <small>
                  {category.availableRiddleCount} {tr("RaceTo10.RIDDLES")}
                </small>
              </button>
            ))}
          </div>
          {pending === "raceCategories" && <p aria-live="polite">{tr("RaceTo10.LOADING_CATEGORIES")}</p>}
        </div>
      )}

      {stage === "challenge" && (
        <div className="race-panel race-challenge-card">
          {challenge ? (
            <>
              <h2>{tr("RaceTo10.CHALLENGED_BY", {name: challenge.creator.displayName})}</h2>
              <p>{tr("RaceTo10.TIME_TO_BEAT", {time: formatTime(challenge.adjustedTimeToBeatMs)})}</p>
              <p>{tr("RaceTo10.RULES_SUMMARY")}</p>
              {challenge.status === "active" ? (
                <button className="race-primary" onClick={() => begin(challenge.categoryId)}>
                  {tr("RaceTo10.ACCEPT_CHALLENGE")}
                </button>
              ) : (
                <p role="alert">{tr("RaceTo10.ERROR_GENERIC")}</p>
              )}
            </>
          ) : (
            <p>{tr("RaceTo10.LOADING_CHALLENGE")}</p>
          )}
        </div>
      )}

      {stage === "countdown" && (
        <div className="race-countdown" aria-live="assertive">
          <span>{countdown > 0 ? countdown : tr("RaceTo10.GO")}</span>
          <p>{tr("RaceTo10.FIRST_TO_TEN")}</p>
        </div>
      )}

      {stage === "racing" && run && (
        <div className="race-gameplay">
          <section className="race-scoreboard" aria-label={tr("RaceTo10.PROGRESS_LABEL")}>
            <div className="race-rail-header">
              <h1 id="race-title">{tr("RaceTo10.TITLE")}</h1>
              <button className="race-close" onClick={requestClose} aria-label={tr("RaceTo10.CLOSE")}>
                ×
              </button>
            </div>
            <div className="race-header-clock" aria-live="polite">
              <span>{tr("RaceTo10.ADJUSTED_TIME")}</span>
              <strong>{formatTime(adjustedNow)}</strong>
              <small aria-label={tr("RaceTo10.PENALTIES", {time: formatTime(run.totalPenaltyMs)})}>
                +{formatTime(run.totalPenaltyMs)}
              </small>
            </div>
            <div className="race-progress">
              <div style={{"--race-progress": `${run.correctCount * 10}%`} as React.CSSProperties}>
                <span title={tr("RaceTo10.YOU")}>{tr("RaceTo10.YOU")}</span>
                <strong>{run.correctCount}</strong>
                <div className="race-progress-track" aria-hidden="true"><i /></div>
                <progress className="sr-only" max="10" value={run.correctCount}>
                  {run.correctCount}/10
                </progress>
              </div>
              {run.opponent && (
                <div style={{"--race-progress": `${ghostCorrect * 10}%`} as React.CSSProperties}>
                  <span title={run.opponent.displayName}>{run.opponent.displayName}</span>
                  <strong>{ghostCorrect}</strong>
                  <div className="race-progress-track" aria-hidden="true"><i /></div>
                  <progress className="sr-only" max="10" value={ghostCorrect}>
                    {ghostCorrect}/10
                  </progress>
                </div>
              )}
            </div>
          </section>
          {run.currentRiddle && (
            <>
              <section className="riddle-surface race-riddle-surface">
                <div className="riddle-card">
                  <small>{tr("RaceTo10.RIDDLE_NUMBER", {number: run.currentRiddle.position + 1})}</small>
                  <h2>{run.currentRiddle.text}</h2>
                  <p id="race-attempts">
                    {tr("RaceTo10.GUESSES_REMAINING", {count: run.currentRiddle.guessesRemaining})}
                  </p>
                  {feedback && <p className="game-notice" aria-live="polite">{feedback}</p>}
                </div>
                <ControlledGuessBoard
                  answerLength={run.currentRiddle.answerLength}
                  currentLetters={currentLetters}
                  activeSlotIndex={activeSlotIndex}
                  hintRevealedIndices={run.currentRiddle.revealedLetters.map(({index}) => index)}
                  guesses={raceGuesses}
                  onSelectSlot={selectSlot}
                  disabled={Boolean(pending)}
                />
              </section>
              <ControlledKeyboard
                letterStates={letterStates}
                onLetter={typeLetter}
                onBackspace={backspace}
                disabled={Boolean(pending)}
              />
            </>
          )}
          {penaltyFlash && (
            <div className="race-penalty-flash" role="status">
              {penaltyFlash}
            </div>
          )}
          <div className="game-input-actions race-actions" aria-describedby="race-attempts">
            <button onClick={requestHint} disabled={Boolean(pending) || !run.currentRiddle?.hintAvailable}>
              <HintIcon />
              <span>{tr("RaceTo10.HINT_BUTTON")} <small>+15s</small></span>
            </button>
            <button
              className="submit-action"
              onClick={submit}
              disabled={Boolean(pending) || currentLetters.length !== run.currentRiddle?.answerLength || currentLetters.some((letter) => !letter)}
            >
              {tr("RaceTo10.SUBMIT")}
            </button>
            <button onClick={skip} disabled={Boolean(pending) || (run.currentRiddle?.guessesUsed ?? 0) < 1}>
              <ForwardIcon />
              <span>{tr("RaceTo10.SKIP_BUTTON")} <small>+45s</small></span>
            </button>
          </div>
        </div>
      )}

      {stage === "result" && outcome && (
        <div className="race-panel race-result" aria-live="polite">
          <h2>{tr(`RaceTo10.RESULT_${outcome.result.toUpperCase()}`)}</h2>
          <div className="race-result-grid">
            <span>
              {tr("RaceTo10.WALL_TIME")}
              <strong>{formatTime(outcome.wallFinishMs)}</strong>
            </span>
            <span>
              {tr("RaceTo10.HINT_TIME")}
              <strong>+{formatTime(outcome.hintPenaltyMs)}</strong>
            </span>
            <span>
              {tr("RaceTo10.SKIP_TIME")}
              <strong>+{formatTime(outcome.skipPenaltyMs)}</strong>
            </span>
            <span>
              {tr("RaceTo10.FINAL_TIME")}
              <strong>{formatTime(outcome.adjustedFinishMs)}</strong>
            </span>
          </div>
          {outcome.publishable && !published && (
            <button className="race-primary" onClick={publish} disabled={Boolean(pending)}>
              {tr("RaceTo10.CREATE_CHALLENGE")}
            </button>
          )}
          {published && (
            <>
              <p>{tr("RaceTo10.CHALLENGE_READY")}</p>
              <button className="race-primary" onClick={share}>
                {tr("RaceTo10.SHARE_CHALLENGE")}
              </button>
            </>
          )}
          {outcome.rematchEligible && run && (
            <div className="race-rematch-actions">
              <button className="race-primary" onClick={() => resetForNewRace(run.categoryId)}>
                {tr("RaceTo10.TITLE")} · {tr(`RaceTo10.CATEGORY_${run.categoryId.toUpperCase()}_NAME`)}
              </button>
              <button onClick={() => resetForNewRace()}>{tr("RaceTo10.CHOOSE_CATEGORY")}</button>
            </div>
          )}
          <button onClick={onClose}>{tr("RaceTo10.BACK_TO_GAME")}</button>
        </div>
      )}

      {quitConfirmationOpen && run?.status === "active" && (
        <div className="race-quit-backdrop">
          <div
            ref={quitDialogRef}
            className="race-quit-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="race-quit-title"
            aria-describedby="race-quit-message"
            tabIndex={-1}
          >
            <h2 id="race-quit-title">{tr("RaceTo10.QUIT_TITLE")}</h2>
            <p id="race-quit-message">{tr("RaceTo10.QUIT_MESSAGE")}</p>
            {error && <p className="race-quit-error" role="alert">{error}</p>}
            <div className="race-quit-actions">
              <button onClick={() => setQuitConfirmationOpen(false)} disabled={pending === "raceAbandon"}>
                {tr("RaceTo10.KEEP_PLAYING")}
              </button>
              <button
                className="race-quit-confirm"
                onClick={() => send("raceAbandon", "game:abandonRace", {runId: run.runId})}
                disabled={pending === "raceAbandon"}
              >
                {pending === "raceAbandon" ? tr("RaceTo10.QUITTING") : tr("RaceTo10.QUIT_RACE")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
