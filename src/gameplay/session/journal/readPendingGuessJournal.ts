import type {BridgeRiddle} from "../../../platform/bridge/messages";
import {isSinglePlayerKeyboardLetter} from "../../input/singlePlayerKeyboard";
import type {PendingGuessJournal, PendingPlayStorage} from "./pendingGuessJournal";
import {parseDraftCheckpointRevision} from "../checkpoints/draftCheckpointRevision";

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
/** Reads only a structurally valid journal for the current account and locale. */
export function readPendingGuessJournal(scope: string, storage?: PendingPlayStorage): PendingGuessJournal | null {
  try {
    /** The raw retained for safe pending-play recovery. */
    const raw = (storage ?? (globalThis as {
      /** Web Storage when the runtime provides it. */
      localStorage?: PendingPlayStorage;
    }).localStorage as PendingPlayStorage).getItem(`riddleQuest:pendingPlay:v1:${scope}`);
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
    journal.draftRevision = parseDraftCheckpointRevision(journal.draftRevision);
    journal.base.draftRevision = parseDraftCheckpointRevision(journal.base.draftRevision);
    for (const segment of journal.successors) {
      segment.draftRevision = parseDraftCheckpointRevision(segment.draftRevision);
      segment.base.draftRevision = parseDraftCheckpointRevision(segment.base.draftRevision);
    }
    for (const riddle of [journal.riddle, ...journal.successors.map(segment => segment.riddle)]) {
      /** Optional cached hints cannot invalidate required pending deliveries. */
      const hints: unknown = riddle.revealedHints;
      if (hints !== undefined && (!Array.isArray(hints) || hints.length > riddle.answerLength || !hints.every((hint: unknown) =>
        isRecord(hint) && Number.isInteger(hint.index) && Number(hint.index) >= 0 && Number(hint.index) < riddle.answerLength &&
        typeof hint.letter === "string" && isSinglePlayerKeyboardLetter(hint.letter)))) delete riddle.revealedHints;
    }
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
