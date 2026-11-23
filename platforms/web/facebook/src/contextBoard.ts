import type {
  ListFacebookContextBoardRequest, ListFacebookContextBoardResponse,
  RecordFacebookContextRunRequest, RecordFacebookContextRunResponse,
} from "@riddle-quest/core/race";
import type {ContextBoardCapability} from "../../../../packages/web-game/src/platform/types";
import type {FacebookContextCoordinator} from "./contexts";

/** Authenticated callables retain validation and all board authority on the server. */
export interface FacebookContextBoardBackend {
  /** Reads an exact validated native context and game language. */
  list(input: ListFacebookContextBoardRequest): Promise<{
    /** Validated server result. */
    data: ListFacebookContextBoardResponse;
  }>;
  /** Receives only an opaque completed-run identifier, native context and game language. */
  record(input: RecordFacebookContextRunRequest): Promise<{
    /** Validated server result. */
    data: RecordFacebookContextRunResponse;
  }>;
}

/** Maps normal native solo state to absence while retaining actual delivery failures as errors. */
export function createFacebookContextBoard(
  coordinator: Pick<FacebookContextCoordinator, "ensureCurrent" | "onContextChange">,
  backend: FacebookContextBoardBackend,
): ContextBoardCapability {
  /** Only the existing validated native adapter can select a board destination. */
  const currentContext = async (signal?: AbortSignal) => {
    if (signal?.aborted) return null;
    /** A retired or failed synchronization must not masquerade as normal solo state. */
    const current = await coordinator.ensureCurrent();
    if (signal?.aborted) return null;
    if (current.status === "success") return current.value;
    if (current.status === "unavailable" && current.message === "facebook-context-unavailable") return null;
    throw new Error("facebook-context-board-unavailable");
  };
  return {
    onContextChange: callback => coordinator.onContextChange(callback),
    /** Native absence skips the read; current social state uses authenticated standings. */
    async list(locale, signal) {
      /** No authenticated board request is meaningful without a validated social destination. */
      const current = await currentContext(signal);
      // Native resolution and this continuation have separate microtasks; guard the final callable admission too.
      if (signal?.aborted) return null;
      return current ? (await backend.list({contextId: current.contextId, locale})).data : null;
    },
    /** Optional context projection never creates a score destination for solo play. */
    async record(runId, locale) {
      /** Solo completion does not fabricate a context or submit an optional board projection. */
      const current = await currentContext();
      return current ? (await backend.record({contextId: current.contextId, locale, runId})).data : null;
    },
  };
}
