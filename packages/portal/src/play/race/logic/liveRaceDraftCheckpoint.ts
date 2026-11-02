import {LiveGuessReceiptQuerySchema, type LiveGuessReceiptQuery, type LiveRaceView} from "@riddle-quest/core/race";
import {isSingleAnswerCell} from "@riddle-quest/hosted/play/answerCell";
import {reconcileLiveRaceDraft, type LiveRaceDraft} from "./liveRaceDraft";

/** Local presentation expires independently of the authoritative match clock. */
export const LIVE_RACE_DRAFT_TTL_MS = 30 * 60 * 1000;
/** Exact canonical question identity includes its accepted attempt count. */
export function liveRaceDraftBinding(ownerId: string | undefined, view: LiveRaceView | null, guessesUsed = view?.run?.currentRiddle?.guessesUsed): string | null {
  /** Canonical run and question define the recovery boundary. */
  const run = view?.run, riddle = run?.currentRiddle;
  return ownerId && ownerId.length <= 160 && view && run && riddle && ["racing", "countdown"].includes(view.phase)
    ? JSON.stringify([ownerId, view.ticketId, run.runId, run.locale, riddle.riddleId, riddle.position, guessesUsed]) : null;
}
/** Receipt locator must identify the checkpoint's question and original canonical attempt. */
export function liveDraftReceiptMatches(query: LiveGuessReceiptQuery, view: LiveRaceView, guessesUsed: number): boolean {
  /** Submitted word is deliberately absent from this locator. */
  const riddle = view.run?.currentRiddle;
  return Boolean(riddle && query.ticketId === view.ticketId && query.riddleId === riddle.riddleId &&
    query.position === riddle.position && query.guessesUsedBefore === guessesUsed);
}
/** Parses bounded local presentation without treating a locator as proof of acceptance. */
export function parseLiveRaceDraftCheckpoint(raw: string | null | undefined, ownerId: string | undefined, view: LiveRaceView, at: number): {
  /** Validated cells still require canonical hint reconciliation. */ draft: LiveRaceDraft;
  /** Only a one-attempt mismatch requires authenticated proof. */ query: LiveGuessReceiptQuery | null;
} | null {
  if (typeof raw !== "string" || raw.length > 8192 || !liveRaceDraftBinding(ownerId, view)) return null;
  try {
    /** Untrusted bytes cannot carry commands, words to replay or unknown recovery markers. */
    const value = JSON.parse(raw), riddle = view.run!.currentRiddle!;
    /** Legacy records remain valid for exact-count recovery. */
    const hasReceipt = value && Object.hasOwn(value, "guessReceipt"), fields = Object.keys(value ?? {}).sort().join(",");
    if (!value || fields !== (hasReceipt ? "activeSlotIndex,binding,guessReceipt,letters,savedAtMs,version,writerId" : "activeSlotIndex,binding,letters,savedAtMs,version,writerId") ||
      value.version !== 1 || typeof value.writerId !== "string" || !value.writerId || value.writerId.length > 100 ||
      !Number.isSafeInteger(value.savedAtMs) || value.savedAtMs < 0 || value.savedAtMs > at || at - value.savedAtMs > LIVE_RACE_DRAFT_TTL_MS ||
      !Array.isArray(value.letters) || value.letters.length !== riddle.answerLength ||
      value.letters.some((letter: unknown) => letter !== "" && !isSingleAnswerCell(letter, view.run!.locale)) ||
      !Number.isInteger(value.activeSlotIndex) || value.activeSlotIndex < 0 || value.activeSlotIndex >= riddle.answerLength) return null;
    /** Only an exact binding or one canonical attempt advance can be considered. */
    const exact = value.binding === liveRaceDraftBinding(ownerId, view), before = exact ? riddle.guessesUsed : riddle.guessesUsed - 1;
    if (!exact && (before < 0 || value.binding !== liveRaceDraftBinding(ownerId, view, before))) return null;
    /** Strict receipt parsing rejects guessed words, accounts and mismatched original attempt counts. */
    const receipt = hasReceipt ? LiveGuessReceiptQuerySchema.safeParse(value.guessReceipt) : null;
    if (hasReceipt && (!receipt?.success || !liveDraftReceiptMatches(receipt.data, view, before))) return null;
    if (!exact && !receipt?.success) return null;
    /** Normalized cells and hint locks remain presentation, never authoritative guess history. */
    const draft: LiveRaceDraft = {letters: value.letters.map((letter: string) => letter.normalize("NFC")), activeSlotIndex: value.activeSlotIndex, revision: 0, recoveredAtGuessesUsed: riddle.guessesUsed};
    return {draft: reconcileLiveRaceDraft(draft, view, view), query: !exact && receipt?.success ? receipt.data : null};
  } catch {return null;}
}
