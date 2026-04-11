/**
 * @fileoverview Lightweight game-session controller for shared async loading state.
 */
import { useCallback, useState } from "react";

/**
 * Public controller contract for server-backed game operations.
 */
export interface GameSessionController {
  /** True while at least one server-backed action is in flight. */
  isLoading: boolean;
  /** Runs work while automatically tracking in-flight request count. */
  runWithServerLoading: <T>(work: () => Promise<T> | T) => Promise<T>;
}

/**
 * Provides shared loading orchestration for screen-level gameplay flows.
 *
 * @returns Loading state plus a helper that wraps async/sync work.
 */
export const useGameSessionController = (): GameSessionController => {
  const [activeServerRequests, setActiveServerRequests] = useState(0);

  const runWithServerLoading = useCallback(async <T,>(work: () => Promise<T> | T) => {
    setActiveServerRequests((count) => count + 1);
    try {
      return await Promise.resolve(work());
    } finally {
      setActiveServerRequests((count) => Math.max(0, count - 1));
    }
  }, []);

  return {
    isLoading: activeServerRequests > 0,
    runWithServerLoading,
  };
};

export default useGameSessionController;
