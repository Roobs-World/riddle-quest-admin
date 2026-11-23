import type {PendingPlayStorage} from "./pendingPlayAdapters";
export type {PendingPlayStorage} from "./pendingPlayAdapters";
import type {BridgeRiddle, GameToHostMessage} from "../../../platform/bridge/messages";
import {type Feedback} from "../../contracts/scoring";
import {splitGraphemes} from "../../input/graphemes";
import type {PendingGuessState, GameSessionState} from "../gameSessionTypes";
import {getConfirmedRiddleOutcome} from "../completion/ConfirmedRiddleOutcome";
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
  /** Optional ordering shared with the matching provider checkpoint. */
  draftRevision?: import("../checkpoints/draftCheckpointRevision").DraftCheckpointRevision;
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
    /** Ordering belongs to this independently issued successor. */
    draftRevision?: import("../checkpoints/draftCheckpointRevision").DraftCheckpointRevision;
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
  return {...journal, ...next, draftActiveSlotIndex: next.draftActiveSlotIndex, draftRevision: next.draftRevision,
    confirmedClassicIndex: Math.max(journal.confirmedClassicIndex, riddle.index! + 1),
    successors: journal.successors.slice(1),
    queue: journal.queue.filter((_item, index) => positions[index] !== 0),
    coinAction: journal.coinAction && sameRound(journal.coinAction.payload, riddle) ? undefined : journal.coinAction};
}
/** Keeps only valid, unsubmitted letters for the rejected root question; every dependent delivery is retired. */
export function createRejectedPlayDraft(journal: PendingGuessJournal,
  current: Pick<GameSessionState, "riddle" | "engineSnapshot" | "currentLetters" | "activeSlotIndex"> &
    Partial<Pick<GameSessionState, "draftRevision">>): PendingGuessJournal | null {
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
    draftRevision: sameQuestion ? current.draftRevision : journal.draftRevision,
    draftActiveSlotIndex: selected !== undefined && Number.isInteger(selected) && selected >= 0 && selected < draft.length ? selected : undefined};
}
/** The provider UID changes with account generation except on Reddit. */
export const pendingPlayScope = (uid: string, generation: number | undefined, locale: string) =>
  `${encodeURIComponent(uid)}:${generation ?? 1}:${encodeURIComponent(locale)}`;
/** Persists exact requests before local feedback is acknowledged. */
export function writePendingGuessJournal(journal: PendingGuessJournal, storage?: PendingPlayStorage,
  /** Only apparently unchanged drafts may reuse matching durable bytes. */ skipUnchanged = false): boolean {
  try {
    /** Reads remain scoped to the same concrete target as the attempted write. */
    const target = storage ?? browserStorage();
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
    (storage ?? browserStorage()).removeItem(journalKey(scope));
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
    const raw = (storage ?? browserStorage()).getItem(key);
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
    (storage ?? browserStorage()).setItem(key, payload);
    return (storage ?? browserStorage()).getItem(key) === payload;
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
    const lease: unknown = JSON.parse((storage ?? browserStorage()).getItem(key) ?? "null");
    if (typeof lease === "object" && lease !== null && "owner" in lease && lease.owner === owner)
      (storage ?? browserStorage()).removeItem(key);
  } catch {
    /* Restricted browser storage. */
  }
}
/** Durable browser-storage seam; Map-backed tests use exactly the same operations. */
/** Browser-global storage used when a caller passes none; absent elsewhere so the guarded callers report unavailability. */
const browserStorage = (): PendingPlayStorage => (globalThis as {
  /** Web Storage when the runtime provides it. */
  localStorage?: PendingPlayStorage;
}).localStorage as PendingPlayStorage;
/** Binds durable validation and lease semantics to one concrete storage adapter. */
export function createPendingPlayRecoveryStorage(storage: PendingPlayStorage) {
  return {
    /** Each committed gameplay owner retains its own immutable predecessor. */
    writer: async (owner: string, now: () => number, owns: (scope: string) => boolean, observed?: Map<string, string | null>) => {
      /** Storage ownership code loads alongside the first playable frame. */
      const [{createJournalWriter}, {readPendingGuessJournal}] = await Promise.all([
        import("./journalWriter"), import("./readPendingGuessJournal")]);
      return createJournalWriter({storage, owner, now, owns, observed, operations:
        [readPendingGuessJournal, writePendingGuessJournal, acquirePendingPlayLease, releasePendingPlayLease]});
    },
    persist: async (state: import("./paidSettlement").SettlementPersistence) => {
      /** Capture the admitting lifetime before optional module loading yields. */
      const owner = state[0].current, expected = state[3].current;
      if (!owner?.scope || !expected) return;
      /** Guarded retry coordination stays outside the initial resource set. */
      const [{persist}, {readPendingGuessJournal}] = await Promise.all([
        import("./paidSettlement"), import("./readPendingGuessJournal")]);
      persist(storage, state, owner as {
          /** Captured admission has already established a non-null scope. */
          scope: string;
        }, expected,
        [readPendingGuessJournal, writePendingGuessJournal, acquirePendingPlayLease, releasePendingPlayLease]);
    },
    acquire: (scope: string, owner: string, now: number) => acquirePendingPlayLease(scope, owner, now, storage),
    release: (scope: string, owner: string) => releasePendingPlayLease(scope, owner, storage),
  };
}


/** A paid Skip owns only the next Classic index while its origin or optional preview remains current. */
export const ownsSkipSuccessor = (origin: BridgeRiddle, target: BridgeRiddle, current: BridgeRiddle | null) =>
  origin.gameMode === "classic" && origin.index !== undefined && target.gameMode === "classic" &&
  target.index === origin.index + 1 && target.sessionToken !== origin.sessionToken &&
  Boolean(current && current.gameMode === "classic" &&
    (current.sessionToken === origin.sessionToken || current.index === origin.index + 1));

/** Captures only fields needed to restore one issued question. */
export const capturePendingBase = (state: GameSessionState): PendingGuessState => ({
  draftRevision: state.draftRevision,
  currentLetters: [...state.currentLetters],
  activeSlotIndex: state.activeSlotIndex,
  guesses: [...state.guesses],
  engineSnapshot: state.engineSnapshot,
  modal: state.modal,
  lastOutcome: state.lastOutcome,
  completionAcknowledged: state.completionAcknowledged,
  letterStates: {...state.letterStates},
  profile: state.profile,
  lastRewards: state.lastRewards,
  optimisticAchievementIds: [...state.optimisticAchievementIds],
});
/** Finds the checkpoint for an issued session retained in the journal. */
export const findSegment = (journal: PendingGuessJournal, sessionToken: string) =>
  journal.riddle.sessionToken === sessionToken
    ? {riddle: journal.riddle, base: journal.base, draft: journal.draft, draftActiveSlotIndex: journal.draftActiveSlotIndex, draftRevision: journal.draftRevision, first: true as const}
    : journal.successors.find((segment) => segment.riddle.sessionToken === sessionToken);
