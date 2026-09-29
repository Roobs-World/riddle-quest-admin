import {useCallback, useEffect, useRef, useState} from "react";
import type {Dispatch} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import type {GameSessionAction, GameSessionState} from "../../gameSessionTypes";
import {createRequestId} from "../../requestIds";

/** Delays used for bounded-backoff completion delivery. */
const COMPLETION_RETRY_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

/** Delivers one terminal outcome until its idempotent backend acknowledgement arrives. */
export function useCompletionDelivery({
  outcome,
  dispatch,
  postToHost,
}: {
  /** Unacknowledged authoritative terminal outcome. */ outcome: GameSessionState["lastOutcome"];
  /** Game-session reducer dispatcher. */ dispatch: Dispatch<GameSessionAction>;
  /** Sends a validated command to the host. */ postToHost: (message: GameToHostMessage) => void;
}): (ok: boolean, requestId?: string) => boolean {
  /** Completes d ids ref. */
  const completedIdsRef = useRef(new Set<string>());
  /** Provides delivery ref behavior. */
  const deliveriesRef = useRef(new Map<string, {
    /** Stores outcome id. */
    outcomeId: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string; /** Stores attempts. */
    /** Stores attempts. */
    attempts: number; /** Stores outcome. */
    /** Stores outcome. */
    outcome: NonNullable<GameSessionState["lastOutcome"]>; /** Stores timer. */
    /** Stores timer. */
    timer?: number;
  }>());
  /** Provides current outcome ref behavior. */
  const currentOutcomeRef = useRef(outcome);
  currentOutcomeRef.current = outcome;
  /** Provides [retry signal, set retry signal] behavior. */
  const [retrySignal, setRetrySignal] = useState(0);

  /** Handles result. */
  const handleResult = useCallback(
    (ok: boolean, requestId?: string): boolean => {
      if (!ok || !requestId) return false;
      /** Provides delivery behavior. */
      const delivery = [...deliveriesRef.current.values()].find((entry) => entry.requestId === requestId);
      if (!delivery) return false;
      if (delivery.timer !== undefined) window.clearTimeout(delivery.timer);
      completedIdsRef.current.add(delivery.outcomeId);
      deliveriesRef.current.delete(delivery.outcomeId);
      /** Indicates whether is current. */
      const isCurrent = currentOutcomeRef.current?.id === delivery.outcomeId;
      if (isCurrent) dispatch({type: "completionAcknowledged"});
      return isCurrent;
    },
    [dispatch],
  );

  useEffect(() => {
    if (outcome && !completedIdsRef.current.has(outcome.id) && !deliveriesRef.current.has(outcome.id))
      deliveriesRef.current.set(outcome.id, {
        outcomeId: outcome.id, outcome, requestId: createRequestId("complete"), attempts: 0,
      });
    for (const delivery of deliveriesRef.current.values()) {
      if (delivery.timer !== undefined) continue;
      postToHost({
        type: "game:completeGame",
        requestId: delivery.requestId,
        payload: {
          riddleId: delivery.outcome.riddleId,
          gameMode: delivery.outcome.gameMode,
          sessionToken: delivery.outcome.sessionToken,
        },
      });
      delivery.attempts += 1;
      delivery.timer = window.setTimeout(() => {
        delivery.timer = undefined;
        setRetrySignal((signal) => signal + 1);
      }, COMPLETION_RETRY_DELAYS[Math.min(delivery.attempts - 1, COMPLETION_RETRY_DELAYS.length - 1)]);
    }
  }, [outcome, postToHost, retrySignal]);

  useEffect(
    () => () => {
      for (const delivery of deliveriesRef.current.values())
        if (delivery.timer !== undefined) window.clearTimeout(delivery.timer);
    },
    [],
  );

  return handleResult;
}
