import {useCallback, useEffect, useRef, useState} from "react";
import type {RefObject} from "react";
import type {GameSessionState} from "../../gameSessionTypes";
import {canEditCurrentGuess} from "../../gameSession";
import type {PendingGuessJournal} from "../../pendingGuessJournal";

/** A player click waits for one exact paid Continue receipt without surviving reload. */
type QueuedContinueSubmit = Readonly<{
  /** Committed account and sender lifetime admitting the click. */ owner: object;
  /** Account generation and language owning the answer. */ scope: string;
  /** Paid Continue request whose accepted receipt permits delivery. */ requestId: string;
  /** Authority-issued question owning this answer. */ sessionToken: string;
  /** Editing the answer cancels automatic delivery. */ guess: string;
  /** Only a validated successful Continue receipt admits the answer. */ status: "waiting" | "accepted";
}>;

/** Owns the explicit Submit click retained while a paid extra attempt settles. */
export function useQueuedContinueSubmit({
  state, stateRef, deliveryOwnerRef, journalRef, skipLoadRef, scope, guess,
  canSubmitDraft, canSubmitReady, coinActionPending, onSubmit,
}: {
  /** Rendered question and pending paid operation. */ state: GameSessionState;
  /** A newer committed render can retire this effect before it runs. */ stateRef: RefObject<GameSessionState>;
  /** Exact account and sender visit that owns the retained click. */ deliveryOwnerRef: RefObject<object | null>;
  /** Mutable receipt ownership is rechecked at click and delivery time. */ journalRef: RefObject<PendingGuessJournal | null>;
  /** A pending Skip prevents a deferred answer from overtaking navigation. */ skipLoadRef: RefObject<unknown>;
  /** Account generation and language of the displayed question. */ scope: string | null;
  /** Current answer text; any edit retires the retained click. */ guess: string;
  /** Existing draft and attempt validation, before paid-operation guards. */ canSubmitDraft: boolean | undefined;
  /** Existing ordinary-submit admission after paid-operation guards. */ canSubmitReady: boolean | undefined;
  /** An unconfirmed paid operation still owns delivery ordering. */ coinActionPending: boolean;
  /** Ordinary durable guess path, called only after the matching paid receipt. */ onSubmit: () => void;
}) {
  /** The retained intent is local state and is never written to the recovery journal. */
  const [intent, setIntent] = useState<QueuedContinueSubmit | null>(null);
  /** Effect replay cannot send the same deferred answer twice. */
  const consumedRequest = useRef<string | null>(null);
  /** Only the same question's pending Continue may retain a sixth-attempt click. */
  const continueAction = journalRef.current?.coinAction;
  /** The pending local grant never authorizes a network guess by itself. */
  const canQueue = Boolean(canSubmitDraft && state.pendingCoinSpend?.continueState &&
    state.engineSnapshot?.hasUsedContinue && continueAction?.type === "game:spendCoins" &&
    continueAction.payload.reason === "continue" && continueAction.requestId === state.pendingCoinSpend.requestId &&
    continueAction.payload.sessionToken === state.riddle?.sessionToken);
  /** A retained click becomes busy immediately and is revoked when its draft changes. */
  const submitPending = Boolean(intent && intent.owner === deliveryOwnerRef.current &&
    intent.scope === scope && intent.sessionToken === state.riddle?.sessionToken && intent.guess === guess);
  /** Explicit Submit may retain an answer while its existing Continue settles. */
  const canSubmit = !submitPending && (canSubmitReady || canQueue);
  /** Retains an explicit click without submitting a speculative paid attempt. */
  const submitGuess = useCallback(() => {
    if (!canSubmit) return;
    /** Admission rechecks mutable receipt ownership in case it settled before this click. */
    const action = journalRef.current?.coinAction, owner = deliveryOwnerRef.current;
    if (canQueue && scope && owner && action?.type === "game:spendCoins" &&
      action.payload.reason === "continue" && action.requestId &&
      action.requestId === state.pendingCoinSpend?.requestId && action.payload.sessionToken === state.riddle?.sessionToken) {
      setIntent({owner, scope, requestId: action.requestId, sessionToken: action.payload.sessionToken,
        guess, status: "waiting"});
      return;
    }
    onSubmit();
  }, [canSubmit, canQueue, deliveryOwnerRef, guess, journalRef, scope,
    state.pendingCoinSpend?.requestId, state.riddle?.sessionToken, onSubmit]);
  useEffect(() => {
    if (!intent || stateRef.current !== state) return;
    if (intent.owner !== deliveryOwnerRef.current || intent.scope !== scope ||
      intent.sessionToken !== state.riddle?.sessionToken || intent.guess !== guess ||
      !state.engineSnapshot?.hasUsedContinue || state.engineSnapshot?.gameOver || state.lastOutcome) {
      setIntent(null);
      return;
    }
    if (intent.status !== "accepted" || state.pendingCoinSpend || coinActionPending ||
      !canSubmitReady || journalRef.current?.coinAction || skipLoadRef.current || !canEditCurrentGuess(state)) return;
    setIntent(null);
    if (consumedRequest.current === intent.requestId) return;
    consumedRequest.current = intent.requestId;
    onSubmit();
  }, [intent, canSubmitReady, coinActionPending, deliveryOwnerRef, guess, journalRef,
    scope, skipLoadRef, state, stateRef, onSubmit]);
  /** Only a correlated, valid Continue balance receipt releases the retained answer. */
  const settleContinueSubmit = useCallback((requestId: string | undefined, ok: boolean, data: unknown) => {
    /** Match the ordinary coin-confirmation path's existing finite-balance validation. */
    const accepted = ok && typeof data === "object" && data !== null &&
      "newCoins" in data && typeof data.newCoins === "number" && Number.isFinite(data.newCoins);
    setIntent(current => !current || current.requestId !== requestId ? current
      : accepted ? {...current, status: "accepted"} : null);
  }, []);
  return {canSubmit, submitPending, submitGuess, settleContinueSubmit};
}
