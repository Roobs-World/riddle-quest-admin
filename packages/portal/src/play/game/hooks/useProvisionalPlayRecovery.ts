import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import type {BridgeRiddle, GameToHostMessage, HostToGameMessage} from "@qwordly/core/bridge";
import {computeFeedback, lowerCaseGraphemes, splitGraphemes} from "@qwordly/core/game";
import type {PendingGuessState} from "../../gameSessionTypes";
import {canEditCurrentGuess, gameSessionReducer, hasRemainingGuessAttempts} from "../../gameSession";
import {
  browserAdapters, capturePendingBase, findSegment, ownsSkipSuccessor,
  pendingPlayScope,
  reconcileConfirmedPendingPlay,
  createRejectedPlayDraft,
  type PendingGuessJournal,
  type QueuedGuess,
  type QueuedCoinAction,
} from "../../pendingGuessJournal";
import {createRequestId} from "../../requestIds";
import {getConfirmedRiddleOutcome} from "../../ConfirmedRiddleOutcome";
import {CONTINUE_COIN_COST, SKIP_COIN_COST} from "../../modalPages/commerce/commerceCosts";
import type {RecoveryOptions, PendingAnswer, RestoredJournal, ContinueSubmit, SkipLoad, SkipPreview, EarlySkipLoad, DirectGuess, DeliveryOwner, PendingPlayRecoveryAdapters} from "../../pendingPlayRecoveryTypes";
export type {PendingPlayClock, PendingPlayRecoveryAdapters} from "../../pendingPlayRecoveryTypes";
/** Owns player-initiated host commands and their idempotent retry identifiers. */
export function useProvisionalPlayRecovery({
  state,
  stateRef,
  restoredGame,
  dispatch,
  postToHost,
  playFeedback,
  adapters = browserAdapters,
}: RecoveryOptions) {
  /** Provides guess retry ref behavior. */
  const guessRetryRef = useRef<PendingAnswer | null>(null);
  /** Local previews wait in this order for authoritative delivery. */
  const queuedGuessesRef = useRef<QueuedGuess[]>([]);
  /** The journal ref used by the current operation. */
  const journalRef = useRef<PendingGuessJournal | null>(null);
  /** Tracks the displayed journal segment and the render preceding its restoration. */
  const restoredJournalRef = useRef<RestoredJournal | null>(null);
  /** The owner ref used by the current operation. */
  const [ownerRef] = useState(() => ({current: createRequestId("pending-owner")}));
  /** The sent request ref used by the current operation. */
  const sentRequestRef = useRef<string | null>(null);
  /** The sent at ref used by the current operation. */
  const sentAtRef = useRef(0);
  /** Whether durable browser storage is available. */
  const [journalAvailable, setJournalAvailable] = useState(true);
  /** Count of unconfirmed guesses. */
  const [pendingCount, setPendingCount] = useState(0);
  /** Prevents later guesses or repeated purchases from overtaking a queued coin action. */
  const [coinActionPending, setCoinActionPending] = useState(false);
  /** One explicit sixth-attempt submission waits for its exact paid grant. */
  const [queuedContinueSubmit, setQueuedContinueSubmit] = useState<Readonly<ContinueSubmit> | null>(null);
  /** Effect replay cannot send the same deferred answer twice. */
  const consumedContinueSubmitRef = useRef<string | null>(null);
  /** Blocks repeated Continue clicks before React commits the local deduction. */
  const continuePendingRef = useRef(false);
  useEffect(() => {
    if (!state.pendingCoinSpend || !state.pendingCoinSpend.requestId.startsWith("continue-"))
      continuePendingRef.current = false;
  }, [state.pendingCoinSpend]);
  /** Correlates the one successor load permitted by an accepted Skip request. */
  const skipLoadRef = useRef<SkipLoad | null>(null);
  /** Correlates the speculative issued successor shown before a Skip receipt. */
  const skipPreviewRef = useRef<SkipPreview | null>(null);
  /** Holds an authoritative successor that arrives before its correlated Skip receipt. */
  const earlySkipLoadRef = useRef<EarlySkipLoad | null>(null);
  /** A failed receipt write retries the latest journal within its admitted lifetime. */
  const pendingSettlementWriteRef = useRef<string | null>(null);
  /** The lease renew ref used by the current operation. */
  const leaseRenewRef = useRef<number | null>(null);
  /** The scope used by the current operation. */
  const scope = state.user ? pendingPlayScope(state.user.uid, state.user.accountGeneration, state.locale) : null;
  /** The scope ref used by the current operation. */
  const scopeRef = useRef(scope);
  /** The prior scope ref used by the current operation. */
  const priorScopeRef = useRef(scope);
  scopeRef.current = scope;
  /** The non-journaled fallback still owns an exact request, question and player scope. */
  const directGuessRef = useRef<DirectGuess | null>(null);
  /** Retains ownership when evaluation or durable journal storage is unavailable. */
  const sendDirectGuess = useCallback((message: QueuedGuess["message"]) => {
    directGuessRef.current = {requestId: message.requestId!, scope: scopeRef.current,
      sessionToken: message.payload.sessionToken};
    postToHost(message);
  }, [postToHost]);
  /** Exact committed lifetime; old callbacks cannot revive when an account returns. */
  const deliveryOwnerRef = useRef<DeliveryOwner | null>(null);
  /** Replacement commit lifetimes retain immutable predecessors without re-reading another tab. */
  const journalObservedRef = useRef(new Map<string, string | null>());
  /** Loaded writer changes rerun recovery even when the displayed question is unchanged. */
  const [writerRevision, setWriterRevision] = useState(0);
  /** Durable edits belong to this exact mounted writer. */
  const journalWriterRef = useRef<Awaited<ReturnType<PendingPlayRecoveryAdapters["journal"]["writer"]>> | null>(null);
  /** The send first used by the current operation. */
  const sendFirst = useCallback(() => {
    /** Buffered successor delivery waits until the recovered predecessor's completion is acknowledged. */
    const current = stateRef.current;
    /** A terminal predecessor's unresolved payment settles before any later owned guess. */
    const coinAction = journalRef.current?.coinAction;
    /** Only an exact question match may move a paid receipt ahead of successor gameplay. */
    const terminalCoin = coinAction && current.riddle && getConfirmedRiddleOutcome(current.riddle) &&
      coinAction.payload.sessionToken === current.riddle.sessionToken && coinAction.payload.riddleId === current.riddle.riddleId &&
      coinAction.payload.gameMode === current.riddle.gameMode;
    /** Original requests retain their identity and order within the remaining gameplay queue. */
    const message = terminalCoin ? coinAction : queuedGuessesRef.current[0]?.message ?? coinAction;
    /** The active scope used by the current operation. */
    const activeScope = scopeRef.current;
    /** An owned paid receipt can settle terminal balance uncertainty before completion acknowledgement. */
    const terminalPaidReceipt = message && message.type !== "game:submitGuess" && current.riddle &&
      message.payload.sessionToken === current.riddle.sessionToken && message.payload.riddleId === current.riddle.riddleId &&
      message.payload.gameMode === current.riddle.gameMode;
    if (current.riddle && getConfirmedRiddleOutcome(current.riddle) && !current.completionAcknowledged && !terminalPaidReceipt &&
      (getConfirmedRiddleOutcome(current.riddle)?.kind === "loss" ||
        message?.payload.sessionToken !== current.riddle.sessionToken)) return;
    // Render-time identity revocation must precede lease acquisition and delivery.
    if (!deliveryOwnerRef.current || deliveryOwnerRef.current.scope !== activeScope ||
      !message || !activeScope || journalRef.current?.scope !== activeScope)
      return;
    /** One clock sample owns lease renewal and retry pacing; rollback cannot prolong a retained request. */
    const now = adapters.clock.now();
    if (!adapters.journal.acquire(activeScope, ownerRef.current, now)) return;
    if (sentRequestRef.current !== message.requestId || now < sentAtRef.current || now - sentAtRef.current >= 20_000) {
      sentRequestRef.current = message.requestId ?? null;
      sentAtRef.current = now;
      postToHost(message);
    }
  }, [postToHost]);
  /** The retry timer ref used by the current operation. */
  const retryTimerRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    /** A fresh token owns every timer installed during this committed scope. */
    const owner = {scope, postToHost};
    deliveryOwnerRef.current = owner;
    /** Failed optional chunk loads retry only while this commit still owns admission. */
    let writerRetry: number | null = null;
    /** Initializes only the admitting commit, including retained cancelled timer callbacks. */
    const initializeWriter = () => {
      if (deliveryOwnerRef.current !== owner || scopeRef.current !== owner.scope) return;
      void adapters.journal.writer(ownerRef.current, adapters.clock.now,
      candidate => deliveryOwnerRef.current === owner && scopeRef.current === owner.scope && candidate === owner.scope, journalObservedRef.current).then(writer => {
      if (deliveryOwnerRef.current !== owner || scopeRef.current !== owner.scope) return;
      journalWriterRef.current = writer;
      setWriterRevision(value => value + 1);
    }).catch(() => {
      if (deliveryOwnerRef.current === owner && scopeRef.current === owner.scope)
        writerRetry = adapters.clock.setTimeout(initializeWriter, 5_000);
    });};
    initializeWriter();
    return () => {
      if (deliveryOwnerRef.current !== owner) return;
      deliveryOwnerRef.current = null;
      if (writerRetry !== null) adapters.clock.clearTimeout(writerRetry);
      journalWriterRef.current = null;
      pendingSettlementWriteRef.current = null;
      if (retryTimerRef.current !== null) adapters.clock.clearTimeout(retryTimerRef.current);
      if (leaseRenewRef.current !== null) adapters.clock.clearInterval(leaseRenewRef.current);
      retryTimerRef.current = null;
      leaseRenewRef.current = null;
      if (owner.scope) adapters.journal.release(owner.scope, ownerRef.current);
    };
  }, [scope, postToHost, adapters]);
  /** Deferred persistence captures its lifetime before loading optional code. */
  const persistSettlement = useCallback(() => {
    /** Receipt persistence may advance only the writer admitted before its asynchronous yield. */
    const owner = deliveryOwnerRef.current, writer = journalWriterRef.current, activeScope = scopeRef.current;
    void adapters.journal.persist([deliveryOwnerRef, scopeRef, journalRef,
      pendingSettlementWriteRef, leaseRenewRef, ownerRef.current, adapters.clock]).then(() => {
      if (activeScope && deliveryOwnerRef.current === owner && journalWriterRef.current === writer && scopeRef.current === activeScope)
        writer?.acknowledge(activeScope, journalRef.current);
    }).catch(() => undefined);
  }, [adapters]);
  /** Each registered interval retains its exact lifetime and timer identity. */
  const renewDelivery = useCallback(() => {
    /** Committed owner that admitted this registration. */
    const owner = deliveryOwnerRef.current;
    if (!owner || leaseRenewRef.current !== null) return;
    /** Cancelled callbacks must not borrow a newer timer, including in the same scope. */
    const timer = adapters.clock.setInterval(() => {
      if (deliveryOwnerRef.current !== owner || leaseRenewRef.current !== timer) return;
      persistSettlement();
      sendFirst();
    }, 5_000);
    leaseRenewRef.current = timer;
  }, [adapters, sendFirst, persistSettlement]);
  useEffect(() => {
    /** Lets a reloaded tab take over its durable journal immediately. */
    const releaseOnPageHide = () => {
      if (scopeRef.current) adapters.journal.release(scopeRef.current, ownerRef.current);
    };
    window.addEventListener("pagehide", releaseOnPageHide);
    return () => {
      window.removeEventListener("pagehide", releaseOnPageHide);
      releaseOnPageHide();
    };
  }, []);
  useEffect(() => {
    if (priorScopeRef.current === scope) return;
    if (priorScopeRef.current) adapters.journal.release(priorScopeRef.current, ownerRef.current);
    if (leaseRenewRef.current !== null) adapters.clock.clearInterval(leaseRenewRef.current);
    if (retryTimerRef.current !== null) adapters.clock.clearTimeout(retryTimerRef.current);
    leaseRenewRef.current = null;
    retryTimerRef.current = null;
    sentRequestRef.current = null;
    directGuessRef.current = null;
    queuedGuessesRef.current = [];
    setPendingCount(0);
    setCoinActionPending(false);
    skipLoadRef.current = null;
    skipPreviewRef.current = null;
    earlySkipLoadRef.current = null;
    journalRef.current = null;
    restoredJournalRef.current = null;
    priorScopeRef.current = scope;
    setJournalAvailable(true);
  }, [scope]);
  useLayoutEffect(() => {
    if (!scope || !state.riddle || !journalWriterRef.current) return;
    // A settled receipt awaiting deletion must not be restored from its old durable bytes.
    if (pendingSettlementWriteRef.current && !journalRef.current) return;
    /** Restores one displayed segment without writing its pre-restoration empty draft back to storage. */
    const restoreSegment = (journal: PendingGuessJournal, segment: NonNullable<ReturnType<typeof findSegment>>) => {
      restoredJournalRef.current = {scope, sessionToken: segment.riddle.sessionToken, riddle: state.riddle!, before: state};
      if (journalWriterRef.current?.prefersProviderDraft(journal, restoredGame)) return;
      /** Complete newer host history takes precedence over an older draft-only gameplay checkpoint. */
      const hostHistoryIsCurrent = journal.queue.length === 0 && !journal.coinAction &&
        state.riddle!.attemptsUsed > 0 && state.riddle!.acceptedGuesses?.length === state.riddle!.attemptsUsed &&
        state.riddle!.attemptsUsed >= (segment.base.engineSnapshot?.attemptsUsed ?? 0);
      for (const hint of segment.riddle.revealedHints ?? [])
        dispatch({type: "applyHint", index: hint.index, letter: hint.letter, newCoins: state.profile?.coins ?? 0});
      dispatch({type: "restoreQueuedGuesses", base: hostHistoryIsCurrent ? capturePendingBase(state) : segment.base,
        guesses: journal.queue.filter(item => item.message.payload.sessionToken === segment.riddle.sessionToken)
          .map(item => item.message.payload.guess),
        guessAttempts: journal.queue.filter(item => item.message.payload.sessionToken === segment.riddle.sessionToken)
          .map(item => item.attempts),draft: segment.draft,draftActiveSlotIndex: segment.draftActiveSlotIndex,draftRevision: segment.draftRevision});
      if (journal.coinAction?.type === "game:spendCoins" && journal.coinAction.payload.sessionToken === segment.riddle.sessionToken)
        dispatch({type: "previewCoinSpend",requestId: journal.coinAction.requestId!,
          amount: journal.coinAction.payload.amount ?? CONTINUE_COIN_COST,reason: "continue",
          draft: segment.draft,draftActiveSlotIndex: segment.draftActiveSlotIndex,draftRevision: segment.draftRevision});
    };
    /** The active journal used by the current operation. */
    let activeJournal = journalRef.current;
    /** Reconcile persisted and in-memory ownership before restoring input or delivering requests. */
    let persistedJournal = activeJournal ?? (journalWriterRef.current?.read(scope) ?? null);
    /** Reconciliation returns the original reference unless a confirmed prefix can safely be retired. */
    const reconciled = persistedJournal ? reconcileConfirmedPendingPlay(persistedJournal, state.riddle) : null;
    /** Other-mode input stays durable but cannot own new submissions in the displayed mode. */
    const detachOtherModeDraft = reconciled && reconciled.riddle.gameMode !== state.riddle.gameMode &&
      reconciled.queue.length === 0 && !reconciled.coinAction && reconciled.successors.length === 0;
    if (persistedJournal && (!reconciled || detachOtherModeDraft)) {
      if (!reconciled) journalWriterRef.current?.clear(scope);
      adapters.journal.release(scope, ownerRef.current);
      if (leaseRenewRef.current !== null) adapters.clock.clearInterval(leaseRenewRef.current);
      if (retryTimerRef.current !== null) adapters.clock.clearTimeout(retryTimerRef.current);
      leaseRenewRef.current = null;
      retryTimerRef.current = null;
      journalRef.current = null;
      restoredJournalRef.current = null;
      queuedGuessesRef.current = [];
      sentRequestRef.current = null;
      setPendingCount(0);
      setCoinActionPending(false);
      return;
    }
    if (reconciled && reconciled !== persistedJournal) {
      journalWriterRef.current?.write(reconciled);
      journalRef.current = reconciled;
      queuedGuessesRef.current = reconciled.queue;
      sentRequestRef.current = null;
      setPendingCount(reconciled.queue.length);
      setCoinActionPending(Boolean(reconciled.coinAction));
      persistedJournal = reconciled;
      activeJournal = reconciled;
    }
    if (persistedJournal && getConfirmedRiddleOutcome(state.riddle)) {
      // Preserve terminal authority; foreign deliveries wait until this completion is acknowledged.
      journalRef.current = persistedJournal;
      queuedGuessesRef.current = persistedJournal.queue;
      setPendingCount(persistedJournal.queue.length);
      setCoinActionPending(Boolean(persistedJournal.coinAction));
      sendFirst();
      if ((persistedJournal.queue.length || persistedJournal.coinAction) && leaseRenewRef.current === null)
        renewDelivery();
      return;
    }
    if (activeJournal) {
      /** A retained successor becomes restorable only after the preceding victory has been dismissed. */
      const segment = findSegment(activeJournal, state.riddle.sessionToken);
      if (segment) {
        if (restoredJournalRef.current?.scope !== scope || restoredJournalRef.current.sessionToken !== state.riddle.sessionToken ||
          restoredJournalRef.current.riddle !== state.riddle)
          restoreSegment(activeJournal, segment);
        sendFirst();
        if ((activeJournal.queue.length || activeJournal.coinAction) && leaseRenewRef.current === null)
          renewDelivery();
        return;
      }
      /** The previous used by the current operation. */
      const previous = activeJournal.successors.at(-1)?.riddle ?? activeJournal.riddle;
      if (
        state.riddle.gameMode !== "classic" ||
        state.riddle.index !== (previous.index ?? 0) + 1 ||
        activeJournal.successors.length >= 3
      )
        return;
      activeJournal.successors.push({riddle: state.riddle, base: capturePendingBase(state), draft: [], draftActiveSlotIndex: 0, draftRevision: state.draftRevision});
      journalWriterRef.current?.write(activeJournal);
      return;
    }
    if (queuedGuessesRef.current.length > 0) return;
    /** The journal used by the current operation. */
    const journal = persistedJournal;
    if (!journal || state.riddle.gameMode !== journal.riddle.gameMode) return;
    if (
      state.riddle.gameMode === "classic" &&
      (state.riddle.index ?? 0) > (journal.successors.at(-1)?.riddle.index ?? journal.riddle.index ?? 0)
    ) {
      journalWriterRef.current?.clear(scope);
      return;
    }
    journalRef.current = journal;
    queuedGuessesRef.current = journal.queue;
    setPendingCount(journal.queue.length);
    setCoinActionPending(Boolean(journal.coinAction));
    /** The active used by the current operation. */
    const active = journal.successors.at(-1) ?? journal;
    if (state.riddle.gameMode === "challenge" && active.riddle.sessionToken !== state.riddle.sessionToken) {
      sendFirst();
      if ((journal.queue.length || journal.coinAction) && leaseRenewRef.current === null)
        renewDelivery();
      return;
    }
    if (active.riddle.sessionToken !== state.riddle.sessionToken) dispatch({type: "loadRiddle", riddle: active.riddle});
    restoreSegment(journal, active);
    sendFirst();
    if ((journal.queue.length || journal.coinAction) && leaseRenewRef.current === null)
      renewDelivery();
  }, [dispatch, scope, sendFirst, renewDelivery, state.riddle, state.completionAcknowledged, writerRevision, restoredGame]);
  useLayoutEffect(() => {
    if (scope && journalWriterRef.current && restoredJournalRef.current?.before !== state)
      journalRef.current = journalWriterRef.current.checkpoint(scope, state, journalRef.current, capturePendingBase(state));
  }, [scope, state.currentLetters, state.activeSlotIndex, state.guessPending, state.pendingHintState,
    state.pendingCoinSpend, state.pendingGuessState, state.lastOutcome, state.engineSnapshot,
    state.riddle?.sessionToken, writerRevision]);
  /** Provides hint retry ref behavior. */
  const hintRetryRef = useRef<{
    /** Stores session token. */
    sessionToken: string;
    /** Stores attempt. */
    attempt: string;
    /** Stores request id. */
    requestId: string;
  } | null>(null);
  /** Provides continue retry ref behavior. */
  const continueRetryRef = useRef<{
    /** Stores session token. */
    sessionToken: string;
    /** Stores request id. */
    requestId: string;
  } | null>(null);
  /** Provides skip retry ref behavior. */
  const skipRetryRef = useRef<{
    /** Stores session token. */
    sessionToken: string;
    /** Stores request id. */
    requestId: string;
  } | null>(null);
  /** Requests riddle. */
  const requestRiddle = useCallback(() => {
    /** Provides current behavior. */
    const current = stateRef.current;
    /** A completed Daily advances to Classic instead of requesting the same finished session. */
    const completedDaily = current.riddle?.gameMode === "challenge" &&
      current.lastOutcome?.gameMode === "challenge" &&
      current.lastOutcome.sessionToken === current.riddle.sessionToken &&
      current.lastOutcome.riddleId === current.riddle.riddleId;
    /** The next classic used by the current operation. */
    const nextClassic =
      current.gameMode === "classic" && current.lastOutcome?.kind === "win" && current.riddle?.index !== undefined;
    /** A recovered completion can be older than progress committed by another tab. */
    const classicIndex = nextClassic && current.riddle?.index !== undefined
      ? getConfirmedRiddleOutcome(current.riddle)?.kind === "win" && Number.isSafeInteger(current.profile?.classicIndex)
        ? Math.max(current.riddle.index + 1, current.profile?.classicIndex ?? 0) : current.riddle.index + 1
      : current.profile?.classicIndex;
    postToHost({
      type: "game:loadRiddle",
      requestId: createRequestId("load"),
      payload: {
        gameMode: completedDaily ? "classic" : current.gameMode,
        locale: current.locale,
        classicIndex,
        sessionToken: nextClassic || completedDaily ? undefined : (current.riddle?.sessionToken ?? restoredGame?.sessionToken),
        riddleId: nextClassic || completedDaily ? undefined : (current.riddle?.riddleId ?? restoredGame?.riddleId),
      },
    });
  }, [postToHost, restoredGame?.riddleId, restoredGame?.sessionToken, stateRef]);
  /** Provides current attempt behavior. */
  const currentAttempt = state.riddle
    ? Array.from({length: state.riddle.answerLength}, (_, index) => state.currentLetters[index] ?? "")
    : [];
  /** The submit control follows the same consecutive-answer guard as its handler. */
  const repeatsPreviousGuess = state.guesses.at(-1)?.guess.join("").toLocaleLowerCase(state.riddle?.evaluation?.locale) ===
    currentAttempt.join("").toLocaleLowerCase(state.riddle?.evaluation?.locale);
  /** Draft validity is shared by immediate answers and answers waiting for their paid grant. */
  const canSubmitDraft =
    (!scope || Boolean(journalWriterRef.current)) &&
    hasRemainingGuessAttempts(state) &&
    !state.engineSnapshot?.gameOver &&
    !repeatsPreviousGuess &&
    (!state.guessPending ||
      (state.riddle?.evaluation &&
        journalAvailable &&
        scope !== null)) &&
    currentAttempt.length > 0 &&
    currentAttempt.every(Boolean);
  /** Ordinary answer delivery still waits for every preceding paid operation. */
  const canSubmitReady = canSubmitDraft && !coinActionPending && !state.pendingCoinSpend?.continueState;
  /** Only the same question's pending Continue may retain a sixth-attempt click. */
  const continueAction = journalRef.current?.coinAction;
  /** The pending local grant never authorizes a network guess by itself. */
  const canQueueContinueSubmit = Boolean(canSubmitDraft && state.pendingCoinSpend?.continueState &&
    state.engineSnapshot?.hasUsedContinue && continueAction?.type === "game:spendCoins" &&
    continueAction.payload.reason === "continue" && continueAction.requestId === state.pendingCoinSpend.requestId &&
    continueAction.payload.sessionToken === state.riddle?.sessionToken);
  /** A retained click becomes busy immediately and is revoked when its draft changes. */
  const submitPending = Boolean(queuedContinueSubmit && queuedContinueSubmit.owner === deliveryOwnerRef.current &&
    queuedContinueSubmit.scope === scope && queuedContinueSubmit.sessionToken === state.riddle?.sessionToken &&
    queuedContinueSubmit.guess === currentAttempt.join(""));
  /** Explicit Submit can retain a ready answer while its existing Continue settles. */
  const canSubmit = !submitPending && (canSubmitReady || canQueueContinueSubmit);
  /** Sends through the existing durable guess and replay-safe delivery path. */
  const submitReadyGuess = useCallback(() => {
    if (!canSubmitReady || !state.riddle || journalRef.current?.coinAction || skipLoadRef.current) return;
    /** Provides guess behavior. */
    const guess = currentAttempt.join("");
    /** The last guess used by the current operation. */
    const lastGuess = state.guesses.at(-1)?.guess.join("");
    if (
      lastGuess?.toLocaleLowerCase(state.riddle.evaluation?.locale) ===
      guess.toLocaleLowerCase(state.riddle.evaluation?.locale)
    )
      return;
    /** Provides retry behavior. */
    const retry = guessRetryRef.current;
    /** Requests id. */
    const requestId =
      retry?.riddleId === state.riddle.riddleId && retry.guess === guess ? retry.requestId : createRequestId("guess");
    guessRetryRef.current = {riddleId: state.riddle.riddleId, guess, requestId, guesses: state.guesses.length};
    /** The message used by the current operation. */
    const message: Extract<
      GameToHostMessage,
      {
        /** Guess-message discriminator. */ type: "game:submitGuess";
      }
    > = {
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
    if (state.riddle.evaluation && scope && journalAvailable && journalWriterRef.current) {
      if (!adapters.journal.acquire(scope, ownerRef.current, adapters.clock.now())) {
        dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
        return;
      }
      /** The answer used by the current operation. */
      const answer = state.riddle.evaluation.answer;
      /** The attempts used by the current operation. */
      const attempts = (state.engineSnapshot?.attemptsUsed ?? 0) + 1;
      /** Locally predicted correctness. */
      const isCorrect =
        guess.toLocaleLowerCase(state.riddle.evaluation.locale) ===
        answer.toLocaleLowerCase(state.riddle.evaluation.locale);
      /** Whether this attempt reaches the paid-continue boundary. */
      const canContinue = !isCorrect && attempts === 5 && !state.engineSnapshot?.hasUsedContinue;
      /** Whether this attempt ends the question. */
      const gameOver = isCorrect || (!canContinue && attempts >= 5 + (state.engineSnapshot?.hasUsedContinue ? 1 : 0));
      /** The queued used by the current operation. */
      const queued: QueuedGuess = {
        message,
        attempts,
        isCorrect,
        gameOver,
        canContinue,
        feedback: computeFeedback(guess, answer, state.riddle.evaluation.locale),
      };
      /** The base used by the current operation. */
      const base: PendingGuessState = state.pendingGuessState ?? capturePendingBase(state);
      /** The journal used by the current operation. */
      /** Failed durability must not append an unsaved request to the live retry queue. */
      const retained = journalRef.current;
      /** Working copy is published only after durable admission succeeds. */
      const journal: PendingGuessJournal = retained ? {...retained, successors: retained.successors.map(segment => ({...segment}))}
        : journalWriterRef.current.create(state, scope, state.riddle, base);
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
        if (
          successor &&
          !journal.queue.some((item) => item.message.payload.sessionToken === state.riddle?.sessionToken)
        )
          successor.base = base;
      }
      journal.queue = [...journal.queue, queued];
      journal.draft = [];
      journal.draftActiveSlotIndex = 0;
      journal.draftRevision = state.draftRevision;
      if (!journalWriterRef.current?.write(journal)) {
        if (queuedGuessesRef.current.length > 0) {
          dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
          return;
        }
        setJournalAvailable(false);
        adapters.journal.release(scope, ownerRef.current);
        playFeedback("submit");
        dispatch({type: "guessRequested"});
        sendDirectGuess(message);
        return;
      }
      journalRef.current = journal;
      queuedGuessesRef.current = journal.queue;
      setPendingCount(journal.queue.length);
      playFeedback("submit");
      dispatch({type: "guessRequested"});
      if (journal.queue.length === 1) sendFirst();
      if (leaseRenewRef.current === null) renewDelivery();
    } else {
      playFeedback("submit");
      dispatch({type: "guessRequested"});
      sendDirectGuess(message);
    }
  }, [canSubmitReady, currentAttempt, dispatch, journalAvailable, playFeedback, postToHost, scope, sendFirst, renewDelivery, sendDirectGuess, state]);
  /** Retains an explicit click without submitting a speculative paid attempt. */
  const submitGuess = useCallback(() => {
    if (!canSubmit) return;
    /** Admission rechecks mutable receipt ownership in case it settled before this click. */
    const action = journalRef.current?.coinAction, owner = deliveryOwnerRef.current;
    if (canQueueContinueSubmit && scope && owner && action?.type === "game:spendCoins" &&
      action.payload.reason === "continue" && action.requestId &&
      action.requestId === state.pendingCoinSpend?.requestId && action.payload.sessionToken === state.riddle?.sessionToken) {
      setQueuedContinueSubmit({owner, scope, requestId: action.requestId, sessionToken: action.payload.sessionToken,
        guess: currentAttempt.join(""), status: "waiting"});
      return;
    }
    submitReadyGuess();
  }, [canSubmit, canQueueContinueSubmit, currentAttempt, scope, state.pendingCoinSpend?.requestId, state.riddle?.sessionToken, submitReadyGuess]);
  useEffect(() => {
    if (!queuedContinueSubmit || stateRef.current !== state) return;
    if (queuedContinueSubmit.owner !== deliveryOwnerRef.current || queuedContinueSubmit.scope !== scope ||
      queuedContinueSubmit.sessionToken !== state.riddle?.sessionToken ||
      queuedContinueSubmit.guess !== currentAttempt.join("") || !state.engineSnapshot?.hasUsedContinue ||
      state.engineSnapshot?.gameOver || state.lastOutcome) {
      setQueuedContinueSubmit(null);
      return;
    }
    if (queuedContinueSubmit.status !== "accepted" || state.pendingCoinSpend || coinActionPending ||
      !canSubmitReady || journalRef.current?.coinAction || skipLoadRef.current || !canEditCurrentGuess(state)) return;
    setQueuedContinueSubmit(null);
    if (consumedContinueSubmitRef.current === queuedContinueSubmit.requestId) return;
    consumedContinueSubmitRef.current = queuedContinueSubmit.requestId;
    submitReadyGuess();
  }, [queuedContinueSubmit, canSubmitReady, coinActionPending, currentAttempt, scope, state, stateRef, submitReadyGuess]);
  /** Restores the last confirmed checkpoint and removes every dependent provisional action. */
  const rollbackQueuedPlay = useCallback(
    (first: QueuedGuess) => {
      /** The checkpoint used by the current operation. */
      const checkpoint = journalRef.current;
      /** Retires queued mutations and the unpaid hint preview before preserving the same-question user draft. */
      const retainedDraft = checkpoint ? createRejectedPlayDraft(checkpoint,
        gameSessionReducer(stateRef.current, {type: "rejectHint"})) : null;
      if (checkpoint?.coinAction?.type === "game:spendCoins")
        dispatch({type: "rejectCoinSpend", requestId: checkpoint.coinAction.requestId!});
      queuedGuessesRef.current = [];
      setPendingCount(0);
      setCoinActionPending(false);
      sentRequestRef.current = null;
      if (checkpoint && (!retainedDraft || !journalWriterRef.current?.write(retainedDraft))) journalWriterRef.current?.clear(checkpoint.scope);
      journalRef.current = retainedDraft;
      restoredJournalRef.current = null;
      if (scopeRef.current) adapters.journal.release(scopeRef.current, ownerRef.current);
      if (leaseRenewRef.current !== null) adapters.clock.clearInterval(leaseRenewRef.current);
      leaseRenewRef.current = null;
      if (checkpoint) {
        if (
          stateRef.current.riddle?.sessionToken === checkpoint.riddle.sessionToken ||
          checkpoint.riddle.gameMode === "classic"
        ) {
          dispatch({type: "restoreConfirmedRiddle", riddle: checkpoint.riddle, base: checkpoint.base});
          // The same riddle object may not rerun the recovery effect after rollback.
          if (retainedDraft) dispatch({type: "restoreQueuedGuesses",base: checkpoint.base,guesses: [],
            draft: retainedDraft.draft,draftActiveSlotIndex: retainedDraft.draftActiveSlotIndex,draftRevision: retainedDraft.draftRevision});
        }
        postToHost({
          type: "game:loadRiddle",
          requestId: createRequestId("reconcile"),
          payload: {
            gameMode: checkpoint.riddle.gameMode,
            locale: stateRef.current.locale,
            authoritative: true,
          },
        });
      } else dispatch({type: "guessFailed"});
      if (first.isCorrect && first.gameOver)
        postToHost({type: "game:recordAchievements", payload: {achievementIds: []}});
      dispatch({type: "setNotice", notice: "ErrorMessages.PLAY_RESTORED"});
    },
    [dispatch, postToHost, stateRef],
  );
  /** Consumes only the responses belonging to locally queued guesses. */
  const handleQueuedGuessResult = useCallback(
    (
      message: Extract<
        HostToGameMessage,
        {
          /** Correlated result discriminator. */ type: "host:operationResult";
        }
      >,
    ): boolean => {
      /** Receipt operation is immutable throughout this correlated delivery. */
      const operation = message.payload.operation;
      if (
        operation === "hint" ||
        operation === "spendCoins" ||
        operation === "skip"
      ) {
        // Account revocation must precede journal deletion, rollback and generic handling.
        if (journalRef.current?.scope !== scopeRef.current) {
          /** A terminal host update can retire the journal before its still-owned balance receipt arrives. */
          const current = stateRef.current;
          /** Render-time account revocation still outranks an older committed pending charge. */
          const currentScope = current.user ? pendingPlayScope(current.user.uid, current.user.accountGeneration, current.locale) : null;
          return !(journalRef.current === null && currentScope === scopeRef.current &&
            operation === "spendCoins" && current.pendingCoinSpend?.requestId === message.requestId);
        }
        /** Paid request retained until its correlated authoritative result arrives. */
        const action = journalRef.current?.coinAction;
        /** Operation name expected for the retained paid action. */
        const expectedOperation =
          action?.type === "game:requestHint" ? "hint" : action?.type === "game:spendCoins" ? "spendCoins" : "skip";
        if (!action || action.requestId !== message.requestId || operation !== expectedOperation)
          return true;
        if (!message.payload.ok && message.payload.errorKind === "retryable") return true;
        if (action.type === "game:spendCoins" && action.payload.reason === "continue") {
          /** The same receipt validation required by the normal coin-confirmation path. */
          const data = message.payload.data;
          /** Malformed and rejected grants must never release the retained sixth answer. */
          const accepted = message.payload.ok && typeof data === "object" && data !== null &&
            "newCoins" in data && typeof data.newCoins === "number" && Number.isFinite(data.newCoins);
          setQueuedContinueSubmit(intent => !intent || intent.requestId !== action.requestId ? intent
            : accepted ? {...intent, status: "accepted"} : null);
        }
        /** Durable confirmed state before the paid action. */
        const checkpoint = journalRef.current;
        /** A rejected paid Skip invalidates only its explicitly owned speculative question. */
        const rejectedPreview = !message.payload.ok && action.type === "game:skipRiddle" &&
          checkpoint?.skipPreview?.requestId === action.requestId ? checkpoint?.skipPreview?.riddle.sessionToken : undefined;
        /** Unrelated future deliveries retain their exact identity and order. */
        const queue = checkpoint?.queue.filter(item => item.message.payload.sessionToken !== rejectedPreview) ?? [];
        /** Rejected speculative drafts must not resurrect on the next mount. */
        const successors = checkpoint?.successors.filter(segment => segment.riddle.sessionToken !== rejectedPreview) ?? [];
        /** Settling a predecessor's paid receipt must not discard later owned requests or drafts. */
        const remaining = checkpoint && (successors.length > 0 || queue.length > 0)
          ? {...checkpoint, successors, queue, coinAction: undefined, skipPreview: undefined} : null;
        // Capture predecessor bytes before later in-memory drafts can change.
        pendingSettlementWriteRef.current = JSON.stringify(checkpoint);
        journalRef.current = remaining;
        queuedGuessesRef.current = remaining?.queue ?? [];
        setPendingCount(queuedGuessesRef.current.length);
        sentRequestRef.current = null;
        /** Only the current question may consume this action's result and successor. */
        const currentSession = action.payload.sessionToken === stateRef.current.riddle?.sessionToken;
        /** An older paid receipt settles delivery without changing confirmed terminal presentation. */
        const terminalSession = currentSession && Boolean(stateRef.current.riddle &&
          getConfirmedRiddleOutcome(stateRef.current.riddle));
        if (!message.payload.ok && action.type === "game:requestHint") dispatch({type: "rejectHint"});
        if (!message.payload.ok && action.type === "game:spendCoins")
          dispatch({type: "rejectCoinSpend", requestId: action.requestId!});
        if (!message.payload.ok && action.type === "game:skipRiddle") {
          /** Rollback belongs to the paid origin or its explicitly admitted speculative session. */
          const origin = checkpoint && findSegment(checkpoint, action.payload.sessionToken);
          /** Independently loaded next questions do not inherit speculative rollback ownership. */
          const speculative = checkpoint?.skipPreview;
          /** Only the exact durable preview can be undone by this paid rejection. */
          const previewOwned = speculative && speculative.requestId === action.requestId &&
            speculative.riddle.sessionToken === stateRef.current.riddle?.sessionToken;
          dispatch({type: "rejectCoinSpend", requestId: action.requestId!});
          skipPreviewRef.current = null;
          earlySkipLoadRef.current = null;
          if (origin && (currentSession || previewOwned))
            dispatch({type: "restoreConfirmedRiddle", riddle: origin.riddle, base: origin.base});
        }
        if (message.payload.ok && action.type === "game:skipRiddle") {
          /** Server balance is authoritative even if a profile refresh arrived earlier. */
          const data = message.payload.data;
          if (data && typeof data === "object" && "newCoins" in data && typeof data.newCoins === "number")
            dispatch({type: "confirmCoinSpend", requestId: action.requestId!, newCoins: data.newCoins});
          /** Successor returned before the paid Skip receipt. */
          const early = earlySkipLoadRef.current;
          if (early && early.requestId === action.requestId) {
            if (ownsSkipSuccessor(early.origin, early.riddle, stateRef.current.riddle) &&
              stateRef.current.riddle?.sessionToken !== early.riddle.sessionToken)
              dispatch({type: "loadRiddle", riddle: early.riddle});
            earlySkipLoadRef.current = null;
            skipPreviewRef.current = null;
          } else {
            /** The retained issued segment supplies the bound after its paid journal is removed. */
            const origin = checkpoint && findSegment(checkpoint, action.payload.sessionToken)?.riddle;
            if (origin && stateRef.current.riddle && (stateRef.current.riddle.sessionToken === origin.sessionToken ||
              (stateRef.current.riddle.gameMode === "classic" && stateRef.current.riddle.index === (origin.index ?? -2) + 1)))
              skipLoadRef.current = {requestId: action.requestId!, sessionToken: action.payload.sessionToken, riddle: origin};
          }
        }
        setCoinActionPending(Boolean(skipLoadRef.current));
        if (leaseRenewRef.current !== null) adapters.clock.clearInterval(leaseRenewRef.current);
        leaseRenewRef.current = null;
        if (remaining?.queue.length || pendingSettlementWriteRef.current) {
          sendFirst();
          renewDelivery();
          persistSettlement();
        }
        // A late hint must never reveal a letter in a different question or account.
        return action.type === "game:spendCoins" ? false : message.payload.ok ? !currentSession || terminalSession : false;
      }
      /** The first used by the current operation. */
      const first = queuedGuessesRef.current[0];
      if (operation !== "guess") return false;
      if (!first || message.requestId !== first.message.requestId) {
        /** Only a still-owned fallback may reach the generic non-provisional answer handler. */
        const direct = directGuessRef.current;
        if (!direct || direct.requestId !== message.requestId || direct.scope !== scopeRef.current ||
          direct.sessionToken !== stateRef.current.riddle?.sessionToken) return true;
        directGuessRef.current = null;
        return false;
      }
      // Scope updates during render; do not wait for the effect that retires the old queue.
      if (journalRef.current?.scope !== scopeRef.current) return true;
      if (!message.payload.ok) {
        if (message.payload.errorKind !== "rejected") {
          if (retryTimerRef.current !== null) adapters.clock.clearTimeout(retryTimerRef.current);
          /** Exact lifetime admitting this retry, independent of later scope reuse. */
          const owner = deliveryOwnerRef.current;
          /** Cancelled timeout cannot clear a replacement retry or send its queue. */
          const timer = adapters.clock.setTimeout(() => {
            if (!owner || deliveryOwnerRef.current !== owner || retryTimerRef.current !== timer) return;
            retryTimerRef.current = null;
            if (queuedGuessesRef.current[0]?.message.requestId !== first.message.requestId) return;
            sentRequestRef.current = null;
            sendFirst();
          }, 1_000);
          retryTimerRef.current = timer;
          return true;
        }
        if (retryTimerRef.current !== null) adapters.clock.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
        rollbackQueuedPlay(first);
        return true;
      }
      /** The data used by the current operation. */
      const data = message.payload.data;
      if (retryTimerRef.current !== null) adapters.clock.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      /** The result used by the current operation. */
      const result = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
      /** The feedback used by the current operation. */
      const feedback = Array.isArray(result.feedback)
        ? result.feedback.map((item: unknown) =>
            typeof item === "object" && item !== null && "status" in item ? item.status : null,
          )
        : [];
      if (
        result.attempts !== first.attempts ||
        result.isCorrect !== first.isCorrect ||
        result.gameOver !== first.gameOver ||
        Boolean(result.canContinue) !== first.canContinue ||
        JSON.stringify(feedback) !== JSON.stringify(first.feedback)
      ) {
        rollbackQueuedPlay(first);
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
        const base = gameSessionReducer(
          {
            ...stateRef.current,
            ...segment.base,
            draftRevision: segment.base.draftRevision ?? stateRef.current.draftRevision,
            riddle: segment.riddle,
            guessPending: false,
            pendingGuessState: null,
          },
          {
            type: "guessResolved",
            feedback: scored,
            attempts: first.attempts,
            isCorrect: first.isCorrect,
            gameOver: first.gameOver,
            canContinue: first.canContinue,
          },
        );
        /** Settlement retains the same complete snapshot shape as draft admission. */
        const updatedBase = capturePendingBase(base);
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
            journal.draftActiveSlotIndex = nextSegment.draftActiveSlotIndex;
            journal.draftRevision = nextSegment.draftRevision;
          }
        }
        if (journal.queue.length > 0 || journal.coinAction) journalWriterRef.current?.write(journal);
        else {
          journalWriterRef.current?.clear(journal.scope);
          journalRef.current = null;
          adapters.journal.release(journal.scope, ownerRef.current);
          if (leaseRenewRef.current !== null) adapters.clock.clearInterval(leaseRenewRef.current);
          leaseRenewRef.current = null;
        }
      }
      if (stateRef.current.riddle?.sessionToken === first.message.payload.sessionToken)
        dispatch({
          type: "guessCheckpointAdvanced",
          feedback: scored,
          attempts: first.attempts,
          isCorrect: first.isCorrect,
          gameOver: first.gameOver,
          canContinue: first.canContinue,
        });
      queuedGuessesRef.current.shift();
      setPendingCount(queuedGuessesRef.current.length);
      sentRequestRef.current = null;
      /** The next used by the current operation. */
      const next = queuedGuessesRef.current[0];
      if (next) sendFirst();
      else {
        dispatch({type: "guessPreviewConfirmed"});
        if (journalRef.current?.coinAction) sendFirst();
        if (first.canContinue && stateRef.current.riddle?.sessionToken === first.message.payload.sessionToken &&
          !stateRef.current.engineSnapshot?.hasUsedContinue)
          dispatch({type: "openModal", modal: "continue"});
      }
      return true;
    },
    [dispatch, postToHost, rollbackQueuedPlay, sendFirst, renewDelivery, persistSettlement, stateRef],
  );
  /** Rejects duplicate or stale Skip successor loads, including after account changes. */
  const acceptRiddleResult = useCallback(
    (
      message: Extract<
        HostToGameMessage,
        {
          /** Correlated question result. */ type: "host:riddleLoaded";
        }
      >,
    ) => {
      // An account or locale change revokes correlated Skip delivery before passive cleanup.
      if (message.requestId?.startsWith("skip-") && priorScopeRef.current !== scopeRef.current) return false;
      if (message.requestId?.startsWith("skip-preview-")) {
        /** Locally shown state awaiting server confirmation. */
        const preview = skipPreviewRef.current;
        if (
          !preview ||
          preview.requestId !== message.requestId ||
          journalRef.current?.scope !== scopeRef.current || journalRef.current?.coinAction?.type !== "game:skipRiddle"
        )
          return false;
        /** Bind the speculative reply to the issued origin and persist ownership before admission. */
        const journal = journalRef.current!;
        /** The paid action's issued segment is the only valid predecessor. */
        const origin = findSegment(journal, preview.sessionToken)?.riddle;
        if (!origin || journal.coinAction!.payload.sessionToken !== origin.sessionToken ||
          !ownsSkipSuccessor(origin, message.payload.riddle, stateRef.current.riddle) ||
          journal.skipPreview || earlySkipLoadRef.current) return false;
        /** Durable identity survives reload without claiming independently loaded next rounds. */
        const owned = {...journal, skipPreview: {requestId: journal.coinAction!.requestId!,
          sessionToken: origin.sessionToken, riddle: message.payload.riddle}};
        if (!journalWriterRef.current?.write(owned)) return false;
        journalRef.current = owned;
        return true;
      }
      if (message.requestId?.startsWith("skip-")) {
        if (skipLoadRef.current?.requestId !== message.requestId) {
          /** The originating journal bounds an early authoritative successor to this paid request. */
          const journal = journalRef.current;
          /** Only a Skip can correlate this load before its receipt arrives. */
          const action = journal?.coinAction;
          /** Issued predecessor may be one of the provisional journal's successor segments. */
          const origin = journal && action?.type === "game:skipRiddle" ? findSegment(journal, action.payload.sessionToken)?.riddle : null;
          if (journal?.scope === scopeRef.current && action?.type === "game:skipRiddle" &&
            action.requestId === message.requestId && origin &&
            ownsSkipSuccessor(origin, message.payload.riddle, stateRef.current.riddle)) {
            if (journal.skipPreview) {
              /** Authoritative delivery retires speculative rollback ownership before becoming current. */
              const confirmed = {...journal, skipPreview: undefined};
              if (!journalWriterRef.current?.write(confirmed)) return false;
              journalRef.current = confirmed;
            }
            earlySkipLoadRef.current = {requestId: message.requestId, riddle: message.payload.riddle, origin};
            // The host may supersede the optional preview with this accepted successor.
            // Its separate receipt still settles the paid action and existing rollback.
            return stateRef.current.riddle?.sessionToken !== message.payload.riddle.sessionToken;
          }
          return false;
        }
        if (!ownsSkipSuccessor(skipLoadRef.current.riddle, message.payload.riddle, stateRef.current.riddle)) return false;
        skipLoadRef.current = null;
        skipPreviewRef.current = null;
        setCoinActionPending(false);
        if (stateRef.current.riddle?.sessionToken === message.payload.riddle.sessionToken) return false;
      } else if (skipLoadRef.current && message.payload.riddle.sessionToken !== skipLoadRef.current.sessionToken) {
        skipLoadRef.current = null;
        setCoinActionPending(false);
      }
      return true;
    },
    [],
  );
  /** Persists a confirmed coin action behind earlier answers before any network delivery. */
  const enqueueCoinAction = useCallback(
    (message: QueuedCoinAction): boolean => {
      /** Latest gameplay state, including a draft typed while prior answers synchronize. */
      const current = stateRef.current;
      if (!scope || !current.riddle || !journalWriterRef.current || journalRef.current?.coinAction || skipLoadRef.current) return false;
      if (
        (current.guessPending && !journalRef.current) ||
        !adapters.journal.acquire(scope, ownerRef.current, adapters.clock.now())
      ) {
        dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
        return false;
      }
      /** Existing ordered answers, or a checkpoint for a standalone coin action. */
      const journal: PendingGuessJournal = {
        ...(journalRef.current ?? journalWriterRef.current.create(current, scope, current.riddle, {...capturePendingBase(current), modal: null})),
        coinAction: message,
      };
      if (!journalWriterRef.current?.write(journal)) {
        dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
        return false;
      }
      journalRef.current = journal;
      setCoinActionPending(true);
      if (queuedGuessesRef.current.length === 0) sendFirst();
      if (leaseRenewRef.current === null) renewDelivery();
      return true;
    },
    [dispatch, scope, sendFirst, renewDelivery, stateRef],
  );

  useEffect(() => {
    if (!state.guessPending && state.guesses.length > (guessRetryRef.current?.guesses ?? Infinity)) {
      guessRetryRef.current = null;
    }
  }, [state.guesses.length, state.guessPending]);
  /** Requests hint. */
  const requestHint = useCallback(() => {
    if (!state.riddle || state.engineSnapshot?.gameOver) return;
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
    /** Whether the paid action was durably queued. */
    const accepted = enqueueCoinAction({
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
    if (accepted && state.riddle.evaluation) {
      /** Preloaded answer and content locale used to reveal the hint. */
      const {answer, locale} = state.riddle.evaluation;
      /** Normalized answer letters used to choose the hint position. */
      const answerLetters = lowerCaseGraphemes(answer.trim(), locale);
      /** Answer position selected for the hint. */
      const index = answerLetters.findIndex(
        (letter, candidate) =>
          !state.hintRevealedIndices.includes(candidate) &&
          lowerCaseGraphemes(currentAttempt[candidate] ?? "", locale).join("") !== letter,
      );
      if (index >= 0) dispatch({type: "previewHint", index, letter: answerLetters[index] ?? ""});
    }
  }, [
    currentAttempt,
    dispatch,
    enqueueCoinAction,
    state.engineSnapshot?.gameOver,
    state.hintRevealedIndices,
    state.riddle,
  ]);

  useEffect(() => {
    hintRetryRef.current = null;
  }, [state.hintRevealedIndices.length]);
  /** Requests continue. */
  const requestContinue = useCallback(
    (amount?: number) => {
      if (
        !state.riddle ||
        !state.profile ||
        state.profile.coins < CONTINUE_COIN_COST ||
        journalRef.current?.coinAction ||
        continuePendingRef.current ||
        stateRef.current.pendingCoinSpend
      )
        return;
      /** Provides retry behavior. */
      const retry = continueRetryRef.current;
      /** Requests id. */
      const requestId =
        retry?.sessionToken === state.riddle.sessionToken ? retry.requestId : createRequestId("continue");
      continueRetryRef.current = {sessionToken: state.riddle.sessionToken, requestId};
      continuePendingRef.current = true;
      /** Continue request retained behind the final guess until that guess settles. */
      const accepted = enqueueCoinAction({
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
      if (accepted) dispatch({type: "previewCoinSpend", requestId, amount: CONTINUE_COIN_COST, reason: "continue"});
      else continuePendingRef.current = false;
    },
    [dispatch, enqueueCoinAction, state.profile, state.riddle, stateRef],
  );
  /** Requests skip. */
  const requestSkip = useCallback(() => {
    if (!state.riddle || stateRef.current.pendingCoinSpend) return;
    if (state.riddle.gameMode === "challenge") {
      /** A mode change must not retire unconfirmed guesses or a newer session. */
      const current = stateRef.current;
      if (current.riddle?.sessionToken !== state.riddle.sessionToken || current.guessPending || current.lastOutcome) return;
      postToHost({
        type: "game:loadRiddle",
        requestId: createRequestId("load"),
        payload: {gameMode: "classic", locale: current.locale, classicIndex: current.profile?.classicIndex},
      });
      return;
    }
    /** Provides retry behavior. */
    const retry = skipRetryRef.current;
    /** Requests id. */
    const requestId = retry?.sessionToken === state.riddle.sessionToken ? retry.requestId : createRequestId("skip");
    skipRetryRef.current = {sessionToken: state.riddle.sessionToken, requestId};
    /** Whether the paid action was durably queued. */
    const accepted = enqueueCoinAction({
      type: "game:skipRiddle",
      requestId,
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        sessionToken: state.riddle.sessionToken,
      },
    });
    if (accepted) dispatch({type: "previewCoinSpend", requestId, amount: SKIP_COIN_COST});
    if (accepted && state.riddle.index !== undefined) {
      /** Correlation ID for the speculative successor request. */
      const requestId = createRequestId("skip-preview");
      skipPreviewRef.current = {requestId, sessionToken: state.riddle.sessionToken};
      postToHost({
        type: "game:loadRiddle",
        requestId,
        payload: {
          gameMode: "classic",
          locale: state.locale,
          classicIndex: state.riddle.index + 1,
        },
      });
    }
  }, [dispatch, enqueueCoinAction, postToHost, state.locale, state.riddle, stateRef]);

  /** Hide only the discarded session while its paid Skip or successor is outstanding. */
  const waitingForSkippedRiddle = coinActionPending && Boolean(state.riddle) && (
    (journalRef.current?.coinAction?.type === "game:skipRiddle" &&
      journalRef.current.coinAction.payload.sessionToken === state.riddle?.sessionToken) ||
    skipLoadRef.current?.sessionToken === state.riddle?.sessionToken
  );

  /** Paid actions may follow durable guesses, but must wait for an unjournaled guess to settle. */
  const coinActionsReady = Boolean(scope && state.riddle && journalWriterRef.current) && !coinActionPending &&
    !state.pendingCoinSpend && (!state.guessPending || Boolean(journalRef.current));

  return {
    inputReady: Boolean(journalWriterRef.current) && deliveryOwnerRef.current?.scope === scope && deliveryOwnerRef.current?.postToHost === postToHost,
    waitingForSkippedRiddle,
    coinActionsReady,
    canSubmit,
    submitPending,
    submitGuess,
    handleQueuedGuessResult,
    acceptRiddleResult,
    requestRiddle,
    requestHint,
    requestContinue,
    requestSkip,
    canPurchase: pendingCount === 0 && !coinActionPending,
  };
}
