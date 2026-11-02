import type {Feedback, GameEngineSnapshot, ScoredGuess} from "@riddle-quest/core/game";
import type {DraftCheckpointRevision} from "./draftCheckpointRevision";

/**
 * Versioned, resumable single-player snapshot written to host-owned storage.
 *
 * @remarks
 * This is client persistence rather than an authority boundary. Opaque riddle
 * and session identifiers are sent back to the server, which validates all
 * guesses, rewards, and economy mutations. Readers must reject malformed or
 * internally inconsistent snapshots.
 */
export type SavedGame = {
  /** Optional client draft ordering; absent in older snapshots. */
  draftRevision?: DraftCheckpointRevision;
  /** Storage schema discriminator for safe future migration. */
  schemaVersion: 1;
  /** Unix epoch milliseconds when this snapshot was assembled. */
  savedAt: number;
  /** Opaque identifier of the server-issued riddle. */
  riddleId: string;
  /** Single-player mode associated with the server session. */
  gameMode: "classic" | "challenge";
  /** Opaque server session token required for authoritative operations. */
  sessionToken: string;
  /** Unsubmitted answer-row graphemes in display order. */
  currentLetters: string[];
  /** Currently focused answer slot. */
  activeSlotIndex: number;
  /** Answer indices revealed by authoritative hint responses. */
  hintRevealedIndices: number[];
  /** Previously submitted guesses with server-compatible feedback. */
  guesses: ScoredGuess[];
  /** Deterministic game-engine state needed to resume presentation. */
  engineSnapshot: GameEngineSnapshot;
  /** Indicates that the loss flow is waiting for a paid-continue decision. */
  awaitingContinue: boolean;
  /** Strongest known feedback for each keyboard letter. */
  letterStates: Record<string, Feedback>;
  /** Terminal outcome retained until its idempotent completion is acknowledged. */
  pendingOutcome?: {
    /** Client-generated id used to deduplicate local delivery attempts. */
    id: string;
    /** Presentation outcome awaiting server reconciliation. */
    kind: "win" | "loss";
    /** Riddle associated with the completion request. */
    riddleId: string;
    /** Mode associated with the completion request. */
    gameMode: "classic" | "challenge";
    /** Server session token associated with the completion request. */
    sessionToken: string;
    /** Number of guesses submitted in the completed session. */
    attempts: number;
    /** Whether the terminal guess matched the authoritative answer. */
    isCorrect: boolean;
  };
};
