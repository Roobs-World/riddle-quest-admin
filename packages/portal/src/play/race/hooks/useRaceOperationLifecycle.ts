import {useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {createRequestId} from "../../requestIds";
import {raceOperationRequiresReceipt, type RaceOperation} from "../logic/raceOperations";

/** Minimum answer-loader duration used to avoid a distracting visual flash. */
const RACE_GUESS_LOADER_MIN_VISIBLE_MS = 180;

/** Describes race operation lifecycle options. */
export type RaceOperationLifecycleOptions = {
  /** Stores post to host. */
  postToHost: (message: GameToHostMessage) => void;
  /** Stores set error. */
  setError: Dispatch<SetStateAction<string | null>>;
};

/** Owns request correlation and the loader lifecycle shared by race operations. */
export function useRaceOperationLifecycle({postToHost, setError}: RaceOperationLifecycleOptions) {
  const [pending, setPending] = useState<RaceOperation | null>(null);
  const [raceGuessLoading, setRaceGuessLoading] = useState(false);
  const expectedRequestRef = useRef<string | null>(null);
  const loadingStartedAtRef = useRef(0);
  const loadingTimerRef = useRef<number | undefined>(undefined);
  const loadingActiveRef = useRef(false);
  const awaitingOutcomeRef = useRef(false);

  /** Sends one correlated operation and injects receipts for server mutations. */
  const send = useCallback(
    (operation: RaceOperation, type: GameToHostMessage["type"], payload: Record<string, unknown>) => {
      const requestId = createRequestId(operation);
      expectedRequestRef.current = requestId;
      setPending(operation);
      if (operation === "raceGuess") {
        if (loadingTimerRef.current !== undefined) {
          window.clearTimeout(loadingTimerRef.current);
          loadingTimerRef.current = undefined;
        }
        loadingStartedAtRef.current = performance.now();
        loadingActiveRef.current = true;
        awaitingOutcomeRef.current = false;
        setRaceGuessLoading(true);
      }
      setError(null);
      postToHost({
        type,
        requestId,
        payload: raceOperationRequiresReceipt(operation) ? {...payload, requestId} : payload,
      } as GameToHostMessage);
    },
    [postToHost, setError],
  );

  /** Ends the current answer loader after its minimum visible duration. */
  const finishRaceGuessLoading = useCallback(() => {
    const elapsedMs = performance.now() - loadingStartedAtRef.current;
    const remainingMs = Math.max(0, RACE_GUESS_LOADER_MIN_VISIBLE_MS - elapsedMs);
    loadingTimerRef.current = window.setTimeout(() => {
      loadingActiveRef.current = false;
      awaitingOutcomeRef.current = false;
      setRaceGuessLoading(false);
      loadingTimerRef.current = undefined;
    }, remainingMs);
  }, []);

  /** Clears pending state and hands completed guesses over to outcome loading. */
  const finishOperation = useCallback((operation: RaceOperation) => {
    setPending((current) => current === operation ? null : current);
    if (operation === "raceGuess" && !awaitingOutcomeRef.current) {
      finishRaceGuessLoading();
    } else if (operation === "raceOutcome" && loadingActiveRef.current) {
      finishRaceGuessLoading();
    }
  }, [finishRaceGuessLoading]);

  const setRaceGuessAwaitingOutcome = useCallback((awaiting: boolean) => {
    awaitingOutcomeRef.current = awaiting;
  }, []);

  useEffect(() => () => {
    if (loadingTimerRef.current !== undefined) window.clearTimeout(loadingTimerRef.current);
  }, []);

  return {
    expectedRequestRef,
    finishOperation,
    pending,
    raceGuessLoading,
    send,
    setRaceGuessAwaitingOutcome,
  };
}
