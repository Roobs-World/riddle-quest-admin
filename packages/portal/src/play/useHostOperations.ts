import {useCallback, useState} from "react";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {getHostErrorMessage, type HostOperationName} from "./hostMessageHandlers";

/** Minimum duration that prevents server activity from flashing on screen. */
const MINIMUM_ACTIVITY_VISIBILITY_MS = 180;

/** Duration after which a race operation is reported as slow. */
const SLOW_RACE_OPERATION_MS = 2_000;

/** Delivers one correlated operation result to the game. */
type PostOperation = (
  /** Correlation identifier supplied by the game. */
  requestId: string | undefined,
  /** Stable operation name. */
  operation: HostOperationName,
  /** Whether the operation succeeded. */
  ok: boolean,
  /** Optional successful result. */
  data?: unknown,
  /** Optional safe error message. */
  error?: string,
) => void;

/** Configuration owned by the host-operation module. */
type HostOperationOptions = Readonly<{
  /** Whether the release target currently blocks external interaction. */
  externalInteractionBlocked: boolean;
  /** Whether the first playable riddle has loaded. */
  startupComplete: boolean;
  /** Correlated result delivery function. */
  postOperation: PostOperation;
}>;

/** Small interface consumed by host orchestration and rendering. */
export type HostOperations = Readonly<{
  /** Whether interaction must remain blocked. */
  interactionBlocked: boolean;
  /** Runs an operation while maintaining global server-activity state. */
  withActivity: <Result>(operation: () => Promise<Result>) => Promise<Result>;
  /** Runs a multiplayer operation with correlated delivery and latency telemetry. */
  runRace: (
    requestId: string | undefined,
    operation: HostOperationName,
    action: () => Promise<unknown>,
  ) => Promise<void>;
}>;

/** Owns server activity accounting and multiplayer operation delivery. */
export function useHostOperations({
  externalInteractionBlocked,
  startupComplete,
  postOperation,
}: HostOperationOptions): HostOperations {
  /** Number of global server operations whose activity window remains open. */
  const [pendingOperations, setPendingOperations] = useState(0);

  /** Runs an operation while maintaining non-flashing activity state. */
  const withActivity = useCallback(async <Result>(operation: () => Promise<Result>): Promise<Result> => {
    /** Wall-clock start used only for minimum UI visibility. */
    const startedAt = Date.now();
    setPendingOperations((current) => current + 1);
    try {
      return await operation();
    } finally {
      /** Remaining activity-display duration. */
      const remainingTime = Math.max(0, MINIMUM_ACTIVITY_VISIBILITY_MS - (Date.now() - startedAt));
      window.setTimeout(() => {
        setPendingOperations((current) => Math.max(0, current - 1));
      }, remainingTime);
    }
  }, []);

  /** Runs a race operation without applying the global blocking overlay. */
  const runRace = useCallback(
    async (requestId: string | undefined, operation: HostOperationName, action: () => Promise<unknown>) => {
      /** Monotonic start time used for latency telemetry. */
      const startedAt = performance.now();
      try {
        postOperation(requestId, operation, true, await action());
        /** Rounded operation duration. */
        const durationMs = Math.round(performance.now() - startedAt);
        /** Severity selected from the stable slow-operation threshold. */
        const report = durationMs >= SLOW_RACE_OPERATION_MS ? console.warn : console.info;
        report("[riddle-quest-race-latency]", operation, {
          ok: true,
          durationMs,
          slow: durationMs >= SLOW_RACE_OPERATION_MS,
        });
      } catch (error) {
        captureBrowserException(error, {component: "play_host", operation});
        postOperation(requestId, operation, false, undefined, getHostErrorMessage(error));
        console.warn("[riddle-quest-race-latency]", operation, {
          ok: false,
          durationMs: Math.round(performance.now() - startedAt),
        });
      }
    },
    [postOperation],
  );

  return {
    interactionBlocked: pendingOperations > 0 || externalInteractionBlocked || !startupComplete,
    withActivity,
    runRace,
  };
}
