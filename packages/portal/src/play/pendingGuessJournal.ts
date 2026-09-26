import type {BridgeRiddle, GameToHostMessage} from "@qwordly/core/bridge";
import type {Feedback} from "@qwordly/core/game";
import type {PendingGuessState} from "./gameSessionTypes";

/** A confirmed coin action delivered after all earlier answers settle. */
export type QueuedCoinAction = Extract<GameToHostMessage, {
  /** Supported server-authoritative coin actions. */ type: "game:requestHint" | "game:skipRiddle";
}>;

/** An exact request retained until the backend confirms or rejects it. */
export type QueuedGuess = {
  /** The message retained for safe pending-play recovery. */
  message: Extract<GameToHostMessage, {
    /** Guess-message discriminator. */ type: "game:submitGuess";
  }>;
  /** The attempts retained for safe pending-play recovery. */
  attempts: number;
  /** Provisional correctness. */
  isCorrect: boolean;
  /** Whether the attempt ends the question. */
  gameOver: boolean;
  /** Whether a paid continue would be offered. */
  canContinue: boolean;
  /** The feedback retained for safe pending-play recovery. */
  feedback: Feedback[];
};

/** Versioned client record of unconfirmed guesses for one issued question. */
export type PendingGuessJournal = {
  /** The version retained for safe pending-play recovery. */
  version: 1;
  /** The scope retained for safe pending-play recovery. */
  scope: string;
  /** The riddle retained for safe pending-play recovery. */
  riddle: BridgeRiddle;
  /** The confirmed classic index retained for safe pending-play recovery. */
  confirmedClassicIndex: number;
  /** The base retained for safe pending-play recovery. */
  base: PendingGuessState;
  /** Later issued questions entered before their predecessor confirms. */
  successors: Array<{
    /** Next issued question. */ riddle: BridgeRiddle;
    /** Last confirmed state within that question. */ base: PendingGuessState;
    /** Unsubmitted letters. */ draft: string[];
  }>;
  /** The queue retained for safe pending-play recovery. */
  queue: QueuedGuess[];
  /** Exact paid request waiting behind the answer queue, retained across reloads. */
  coinAction?: QueuedCoinAction;
  /** The draft retained for safe pending-play recovery. */
  draft: string[];
};

/** The journal key retained for safe pending-play recovery. */
const journalKey = (scope: string) => `riddleQuest:pendingPlay:v1:${scope}`;
/** The lease key retained for safe pending-play recovery. */
const leaseKey = (scope: string) => `riddleQuest:pendingPlayLease:v1:${scope}`;

/** Checks whether an unknown value is a plain record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** The valid riddle retained for safe pending-play recovery. */
const validRiddle = (value: unknown): value is BridgeRiddle => isRecord(value) &&
  typeof value.riddleId === "string" && typeof value.sessionToken === "string" &&
  value.sessionToken.length >= 20 && typeof value.text === "string" &&
  Number.isInteger(value.answerLength) && (value.gameMode === "classic" || value.gameMode === "challenge");
/** The valid guess retained for safe pending-play recovery. */
const validGuess = (value: unknown): boolean => isRecord(value) && value.type === "game:submitGuess" &&
  typeof value.requestId === "string" && isRecord(value.payload) &&
  value.payload.requestId === value.requestId &&
  typeof value.payload.riddleId === "string" && typeof value.payload.sessionToken === "string" &&
  typeof value.payload.guess === "string";

/** Validates persisted paid requests without loading the bridge validator into startup. */
const validCoinAction = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.requestId !== "string" || value.requestId.length < 8 ||
    !isRecord(value.payload) || typeof value.payload.riddleId !== "string" ||
    typeof value.payload.sessionToken !== "string" || value.payload.sessionToken.length < 20) return false;
  if (value.type === "game:skipRiddle") return value.payload.gameMode === "classic";
  return value.type === "game:requestHint" && value.payload.requestId === value.requestId &&
    (value.payload.gameMode === "classic" || value.payload.gameMode === "challenge") &&
    Array.isArray(value.payload.currentAttempt) && value.payload.currentAttempt.length <= 7 &&
    value.payload.currentAttempt.every((letter: unknown) => typeof letter === "string" && /^[a-z]?$/i.test(letter));
};

/** The provider UID changes with account generation except on Reddit. */
export const pendingPlayScope = (uid: string, generation: number | undefined, locale: string) =>
  `${encodeURIComponent(uid)}:${generation ?? 1}:${encodeURIComponent(locale)}`;

/** Reads only a structurally valid journal for the current account and locale. */
export function readPendingGuessJournal(scope: string): PendingGuessJournal | null {
  try {
    /** The raw retained for safe pending-play recovery. */
    const raw = localStorage.getItem(journalKey(scope));
    if (!raw) return null;
    /** The value retained for safe pending-play recovery. */
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    /** The journal retained for safe pending-play recovery. */
    const journal = value as Partial<PendingGuessJournal>;
    if (journal.version !== 1 || journal.scope !== scope ||
      !validRiddle(journal.riddle) ||
      !Number.isSafeInteger(journal.confirmedClassicIndex) ||
      !Array.isArray(journal.queue) || journal.queue.length > 18 ||
      !Array.isArray(journal.successors) || journal.successors.length > 2 ||
      !journal.successors.every((segment) => validRiddle(segment?.riddle) &&
        segment?.base && Array.isArray(segment.base.guesses) && Array.isArray(segment.draft)) ||
      !Array.isArray(journal.draft) || !journal.base ||
      (journal.coinAction !== undefined && !validCoinAction(journal.coinAction)) ||
      !Array.isArray(journal.base.guesses) || !Array.isArray(journal.base.currentLetters) ||
      !journal.queue.every((item) => validGuess(item?.message) &&
        Number.isSafeInteger(item?.attempts) && Array.isArray(item?.feedback))) return null;
    return journal as PendingGuessJournal;
  } catch {
    return null;
  }
}

/** Persists exact requests before local feedback is acknowledged. */
export function writePendingGuessJournal(journal: PendingGuessJournal): boolean {
  try {
    localStorage.setItem(journalKey(journal.scope), JSON.stringify(journal));
    return true;
  } catch {
    return false;
  }
}

/** Removes a fully reconciled or definitively rejected journal. */
export function clearPendingGuessJournal(scope: string): void {
  try { localStorage.removeItem(journalKey(scope)); } catch { /* Restricted browser storage. */ }
}

/** Acquires one short lease for cross-tab delivery; exact request IDs remain replay safe. */
export function acquirePendingPlayLease(scope: string, owner: string, nowMs = Date.now()): boolean {
  try {
    /** The key retained for safe pending-play recovery. */
    const key = leaseKey(scope);
    /** The raw retained for safe pending-play recovery. */
    const raw = localStorage.getItem(key);
    /** The lease retained for safe pending-play recovery. */
    const lease: unknown = raw ? JSON.parse(raw) : null;
    if (typeof lease === "object" && lease !== null &&
      "expiresAt" in lease && Number(lease.expiresAt) > nowMs &&
      "owner" in lease && lease.owner !== owner) return false;
    localStorage.setItem(key, JSON.stringify({owner, expiresAt: nowMs + 15_000}));
    /** The verified retained for safe pending-play recovery. */
    const verified: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return typeof verified === "object" && verified !== null && "owner" in verified && verified.owner === owner;
  } catch {
    return false;
  }
}

/** Releases only the lease owned by this tab. */
export function releasePendingPlayLease(scope: string, owner: string): void {
  try {
    /** The key retained for safe pending-play recovery. */
    const key = leaseKey(scope);
    /** The lease retained for safe pending-play recovery. */
    const lease: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (typeof lease === "object" && lease !== null && "owner" in lease && lease.owner === owner)
      localStorage.removeItem(key);
  } catch { /* Restricted browser storage. */ }
}
