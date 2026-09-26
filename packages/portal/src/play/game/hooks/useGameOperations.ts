import {useCallback, useEffect, useRef, useState} from "react";
import type {Dispatch, MutableRefObject} from "react";
import type {GameToHostMessage, HostToGameMessage} from "@qwordly/core/bridge";
import {computeFeedback, splitGraphemes} from "@qwordly/core/game";
import type {SavedGame} from "../../../platform/types";
import {prepareAvatarImage} from "../../avatarImage";
import type {GameSessionAction, GameSessionState} from "../../gameSessionTypes";
import type {PendingGuessState} from "../../gameSessionTypes";
import {gameSessionReducer} from "../../gameSession";
import {
  acquirePendingPlayLease,
  clearPendingGuessJournal,
  pendingPlayScope,
  readPendingGuessJournal,
  releasePendingPlayLease,
  writePendingGuessJournal,
  type PendingGuessJournal,
  type QueuedGuess,
} from "../../pendingGuessJournal";
import {createRequestId} from "../../requestIds";
import type {GameFeedbackKind} from "./useGameAudio";

/** Describes post to host. */
type PostToHost = (message: GameToHostMessage) => void;

/** Captures only fields needed to restore one issued question. */
const capturePendingBase = (state: GameSessionState): PendingGuessState => ({
  currentLetters: [...state.currentLetters], activeSlotIndex: state.activeSlotIndex,
  guesses: [...state.guesses], engineSnapshot: state.engineSnapshot, modal: state.modal,
  lastOutcome: state.lastOutcome, completionAcknowledged: state.completionAcknowledged,
  letterStates: {...state.letterStates},
});

/** Finds the checkpoint for an issued session retained in the journal. */
const findSegment = (journal: PendingGuessJournal, sessionToken: string) =>
  journal.riddle.sessionToken === sessionToken
    ? {riddle: journal.riddle, base: journal.base, draft: journal.draft, first: true as const}
    : journal.successors.find((segment) => segment.riddle.sessionToken === sessionToken);

/** Owns player-initiated host commands and their idempotent retry identifiers. */
export function useGameOperations({
  state,
  stateRef,
  restoredGame,
  dispatch,
  postToHost,
  playFeedback,
}: {
  /** Stores state. */
  state: GameSessionState;
  /** Stores state ref. */
  stateRef: MutableRefObject<GameSessionState>;
  /** Stores restored game. */
  restoredGame?: SavedGame | null;
  /** Stores dispatch. */
  dispatch: Dispatch<GameSessionAction>;
  /** Stores post to host. */
  postToHost: PostToHost;
  /** Stores play feedback. */
  playFeedback: (kind: GameFeedbackKind) => void;
}) {
  /** Provides guess retry ref behavior. */
  const guessRetryRef = useRef<{
    /** Stores riddle id. */
    riddleId: string; /** Stores guess. */
    /** Stores guess. */
    guess: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
    /** Confirmed row count before sending this guess. */
    guesses: number;
  } | null>(null);
  /** Local previews wait in this order for authoritative delivery. */
  const queuedGuessesRef = useRef<QueuedGuess[]>([]);
  /** The journal ref used by the current operation. */
  const journalRef = useRef<PendingGuessJournal | null>(null);
  /** The owner ref used by the current operation. */
  const ownerRef = useRef(createRequestId("pending-owner"));
  /** The sent request ref used by the current operation. */
  const sentRequestRef = useRef<string | null>(null);
  /** The sent at ref used by the current operation. */
  const sentAtRef = useRef(0);
  /** Whether durable browser storage is available. */
  const [journalAvailable, setJournalAvailable] = useState(true);
  /** Count of unconfirmed guesses. */
  const [pendingCount, setPendingCount] = useState(0);
  /** The lease renew ref used by the current operation. */
  const leaseRenewRef = useRef<number | null>(null);
  /** The scope used by the current operation. */
  const scope = state.user ? pendingPlayScope(state.user.uid, state.user.accountGeneration, state.locale) : null;
  /** The scope ref used by the current operation. */
  const scopeRef = useRef(scope);
  /** The prior scope ref used by the current operation. */
  const priorScopeRef = useRef(scope);
  scopeRef.current = scope;
  /** The send first used by the current operation. */
  const sendFirst = useCallback(() => {
    /** The first used by the current operation. */
    const first = queuedGuessesRef.current[0];
    /** The active scope used by the current operation. */
    const activeScope = scopeRef.current;
    if (!first || !activeScope || !acquirePendingPlayLease(activeScope, ownerRef.current)) return;
    if (sentRequestRef.current !== first.message.requestId || Date.now() - sentAtRef.current >= 20_000) {
      sentRequestRef.current = first.message.requestId ?? null;
      sentAtRef.current = Date.now();
      postToHost(first.message);
    }
  }, [postToHost]);
  /** The retry timer ref used by the current operation. */
  const retryTimerRef = useRef<number | null>(null);
  useEffect(() => {
    /** Lets a reloaded tab take over its durable journal immediately. */
    const releaseOnPageHide = () => {
      if (scopeRef.current) releasePendingPlayLease(scopeRef.current, ownerRef.current);
    };
    window.addEventListener("pagehide", releaseOnPageHide);
    return () => {
      window.removeEventListener("pagehide", releaseOnPageHide);
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
      if (leaseRenewRef.current !== null) window.clearInterval(leaseRenewRef.current);
      releaseOnPageHide();
    };
  }, []);
  useEffect(() => {
    if (priorScopeRef.current === scope) return;
    if (priorScopeRef.current) releasePendingPlayLease(priorScopeRef.current, ownerRef.current);
    if (leaseRenewRef.current !== null) window.clearInterval(leaseRenewRef.current);
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    leaseRenewRef.current = null;
    retryTimerRef.current = null;
    sentRequestRef.current = null;
    queuedGuessesRef.current = [];
    setPendingCount(0);
    journalRef.current = null;
    priorScopeRef.current = scope;
    setJournalAvailable(true);
  }, [scope]);
  useEffect(() => {
    if (!scope || !state.riddle) return;
    /** The active journal used by the current operation. */
    const activeJournal = journalRef.current;
    if (activeJournal) {
      if (findSegment(activeJournal, state.riddle.sessionToken)) return;
      /** The previous used by the current operation. */
      const previous = activeJournal.successors.at(-1)?.riddle ?? activeJournal.riddle;
      if (state.riddle.gameMode !== "classic" || state.riddle.index !== (previous.index ?? 0) + 1 ||
        activeJournal.successors.length >= 2) return;
      activeJournal.successors.push({riddle: state.riddle, base: capturePendingBase(state), draft: []});
      writePendingGuessJournal(activeJournal);
      return;
    }
    if (queuedGuessesRef.current.length > 0) return;
    /** The journal used by the current operation. */
    const journal = readPendingGuessJournal(scope);
    if (!journal || state.riddle.gameMode !== journal.riddle.gameMode) return;
    if (state.riddle.gameMode === "classic" &&
      (state.riddle.index ?? 0) > (journal.successors.at(-1)?.riddle.index ?? journal.riddle.index ?? 0)) {
      clearPendingGuessJournal(scope);
      return;
    }
    journalRef.current = journal;
    queuedGuessesRef.current = journal.queue;
    setPendingCount(journal.queue.length);
    /** The active used by the current operation. */
    const active = journal.successors.at(-1) ?? journal;
    if (state.riddle.gameMode === "challenge" && active.riddle.sessionToken !== state.riddle.sessionToken) {
      sendFirst();
      if (leaseRenewRef.current === null) leaseRenewRef.current = window.setInterval(sendFirst, 5_000);
      return;
    }
    if (active.riddle.sessionToken !== state.riddle.sessionToken)
      dispatch({type: "loadRiddle", riddle: active.riddle});
    dispatch({type: "restoreQueuedGuesses", base: active.base,
      guesses: journal.queue.filter((item) => item.message.payload.sessionToken === active.riddle.sessionToken)
        .map((item) => item.message.payload.guess), draft: active.draft});
    sendFirst();
    if (leaseRenewRef.current === null) leaseRenewRef.current = window.setInterval(sendFirst, 5_000);
  }, [dispatch, scope, sendFirst, state.riddle]);
  useEffect(() => {
    /** The journal used by the current operation. */
    const journal = journalRef.current;
    if (!journal || !state.guessPending || !state.riddle) return;
    /** The segment used by the current operation. */
    const segment = findSegment(journal, state.riddle.sessionToken);
    if (!segment) return;
    if (segment.riddle.sessionToken === journal.riddle.sessionToken) journal.draft = [...state.currentLetters];
    else {
      /** The successor used by the current operation. */
      const successor = journal.successors.find((item) => item.riddle.sessionToken === state.riddle?.sessionToken);
      if (successor) successor.draft = [...state.currentLetters];
    }
    writePendingGuessJournal(journal);
  }, [state.currentLetters, state.guessPending, state.riddle?.sessionToken]);
  /** Provides hint retry ref behavior. */
  const hintRetryRef = useRef<{
    /** Stores session token. */
    sessionToken: string; /** Stores attempt. */
    /** Stores attempt. */
    attempt: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  } | null>(null);
  /** Provides continue retry ref behavior. */
  const continueRetryRef = useRef<{
    /** Stores session token. */
    sessionToken: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  } | null>(null);
  /** Provides skip retry ref behavior. */
  const skipRetryRef = useRef<{
    /** Stores session token. */
    sessionToken: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  } | null>(null);

  /** Requests riddle. */
  const requestRiddle = useCallback(() => {
    /** Provides current behavior. */
    const current = stateRef.current;
    /** The next classic used by the current operation. */
    const nextClassic = current.gameMode === "classic" && current.lastOutcome?.kind === "win" &&
      current.riddle?.index !== undefined;
    if (nextClassic && journalRef.current &&
      current.riddle!.index! + 1 > journalRef.current.confirmedClassicIndex + 2) return;
    postToHost({
      type: "game:loadRiddle",
      requestId: createRequestId("load"),
      payload: {
        gameMode: current.gameMode,
        locale: current.locale,
        classicIndex: nextClassic ? current.riddle!.index! + 1 : current.profile?.classicIndex,
        sessionToken: nextClassic ? undefined : current.riddle?.sessionToken ?? restoredGame?.sessionToken,
        riddleId: nextClassic ? undefined : current.riddle?.riddleId ?? restoredGame?.riddleId,
      },
    });
  }, [postToHost, restoredGame?.riddleId, restoredGame?.sessionToken, stateRef]);

  /** Provides current attempt behavior. */
  const currentAttempt = state.riddle
    ? Array.from({length: state.riddle.answerLength}, (_, index) => state.currentLetters[index] ?? "")
    : [];
  /** Indicates whether can submit. */
  const canSubmit = (!state.guessPending || (state.riddle?.evaluation && !state.engineSnapshot?.gameOver &&
    journalAvailable && scope !== null && (state.engineSnapshot?.attemptsUsed ?? 0) < 5 + (state.engineSnapshot?.hasUsedContinue ? 1 : 0))) &&
    currentAttempt.length > 0 && currentAttempt.every(Boolean);

  /** Submits guess. */
  const submitGuess = useCallback(() => {
    if (!canSubmit || !state.riddle) return;
    /** Provides guess behavior. */
    const guess = currentAttempt.join("");
    /** The last guess used by the current operation. */
    const lastGuess = state.guesses.at(-1)?.guess.join("");
    if (lastGuess?.toLocaleLowerCase(state.riddle.evaluation?.locale) === guess.toLocaleLowerCase(state.riddle.evaluation?.locale)) return;
    /** Provides retry behavior. */
    const retry = guessRetryRef.current;
    /** Requests id. */
    const requestId =
      retry?.riddleId === state.riddle.riddleId && retry.guess === guess ? retry.requestId : createRequestId("guess");
    guessRetryRef.current = {riddleId: state.riddle.riddleId, guess, requestId, guesses: state.guesses.length};
    /** The message used by the current operation. */
    const message: Extract<GameToHostMessage, {
      /** Guess-message discriminator. */ type: "game:submitGuess";
    }> = {
      type: "game:submitGuess",
      requestId,
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        sessionToken: state.riddle.sessionToken,
        guess,
        requestId,
      },
    };
    if (state.riddle.evaluation && scope && journalAvailable) {
      if (!acquirePendingPlayLease(scope, ownerRef.current)) {
        dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
        return;
      }
      /** The answer used by the current operation. */
      const answer = state.riddle.evaluation.answer;
      /** The attempts used by the current operation. */
      const attempts = (state.engineSnapshot?.attemptsUsed ?? 0) + 1;
      /** Locally predicted correctness. */
      const isCorrect = guess.toLocaleLowerCase(state.riddle.evaluation.locale) ===
        answer.toLocaleLowerCase(state.riddle.evaluation.locale);
      /** Whether this attempt reaches the paid-continue boundary. */
      const canContinue = !isCorrect && attempts === 5 && !state.engineSnapshot?.hasUsedContinue;
      /** Whether this attempt ends the question. */
      const gameOver = isCorrect || (!canContinue && attempts >= 5 + (state.engineSnapshot?.hasUsedContinue ? 1 : 0));
      /** The queued used by the current operation. */
      const queued: QueuedGuess = {message, attempts, isCorrect, gameOver, canContinue,
        feedback: computeFeedback(guess, answer)};
      /** The base used by the current operation. */
      const base: PendingGuessState = state.pendingGuessState ?? capturePendingBase(state);
      /** The journal used by the current operation. */
      const journal: PendingGuessJournal = journalRef.current ?? {
        version: 1, scope, riddle: state.riddle, confirmedClassicIndex: state.profile?.classicIndex ?? 1,
        base, successors: [], queue: [], draft: [],
      };
      /** The segment used by the current operation. */
      const segment = findSegment(journal, state.riddle.sessionToken);
      if (!segment || journal.queue.length >= 18) {
        dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
        return;
      }
      if (journal.riddle.sessionToken === state.riddle.sessionToken && journal.queue.length === 0) journal.base = base;
      else if (journal.riddle.sessionToken !== state.riddle.sessionToken) {
        /** The successor used by the current operation. */
        const successor = journal.successors.find((item) => item.riddle.sessionToken === state.riddle?.sessionToken);
        if (successor && !journal.queue.some((item) => item.message.payload.sessionToken === state.riddle?.sessionToken))
          successor.base = base;
      }
      journal.queue = [...journal.queue, queued];
      journal.draft = [];
      if (!writePendingGuessJournal(journal)) {
        if (queuedGuessesRef.current.length > 0) {
          dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
          return;
        }
        setJournalAvailable(false);
        releasePendingPlayLease(scope, ownerRef.current);
        playFeedback("submit");
        dispatch({type: "guessRequested"});
        postToHost(message);
        return;
      }
      journalRef.current = journal;
      queuedGuessesRef.current = journal.queue;
      setPendingCount(journal.queue.length);
      playFeedback("submit");
      dispatch({type: "guessRequested"});
      if (journal.queue.length === 1) sendFirst();
      if (leaseRenewRef.current === null)
        leaseRenewRef.current = window.setInterval(sendFirst, 5_000);
    } else {
      playFeedback("submit");
      dispatch({type: "guessRequested"});
      postToHost(message);
    }
  }, [canSubmit, currentAttempt, dispatch, journalAvailable, playFeedback, postToHost, scope, sendFirst, state]);

  /** Consumes only the responses belonging to locally queued guesses. */
  const handleQueuedGuessResult = useCallback((message: Extract<HostToGameMessage, {
    /** Correlated result discriminator. */ type: "host:operationResult";
  }>): boolean => {
    /** The first used by the current operation. */
    const first = queuedGuessesRef.current[0];
    if (!first || message.payload.operation !== "guess" || message.requestId !== first.message.requestId) return false;
    if (!message.payload.ok) {
      if (message.payload.errorKind !== "rejected") {
        if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = null;
          if (queuedGuessesRef.current[0]?.message.requestId !== first.message.requestId) return;
          sentRequestRef.current = null;
          sendFirst();
        }, 1_000);
        return true;
      }
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      /** The checkpoint used by the current operation. */
      const checkpoint = journalRef.current;
      queuedGuessesRef.current = [];
      setPendingCount(0);
      sentRequestRef.current = null;
      if (journalRef.current) clearPendingGuessJournal(journalRef.current.scope);
      journalRef.current = null;
      if (scopeRef.current) releasePendingPlayLease(scopeRef.current, ownerRef.current);
      if (leaseRenewRef.current !== null) window.clearInterval(leaseRenewRef.current);
      leaseRenewRef.current = null;
      if (checkpoint) {
        if (stateRef.current.riddle?.sessionToken === checkpoint.riddle.sessionToken ||
          checkpoint.riddle.gameMode === "classic")
          dispatch({type: "restoreConfirmedRiddle", riddle: checkpoint.riddle, base: checkpoint.base});
        postToHost({type: "game:loadRiddle", requestId: createRequestId("reconcile"), payload: {
          gameMode: checkpoint.riddle.gameMode, locale: stateRef.current.locale, authoritative: true,
        }});
      }
      else dispatch({type: "guessFailed"});
      dispatch({type: "setNotice", notice: "ErrorMessages.PLAY_RESTORED"});
      return true;
    }
    /** The data used by the current operation. */
    const data = message.payload.data;
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    /** The result used by the current operation. */
    const result = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
    /** The feedback used by the current operation. */
    const feedback = Array.isArray(result.feedback) ? result.feedback.map((item: unknown) =>
      typeof item === "object" && item !== null && "status" in item ? item.status : null) : [];
    if (result.attempts !== first.attempts || result.isCorrect !== first.isCorrect ||
      result.gameOver !== first.gameOver || Boolean(result.canContinue) !== first.canContinue ||
      JSON.stringify(feedback) !== JSON.stringify(first.feedback)) {
      /** The checkpoint used by the current operation. */
      const checkpoint = journalRef.current;
      queuedGuessesRef.current = [];
      setPendingCount(0);
      sentRequestRef.current = null;
      if (journalRef.current) clearPendingGuessJournal(journalRef.current.scope);
      journalRef.current = null;
      if (scopeRef.current) releasePendingPlayLease(scopeRef.current, ownerRef.current);
      if (leaseRenewRef.current !== null) window.clearInterval(leaseRenewRef.current);
      leaseRenewRef.current = null;
      if (checkpoint) {
        if (stateRef.current.riddle?.sessionToken === checkpoint.riddle.sessionToken ||
          checkpoint.riddle.gameMode === "classic")
          dispatch({type: "restoreConfirmedRiddle", riddle: checkpoint.riddle, base: checkpoint.base});
        postToHost({type: "game:loadRiddle", requestId: createRequestId("reconcile"), payload: {
          gameMode: checkpoint.riddle.gameMode, locale: stateRef.current.locale, authoritative: true,
        }});
      }
      else dispatch({type: "guessFailed"});
      dispatch({type: "setNotice", notice: "ErrorMessages.PLAY_RESTORED"});
      return true;
    }
    /** The scored used by the current operation. */
    const scored = {guess: splitGraphemes(first.message.payload.guess), feedback: first.feedback};
    /** The journal used by the current operation. */
    const journal = journalRef.current;
    if (journal) {
      /** The segment used by the current operation. */
      const segment = findSegment(journal, first.message.payload.sessionToken);
      if (!segment) return false;
      /** The base used by the current operation. */
      const base = gameSessionReducer({
        ...stateRef.current, ...segment.base, riddle: segment.riddle,
        guessPending: false, pendingGuessState: null,
      }, {type: "guessResolved", feedback: scored, attempts: first.attempts,
        isCorrect: first.isCorrect, gameOver: first.gameOver, canContinue: first.canContinue});
      /** The destructured result used by the current operation. */
      const {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome,
        completionAcknowledged, letterStates} = base;
      /** The updated base used by the current operation. */
      const updatedBase: PendingGuessState = {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal,
        lastOutcome, completionAcknowledged, letterStates};
      if (segment.riddle.sessionToken === journal.riddle.sessionToken) journal.base = updatedBase;
      else {
        /** The successor used by the current operation. */
        const successor = journal.successors.find((item) => item.riddle.sessionToken === segment.riddle.sessionToken);
        if (successor) successor.base = updatedBase;
      }
      journal.queue = journal.queue.slice(1);
      if (first.isCorrect && first.gameOver && segment.riddle.sessionToken === journal.riddle.sessionToken) {
        journal.confirmedClassicIndex += segment.riddle.gameMode === "classic" ? 1 : 0;
        /** The next segment used by the current operation. */
        const nextSegment = journal.successors.shift();
        if (nextSegment) {
          journal.riddle = nextSegment.riddle;
          journal.base = nextSegment.base;
          journal.draft = nextSegment.draft;
        }
      }
      if (journal.queue.length > 0) writePendingGuessJournal(journal);
      else {
        clearPendingGuessJournal(journal.scope);
        journalRef.current = null;
        releasePendingPlayLease(journal.scope, ownerRef.current);
        if (leaseRenewRef.current !== null) window.clearInterval(leaseRenewRef.current);
        leaseRenewRef.current = null;
      }
    }
    if (stateRef.current.riddle?.sessionToken === first.message.payload.sessionToken)
      dispatch({type: "guessCheckpointAdvanced", feedback: scored, attempts: first.attempts,
        isCorrect: first.isCorrect, gameOver: first.gameOver, canContinue: first.canContinue});
    queuedGuessesRef.current.shift();
    setPendingCount(queuedGuessesRef.current.length);
    sentRequestRef.current = null;
    /** The next used by the current operation. */
    const next = queuedGuessesRef.current[0];
    if (next) sendFirst();
    else {
      dispatch({type: "guessPreviewConfirmed"});
      if (first.canContinue && stateRef.current.riddle?.sessionToken === first.message.payload.sessionToken)
        dispatch({type: "openModal", modal: "continue"});
    }
    return true;
  }, [dispatch, postToHost, sendFirst, stateRef]);

  useEffect(() => {
    if (!state.guessPending && state.guesses.length > (guessRetryRef.current?.guesses ?? Infinity)) {
      guessRetryRef.current = null;
    }
  }, [state.guesses.length, state.guessPending]);

  /** Requests hint. */
  const requestHint = useCallback(() => {
    if (!state.riddle || pendingCount > 0) return;
    /** Provides attempt behavior. */
    const attempt = currentAttempt.join("");
    /** Provides retry behavior. */
    const retry = hintRetryRef.current;
    /** Requests id. */
    const requestId =
      retry?.sessionToken === state.riddle.sessionToken && retry.attempt === attempt
        ? retry.requestId
        : createRequestId("hint");
    hintRetryRef.current = {sessionToken: state.riddle.sessionToken, attempt, requestId};
    postToHost({
      type: "game:requestHint",
      requestId,
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        sessionToken: state.riddle.sessionToken,
        requestId,
        currentAttempt,
      },
    });
  }, [currentAttempt, pendingCount, postToHost, state.riddle]);

  useEffect(() => {
    hintRetryRef.current = null;
  }, [state.hintRevealedIndices.length]);

  /** Requests continue. */
  const requestContinue = useCallback(
    (amount?: number) => {
      if (!state.riddle || pendingCount > 0) return;
      /** Provides retry behavior. */
      const retry = continueRetryRef.current;
      /** Requests id. */
      const requestId =
        retry?.sessionToken === state.riddle.sessionToken ? retry.requestId : createRequestId("continue");
      continueRetryRef.current = {sessionToken: state.riddle.sessionToken, requestId};
      postToHost({
        type: "game:spendCoins",
        requestId,
        payload: {
          reason: "continue",
          gameMode: state.riddle.gameMode,
          riddleId: state.riddle.riddleId,
          sessionToken: state.riddle.sessionToken,
          amount,
        },
      });
    },
    [pendingCount, postToHost, state.riddle],
  );

  /** Requests skip. */
  const requestSkip = useCallback(() => {
    if (!state.riddle || state.riddle.gameMode !== "classic" || pendingCount > 0) return;
    /** Provides retry behavior. */
    const retry = skipRetryRef.current;
    /** Requests id. */
    const requestId = retry?.sessionToken === state.riddle.sessionToken ? retry.requestId : createRequestId("skip");
    skipRetryRef.current = {sessionToken: state.riddle.sessionToken, requestId};
    postToHost({
      type: "game:skipRiddle",
      requestId,
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        sessionToken: state.riddle.sessionToken,
      },
    });
  }, [pendingCount, postToHost, state.riddle]);

  /** Requests purchase. */
  const requestPurchase = useCallback(
    (productId: string) => {
      if (pendingCount > 0) return;
      postToHost({
        type: "game:requestPurchase",
        requestId: createRequestId("purchase"),
        payload: {productId},
      });
    },
    [pendingCount, postToHost],
  );

  /** Requests leaderboard. */
  const requestLeaderboard = useCallback(
    (leaderboardType: "xp" | "totalWins" | "bestStreak") => {
      dispatch({type: "leaderboardRequested", leaderboardType});
      postToHost({
        type: "game:loadLeaderboard",
        requestId: createRequestId("leaderboard"),
        payload: {leaderboardType},
      });
    },
    [dispatch, postToHost],
  );

  /** Updates username. */
  const updateUsername = useCallback(
    (username: string) => {
      postToHost({
        type: "game:updateUsername",
        requestId: createRequestId("username"),
        payload: {username},
      });
    },
    [postToHost],
  );

  /** Updates avatar. */
  const updateAvatar = useCallback(
    async (file: File) => {
      /** Provides image data url behavior. */
      const imageDataUrl = await prepareAvatarImage(file);
      postToHost({
        type: "game:updateAvatar",
        requestId: createRequestId("avatar"),
        payload: {imageDataUrl},
      });
    },
    [postToHost],
  );

  /** Deletes account. */
  const deleteAccount = useCallback(() => {
    postToHost({
      type: "game:deleteAccount",
      requestId: createRequestId("delete-account"),
      payload: {},
    });
  }, [postToHost]);

  return {
    canSubmit,
    pendingPlay: pendingCount > 0,
    bufferExhausted: pendingCount > 0 && state.gameMode === "classic" &&
      state.lastOutcome?.kind === "win" && state.riddle?.index !== undefined &&
      state.riddle.index + 1 > (journalRef.current?.confirmedClassicIndex ?? state.profile?.classicIndex ?? 1) + 2,
    submitGuess,
    handleQueuedGuessResult,
    requestRiddle,
    requestHint,
    requestContinue,
    requestSkip,
    requestPurchase,
    requestLeaderboard,
    updateUsername,
    updateAvatar,
    deleteAccount,
  };
}
