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
}): (ok: boolean) => void {
  /** Completes d ids ref. */
  const completedIdsRef = useRef(new Set<string>());
  /** Provides delivery ref behavior. */
  const deliveryRef = useRef<{
    /** Stores outcome id. */
    outcomeId: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string; /** Stores attempts. */
    /** Stores attempts. */
    attempts: number; /** Stores timer. */
    /** Stores timer. */
    timer?: number;
  } | null>(null);
  /** Provides [retry signal, set retry signal] behavior. */
  const [retrySignal, setRetrySignal] = useState(0);

  /** Handles result. */
  const handleResult = useCallback(
    (ok: boolean) => {
      /** Provides delivery behavior. */
      const delivery = deliveryRef.current;
      if (!ok || !delivery) return;
      if (delivery.timer !== undefined) window.clearTimeout(delivery.timer);
      completedIdsRef.current.add(delivery.outcomeId);
      deliveryRef.current = null;
      dispatch({type: "completionAcknowledged"});
    },
    [dispatch],
  );

  useEffect(() => {
    if (!outcome || completedIdsRef.current.has(outcome.id)) return;
    /** Provides delivery behavior. */
    let delivery = deliveryRef.current;
    if (!delivery || delivery.outcomeId !== outcome.id) {
      if (delivery?.timer !== undefined) window.clearTimeout(delivery.timer);
      delivery = {outcomeId: outcome.id, requestId: createRequestId("complete"), attempts: 0};
      deliveryRef.current = delivery;
    }
    postToHost({
      type: "game:completeGame",
      requestId: delivery.requestId,
      payload: {
        riddleId: outcome.riddleId,
        gameMode: outcome.gameMode,
        sessionToken: outcome.sessionToken,
      },
    });
    delivery.attempts += 1;
    if (delivery.timer !== undefined) window.clearTimeout(delivery.timer);
    delivery.timer = window.setTimeout(
      () => setRetrySignal((signal) => signal + 1),
      COMPLETION_RETRY_DELAYS[Math.min(delivery.attempts - 1, COMPLETION_RETRY_DELAYS.length - 1)],
    );
  }, [outcome, postToHost, retrySignal]);

  useEffect(
    () => () => {
      /** Provides timer behavior. */
      const timer = deliveryRef.current?.timer;
      if (timer !== undefined) window.clearTimeout(timer);
    },
    [],
  );

  return handleResult;
}
