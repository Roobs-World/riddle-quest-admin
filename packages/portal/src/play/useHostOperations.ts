import {useCallback, useRef, useState} from "react";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {getHostErrorMessage, type HostOperationName} from "./hostMessageHandlers";

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
  /** Opaque account-visit token changes only when identity ownership changes. */
  owner?: unknown;
  /** Correlated result delivery function. */
  postOperation: PostOperation;
}>;

/** Small interface consumed by host orchestration and rendering. */
export type HostOperations = Readonly<{
  /** Whether global server activity currently blocks interaction. */
  activityActive: boolean;
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
export function useHostOperations({postOperation, owner}: HostOperationOptions): HostOperations {
  /** Current visit is available to stable callbacks before any asynchronous result arrives. */
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  /** Retired work cannot block a replacement account or decrement its active operation count. */
  const [activity, setActivity] = useState({owner, pending: 0});

  /** Blocks duplicate input only for the actual operation lifetime. */
  const withActivity = useCallback(async <Result>(operation: () => Promise<Result>): Promise<Result> => {
    /** Activity belongs to the visit that actually admitted this operation. */
    const admittedOwner = currentOwner.current;
    setActivity(current => currentOwner.current !== admittedOwner ? current : {
      owner: admittedOwner, pending: current.owner === admittedOwner ? current.pending + 1 : 1,
    });
    try {
      return await operation();
    } finally {
      setActivity(current => currentOwner.current !== admittedOwner || current.owner !== admittedOwner ? current :
        {...current, pending: Math.max(0, current.pending - 1)});
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
    activityActive: activity.owner === owner && activity.pending > 0,
    withActivity,
    runRace,
  };
}
