import type {BridgeRiddle, GameToHostMessage} from "@qwordly/core/bridge";
import type {Feedback} from "@qwordly/core/game";
import {splitGraphemes, isSinglePlayerKeyboardLetter} from "@qwordly/core/game";
import type {PendingGuessState, GameSessionState} from "./gameSessionTypes";
import {getConfirmedRiddleOutcome} from "./ConfirmedRiddleOutcome";
/** A confirmed coin action delivered after all earlier answers settle. */
export type QueuedCoinAction = Extract<
  GameToHostMessage,
  {
    /** Supported server-authoritative coin actions. */
    type: "game:requestHint" | "game:spendCoins" | "game:skipRiddle";
  }
>;
/** An exact request retained until the backend confirms or rejects it. */
export type QueuedGuess = {
  /** The message retained for safe pending-play recovery. */
  message: Extract<
    GameToHostMessage,
    {
      /** Guess-message discriminator. */ type: "game:submitGuess";
    }
  >;
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
    /** Selected slot within the unsubmitted draft. */ draftActiveSlotIndex?: number;
  }>;
  /** The queue retained for safe pending-play recovery. */
  queue: QueuedGuess[];
  /** Exact paid request waiting behind the answer queue, retained across reloads. */
  coinAction?: QueuedCoinAction;
  /** Exact speculative successor admitted while its paid Skip remains unresolved. */
  skipPreview?: {
    /** Paid Skip owning this preview. */ requestId: string;
    /** Issued predecessor session. */ sessionToken: string;
    /** Admitted speculative question. */ riddle: BridgeRiddle;
  };
  /** The draft retained for safe pending-play recovery. */
  draft: string[];
  /** Selected draft slot, optional for existing version-one journals. */
  draftActiveSlotIndex?: number;
};
/** The journal key retained for safe pending-play recovery. */
const journalKey = (scope: string) => `riddleQuest:pendingPlay:v1:${scope}`;
/** The lease key retained for safe pending-play recovery. */
const leaseKey = (scope: string) => `riddleQuest:pendingPlayLease:v1:${scope}`;
/** Retires confirmed terminal rounds or superseded drafts without losing another question’s deliveries. */
export function reconcileConfirmedPendingPlay(journal: PendingGuessJournal, riddle: BridgeRiddle): PendingGuessJournal | null {
  /** Matching all question identity fields avoids consuming another issued round. */
  const sameRound = (candidate: Pick<BridgeRiddle, "riddleId" | "sessionToken" | "gameMode">, issued: BridgeRiddle) =>
    candidate.riddleId === issued.riddleId && candidate.sessionToken === issued.sessionToken && candidate.gameMode === issued.gameMode;
  /** Completed victory can precede a later draft until the normal fanfare is dismissed. */
  const outcome = getConfirmedRiddleOutcome(riddle);
  /** Terminal gameplay proof cannot establish the outcome of a separately idempotent paid request. */
  if (outcome && sameRound(journal.riddle, riddle) && journal.coinAction && sameRound(journal.coinAction.payload, riddle)) {
    /** Keep the paid receipt and later segments; only this completed question's guesses are redundant. */
    const queue = journal.queue.filter(item => !sameRound(item.message.payload, riddle));
    return queue.length === journal.queue.length ? journal : {...journal, queue};
  }
  /** A loss retires only its exact owned root; it never promotes a successor or advances Classic. */
  if (outcome?.kind === "loss" && sameRound(journal.riddle,riddle) && journal.successors.length === 0 &&
    journal.queue.every(item => sameRound(item.message.payload,riddle)) &&
    (!journal.coinAction || sameRound(journal.coinAction.payload,riddle))) return null;
  /** Only a proven victory permits consuming a completed prefix. */
  const confirmedWin = outcome?.kind === "win" ? outcome : null;
  if (!confirmedWin && journal.riddle.gameMode === riddle.gameMode &&
    journal.queue.length === 0 && !journal.coinAction && journal.successors.length === 0 && !sameRound(journal.riddle,riddle))
    return null;
  if (!confirmedWin || !sameRound(journal.riddle, riddle)) return journal;
  // Victory and root identity are already confirmed above; only unresolved deliveries can retain the journal.
  if (!journal.successors.length && !journal.coinAction &&
    journal.queue.every(item => sameRound(item.message.payload, riddle))) return null;
  if (riddle.gameMode !== "classic" || !Number.isSafeInteger(riddle.index) || (riddle.index ?? 0) < 1 ||
    journal.riddle.index !== riddle.index || journal.successors.length === 0 || journal.successors.length > 3) return journal;
  /** Each retained segment must be a distinct, consecutive issued Classic question. */
  const segments = [journal.riddle, ...journal.successors.map(segment => segment.riddle)];
  if (segments.some((segment, index) => segment.gameMode !== "classic" || !Number.isSafeInteger(segment.index) || segment.index !== riddle.index! + index) ||
    new Set(segments.map(segment => segment.sessionToken)).size !== segments.length) return journal;
  /** Unknown or reordered deliveries cannot safely be attributed to the completed prefix. */
  const positions = journal.queue.map(item => segments.findIndex(segment => sameRound(item.message.payload, segment)));
  if (positions.some((position, index) => position < 0 || (index > 0 && position < positions[index - 1]!)) ||
    (journal.coinAction && !segments.some(segment => sameRound(journal.coinAction!.payload, segment)))) return journal;
  /** The first issued successor becomes the durable root without modifying the original journal. */
  const next = journal.successors[0]!;
  return {...journal, ...next, draftActiveSlotIndex: next.draftActiveSlotIndex,
    confirmedClassicIndex: Math.max(journal.confirmedClassicIndex, riddle.index! + 1),
    successors: journal.successors.slice(1),
    queue: journal.queue.filter((_item, index) => positions[index] !== 0),
    coinAction: journal.coinAction && sameRound(journal.coinAction.payload, riddle) ? undefined : journal.coinAction};
}
/** Keeps only valid, unsubmitted letters for the rejected root question; every dependent delivery is retired. */
export function createRejectedPlayDraft(journal: PendingGuessJournal,
  current: Pick<GameSessionState, "riddle" | "engineSnapshot" | "currentLetters" | "activeSlotIndex">): PendingGuessJournal | null {
  if (!Number.isInteger(journal.riddle.answerLength) || journal.riddle.answerLength < 1 || journal.riddle.answerLength > 7) return null;
  /** Current input is usable only while the exact rejected question remains editable. */
  const sameQuestion = current.riddle?.sessionToken === journal.riddle.sessionToken &&
    current.riddle.riddleId === journal.riddle.riddleId && current.riddle.gameMode === journal.riddle.gameMode &&
    current.engineSnapshot?.gameOver === false;
  /** Otherwise the journal's root draft is kept; input from later dependent questions is never transferred. */
  const draft = sameQuestion ? current.currentLetters : journal.draft;
  if (draft.length !== journal.riddle.answerLength || !draft.some(Boolean) || draft.some(letter =>
    typeof letter !== "string" || letter.length > 32 || (letter !== "" && splitGraphemes(letter).length !== 1))) return null;
  /** A legacy or invalid selection falls back to the reducer's first editable slot. */
  const selected = sameQuestion ? current.activeSlotIndex : journal.draftActiveSlotIndex;
  return {...journal,queue: [],successors: [],coinAction: undefined,draft: [...draft],
    draftActiveSlotIndex: selected !== undefined && Number.isInteger(selected) && selected >= 0 && selected < draft.length ? selected : undefined};
}
/** Checks whether an unknown value is a plain record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** The valid riddle retained for safe pending-play recovery. */
const validRiddle = (value: unknown): value is BridgeRiddle =>
  isRecord(value) &&
  typeof value.riddleId === "string" &&
  typeof value.sessionToken === "string" &&
  value.sessionToken.length >= 20 &&
  typeof value.text === "string" &&
  Number.isInteger(value.answerLength) &&
  (value.gameMode === "classic" || value.gameMode === "challenge");
/** Rejects malformed selections while accepting legacy journals. */
const validDraftSlot = (value: unknown, length: number): boolean =>
  value === undefined || (Number.isInteger(value) && Number(value) >= 0 && Number(value) < length);
/** The valid guess retained for safe pending-play recovery. */
const validGuess = (value: unknown): boolean =>
  isRecord(value) &&
  value.type === "game:submitGuess" &&
  typeof value.requestId === "string" &&
  isRecord(value.payload) &&
  value.payload.requestId === value.requestId &&
  typeof value.payload.riddleId === "string" &&
  typeof value.payload.sessionToken === "string" &&
  typeof value.payload.guess === "string";
/** Validates persisted paid requests without loading the bridge validator into startup. */
const validCoinAction = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    typeof value.requestId !== "string" ||
    value.requestId.length < 8 ||
    !isRecord(value.payload) ||
    typeof value.payload.riddleId !== "string" ||
    typeof value.payload.sessionToken !== "string" ||
    value.payload.sessionToken.length < 20
  )
    return false;
  if (value.type === "game:skipRiddle") return value.payload.gameMode === "classic";
  if (value.type === "game:spendCoins")
    return (
      value.payload.reason === "continue" &&
      (value.payload.gameMode === "classic" || value.payload.gameMode === "challenge") &&
      (value.payload.amount === undefined ||
        (Number.isSafeInteger(value.payload.amount) && Number(value.payload.amount) > 0))
    );
  return (
    value.type === "game:requestHint" &&
    value.payload.requestId === value.requestId &&
    (value.payload.gameMode === "classic" || value.payload.gameMode === "challenge") &&
    Array.isArray(value.payload.currentAttempt) &&
    value.payload.currentAttempt.length <= 7 &&
    value.payload.currentAttempt.every((letter: unknown) => letter === "" || isSinglePlayerKeyboardLetter(letter))
  );
};
/** The provider UID changes with account generation except on Reddit. */
export const pendingPlayScope = (uid: string, generation: number | undefined, locale: string) =>
  `${encodeURIComponent(uid)}:${generation ?? 1}:${encodeURIComponent(locale)}`;
/** Reads only a structurally valid journal for the current account and locale. */
export function readPendingGuessJournal(scope: string, storage?: PendingPlayStorage): PendingGuessJournal | null {
  try {
    /** The raw retained for safe pending-play recovery. */
    const raw = (storage ?? localStorage).getItem(journalKey(scope));
    if (!raw) return null;
    /** The value retained for safe pending-play recovery. */
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    /** The journal retained for safe pending-play recovery. */
    const journal = value as Partial<PendingGuessJournal>;
    if (
      journal.version !== 1 ||
      journal.scope !== scope ||
      !validRiddle(journal.riddle) ||
      !Number.isSafeInteger(journal.confirmedClassicIndex) ||
      !Array.isArray(journal.queue) ||
      journal.queue.length > 18 ||
      !Array.isArray(journal.successors) ||
      journal.successors.length > 3 ||
      !journal.successors.every(
        (segment) =>
          validRiddle(segment?.riddle) &&
          isRecord(segment?.base) &&
          Array.isArray(segment.draft) &&
          validDraftSlot(segment.draftActiveSlotIndex, segment.riddle.answerLength),
      ) ||
      !Array.isArray(journal.draft) ||
      !validDraftSlot(journal.draftActiveSlotIndex, journal.riddle.answerLength) ||
      !isRecord(journal.base) ||
      (journal.coinAction !== undefined && !validCoinAction(journal.coinAction)) ||
      !journal.queue.every(
        (item) => validGuess(item?.message) && Number.isSafeInteger(item?.attempts) && Array.isArray(item?.feedback),
      )
    )
      return null;
    if (journal.skipPreview !== undefined) {
      /** Optional ownership never invalidates an otherwise recoverable paid request. */
      const preview = journal.skipPreview;
      /** Paid origin may belong to a retained successor segment. */
      const origin = [journal.riddle, ...journal.successors.map(segment => segment.riddle)]
        .find(riddle => riddle.sessionToken === journal.coinAction?.payload.sessionToken);
      if (!isRecord(preview) || journal.coinAction?.type !== "game:skipRiddle" ||
        preview.requestId !== journal.coinAction.requestId || preview.sessionToken !== origin?.sessionToken ||
        !origin || origin.gameMode !== "classic" || origin.riddleId !== journal.coinAction.payload.riddleId ||
        !Number.isSafeInteger(origin.index) || !validRiddle(preview.riddle) ||
        preview.riddle.gameMode !== "classic" || preview.riddle.index !== origin.index! + 1 ||
        preview.riddle.sessionToken === origin.sessionToken) delete journal.skipPreview;
    }
    return journal as PendingGuessJournal;
  } catch {
    return null;
  }
}
/** Persists exact requests before local feedback is acknowledged. */
export function writePendingGuessJournal(journal: PendingGuessJournal, storage?: PendingPlayStorage,
  /** Only apparently unchanged drafts may reuse matching durable bytes. */ skipUnchanged = false): boolean {
  try {
    /** Reads remain scoped to the same concrete target as the attempted write. */
    const target = storage ?? localStorage;
    /** Canonical serialized bytes include requests, cursor and every buffered segment. */
    const payload = JSON.stringify(journal);
    if (skipUnchanged) {
      try {if (target.getItem(journalKey(journal.scope)) === payload) return true;}
      catch {/* A restricted reader must not disable an otherwise working writer. */}
    }
    target.setItem(journalKey(journal.scope), payload);
    return true;
  } catch {
    return false;
  }
}
/** Removes a fully reconciled or definitively rejected journal. */
export function clearPendingGuessJournal(scope: string, storage?: PendingPlayStorage): void {
  try {
    (storage ?? localStorage).removeItem(journalKey(scope));
  } catch {
    /* Restricted browser storage. */
  }
}
/** Acquires one short lease for cross-tab delivery; exact request IDs remain replay safe. */
export function acquirePendingPlayLease(
  scope: string,
  owner: string,
  nowMs = Date.now(),
  storage?: PendingPlayStorage,
): boolean {
  try {
    /** The key retained for safe pending-play recovery. */
    const key = leaseKey(scope);
    /** The raw retained for safe pending-play recovery. */
    const raw = (storage ?? localStorage).getItem(key);
    /** The lease retained for safe pending-play recovery. */
    let lease: unknown = null;
    try {lease = raw && raw.length <= 512 ? JSON.parse(raw) : null;} catch { /* Invalid bytes cannot establish another tab's delivery ownership. */ }
    if (
      typeof lease === "object" &&
      lease !== null &&
      "expiresAt" in lease &&
      typeof lease.expiresAt === "number" && Number.isSafeInteger(lease.expiresAt) &&
      lease.expiresAt > nowMs && lease.expiresAt <= nowMs + 15_000 &&
      "owner" in lease && typeof lease.owner === "string" && lease.owner.length > 0 &&
      lease.owner !== owner
    )
      return false;
    /** A renewal succeeds only when the exact new owner and deadline were persisted together. */
    const payload = JSON.stringify({owner, expiresAt: nowMs + 15_000});
    (storage ?? localStorage).setItem(key, payload);
    return (storage ?? localStorage).getItem(key) === payload;
  } catch {
    return false;
  }
}
/** Releases only the lease owned by this tab. */
export function releasePendingPlayLease(scope: string, owner: string, storage?: PendingPlayStorage): void {
  try {
    /** The key retained for safe pending-play recovery. */
    const key = leaseKey(scope);
    /** The lease retained for safe pending-play recovery. */
    const lease: unknown = JSON.parse((storage ?? localStorage).getItem(key) ?? "null");
    if (typeof lease === "object" && lease !== null && "owner" in lease && lease.owner === owner)
      (storage ?? localStorage).removeItem(key);
  } catch {
    /* Restricted browser storage. */
  }
}
/** Durable browser-storage seam; Map-backed tests use exactly the same operations. */
export type PendingPlayStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** Binds durable validation and lease semantics to one concrete storage adapter. */
export function createPendingPlayJournalStorage(storage: PendingPlayStorage) {
  return {
    read: (scope: string) => readPendingGuessJournal(scope, storage),
    write: (journal: PendingGuessJournal, skipUnchanged = false) => writePendingGuessJournal(journal, storage, skipUnchanged),
    clear: (scope: string) => clearPendingGuessJournal(scope, storage),
    persist: async (state: import("./paidSettlement").SettlementPersistence) => {
      /** Capture the admitting lifetime before optional module loading yields. */
      const owner = state[0].current, expected = state[3].current;
      if (!owner?.scope || !expected) return;
      /** Guarded retry coordination stays outside the initial resource set. */
      const {persist} = await import("./paidSettlement");
      persist(storage, state, owner as {scope: string}, expected,
        [readPendingGuessJournal, writePendingGuessJournal, acquirePendingPlayLease, releasePendingPlayLease]);
    },
    acquire: (scope: string, owner: string, now: number) => acquirePendingPlayLease(scope, owner, now, storage),
    release: (scope: string, owner: string) => releasePendingPlayLease(scope, owner, storage),
  };
}
