import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import type {Dispatch} from "react";
import type {GameToHostMessage} from "../../../platform/bridge/messages";
import type {GameSessionAction, GameSessionState} from "../../session/gameSessionTypes";
import {createRequestId} from "../../session/requestIds";
import {completionPresentationKey} from "../../session/completion/completionPresentation";

/** Delays used for bounded-backoff completion delivery. */
const COMPLETION_RETRY_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

/** Delivers one terminal outcome until its idempotent backend acknowledgement arrives. */
export function useCompletionDelivery({
  outcome,
  dispatch,
  postToHost,
  ownerKey,
}: {
  /** Unacknowledged authoritative terminal outcome. */ outcome: GameSessionState["lastOutcome"];
  /** Game-session reducer dispatcher. */ dispatch: Dispatch<GameSessionAction>;
  /** Sends a validated command to the host. */ postToHost: (message: GameToHostMessage) => void;
  /** Account UID and creation generation owning every retained receipt. */ ownerKey?: string;
}): (ok: boolean, requestId?: string) => boolean {
  /** One lazily created completion set survives updates to the mounted game. */
  const [completedKeysRef] = useState(() => ({current: new Set<string>()}));
  /** Pending delivery storage is created once rather than discarded on each answer edit. */
  const [deliveriesRef] = useState(() => ({current: new Map<string, {
    /** Stores outcome id. */
    completionKey: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string; /** Stores attempts. */
    /** Stores attempts. */
    attempts: number; /** Stores outcome. */
    /** Stores outcome. */
    outcome: NonNullable<GameSessionState["lastOutcome"]>; /** Stores timer. */
    /** Stores timer. */
    timer?: number;
  }>()}));
  /** Receipts acknowledge the committed outcome rather than a suspended replacement. */
  const currentOutcomeRef = useRef(outcome);
  useLayoutEffect(() => {currentOutcomeRef.current = outcome;}, [outcome]);
  /** Render immediately revokes receipt acknowledgement for a replaced account. */
  const currentOwnerRef = useRef(ownerKey);
  currentOwnerRef.current = ownerKey;
  /** Committed delivery scope owns timer cleanup when the account changes. */
  const deliveryOwnerRef = useRef(ownerKey);
  /** Provides [retry signal, set retry signal] behavior. */
  const [retrySignal, setRetrySignal] = useState(0);

  /** Handles result. */
  const handleResult = useCallback(
    (ok: boolean, requestId?: string): boolean => {
      if (!ok || !requestId || currentOwnerRef.current !== deliveryOwnerRef.current) return false;
      /** Provides delivery behavior. */
      const delivery = [...deliveriesRef.current.values()].find((entry) => entry.requestId === requestId);
      if (!delivery) return false;
      if (delivery.timer !== undefined) window.clearTimeout(delivery.timer);
      completedKeysRef.current.add(delivery.completionKey);
      deliveriesRef.current.delete(delivery.completionKey);
      /** Indicates whether is current. */
      const isCurrent = currentOutcomeRef.current !== null &&
        completionPresentationKey(currentOutcomeRef.current) === delivery.completionKey;
      if (isCurrent) dispatch({type: "completionAcknowledged"});
      return isCurrent;
    },
    [dispatch],
  );

  useEffect(() => {
    if (deliveryOwnerRef.current !== ownerKey) {
      for (const delivery of deliveriesRef.current.values())
        if (delivery.timer !== undefined) window.clearTimeout(delivery.timer);
      deliveriesRef.current.clear();
      completedKeysRef.current.clear();
      deliveryOwnerRef.current = ownerKey;
    }
    /** Question identity remains stable through canonical attempt reconciliation. */
    const completionKey = outcome ? completionPresentationKey(outcome) : null;
    // A canonical guess receipt may clear acknowledgement while updating attempts.
    if (completionKey && completedKeysRef.current.has(completionKey)) dispatch({type: "completionAcknowledged"});
    if (outcome && completionKey && !completedKeysRef.current.has(completionKey) && !deliveriesRef.current.has(completionKey))
      deliveriesRef.current.set(completionKey, {
        completionKey, outcome, requestId: createRequestId("complete"), attempts: 0,
      });
    for (const delivery of deliveriesRef.current.values()) {
      if (delivery.timer !== undefined) continue;
      delivery.attempts += 1;
      // Register before dispatch: the same-origin bridge may acknowledge synchronously.
      delivery.timer = window.setTimeout(() => {
        delivery.timer = undefined;
        setRetrySignal((signal) => signal + 1);
      }, COMPLETION_RETRY_DELAYS[Math.min(delivery.attempts - 1, COMPLETION_RETRY_DELAYS.length - 1)]);
      postToHost({
        type: "game:completeGame",
        requestId: delivery.requestId,
        payload: {
          riddleId: delivery.outcome.riddleId,
          gameMode: delivery.outcome.gameMode,
          sessionToken: delivery.outcome.sessionToken,
        },
      });
    }
  }, [outcome, ownerKey, postToHost, retrySignal, dispatch]);

  useEffect(() => {
    /** Clears scheduled timers while preserving receipts for effect replay and reconnection. */
    const clearTimers = () => {
      for (const delivery of deliveriesRef.current.values()) {
        if (delivery.timer !== undefined) window.clearTimeout(delivery.timer);
        delivery.timer = undefined;
      }
    };
    /** A restored connection need not wait for the longest backoff to acknowledge a win. */
    const resume = () => {
      if (deliveriesRef.current.size === 0) return;
      clearTimers();
      setRetrySignal(signal => signal + 1);
    };
    window.addEventListener("online", resume);
    return () => {
      window.removeEventListener("online", resume);
      clearTimers();
    };
  }, []);

  return handleResult;
}
