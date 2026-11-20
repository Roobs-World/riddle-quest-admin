import {LiveGuessReceiptQuerySchema, LiveGuessReceiptResultSchema, type LiveGuessReceiptQuery, type LiveGuessReceiptResult, type LiveRaceView} from "@riddle-quest/core/race";
import {liveRaceDeliveryDeadline} from "./liveRaceDeliveryDeadline";
import {liveRaceDraftBinding as binding, liveDraftReceiptMatches, parseLiveRaceDraftCheckpoint} from "./liveRaceDraftCheckpoint";
import {createRequestId} from "../../play/requestIds";
import type {LiveRaceDraft} from "./liveRaceDraft";

/** Shared retention contract remains available to existing checkpoint callers. */
export {LIVE_RACE_DRAFT_TTL_MS} from "./liveRaceDraftCheckpoint";
/** Each account has one bounded current live draft, separate from transport commands. */
export const liveRaceDraftKey = (ownerId: string) => `riddleQuest:liveRaceDraft:${encodeURIComponent(ownerId)}`;
/** Optional persistence permits deterministic denial and competing-tab verification. */
export type LiveRaceDraftStorage = {
  /** Undefined means unavailable, rather than an empty key. */ read: () => string | null | undefined;
  /** Reports whether the bytes were accepted. */ write: (value: string) => boolean;
  /** Removes the caller's verified revision. */ remove: () => boolean;
};
/** Owns observed storage bytes; competing tabs revoke writes rather than silently losing their input. */
export function createLiveRaceDraftStorage(ownerId?: string, injected?: LiveRaceDraftStorage, now = Date.now) {
  /** Distinguishes replacement writers even when their content and wall clocks are identical. */
  const writerId = createRequestId("live-draft-writer");
  /** Injected storage and browser storage share the same failure contract. */
  const storage: LiveRaceDraftStorage = injected ?? {read: () => null, write: () => false, remove: () => false};
  /** Only the observed revision may be overwritten or removed. */
  let observed: string | null | undefined;
  /** Confirmed semantic content avoids unchanged writes. */
  let content: string | null = null;
  /** Persistence starts only after an eligible authoritative receipt. */
  let initialized = false;
  /** Reads without allowing optional storage failures to interrupt gameplay. */
  const read = () => {try {return storage.read();} catch {return undefined;}};
  /** Any newer restore, changed save or cleanup supersedes a pending proof read. */
  let recoveryGeneration = 0;
  /** First canonical question establishes one exact observed storage revision. */
  const prepare = (view: LiveRaceView) => {
    recoveryGeneration++;
    if (!binding(ownerId, view)) return null;
    initialized = true;
    observed = read();
    content = null;
    return parseLiveRaceDraftCheckpoint(observed, ownerId, view, now());
  };
  /** Existing callers retain strict exact-count recovery without a server read. */
  const restore = (view: LiveRaceView): LiveRaceDraft | null => {
    /** A local locator alone cannot confirm an accepted attempt. */
    const candidate = prepare(view);
    return candidate && !candidate.query ? candidate.draft : null;
  };
  /** Resolves eligible original-request proof before publishing any initial recovered input. */
  const restoreWithReceipt = async (view: LiveRaceView,
    confirm?: (query: LiveGuessReceiptQuery) => Promise<LiveGuessReceiptResult>, signal?: AbortSignal): Promise<LiveRaceDraft | null> => {
    if (signal?.aborted) return null;
    /** One frozen revision supplies both cells and their historical locator. */
    const candidate = prepare(view), raw = observed, generation = recoveryGeneration;
    if (signal?.aborted || !candidate) return null;
    if (!candidate.query) return candidate.draft;
    if (!confirm) return null;
    try {
      /** Optional proof uses the bounded read deadline and never processes a late result. */
      const result = LiveGuessReceiptResultSchema.parse(await liveRaceDeliveryDeadline(confirm(candidate.query), true, undefined, signal));
      return result.status === "accepted" && !signal?.aborted && generation === recoveryGeneration && observed === raw && read() === raw && parseLiveRaceDraftCheckpoint(raw, ownerId, view, now())
        ? candidate.draft : null;
    } catch {return null;}
  };
  /** Unchanged receipts do not rewrite the checkpoint or extend its retention deadline. */
  const save = (view: LiveRaceView | null, draft: LiveRaceDraft, guessReceipt?: LiveGuessReceiptQuery): void => {
    /** Full canonical binding prevents stale presentation recovery. */
    const identity = binding(ownerId, view);
    if (!identity || !initialized || draft.letters.length !== view!.run!.currentRiddle!.answerLength) return;
    /** Only the submitted request for this exact canonical attempt may annotate independent input. */
    const parsedReceipt = guessReceipt ? LiveGuessReceiptQuerySchema.safeParse(guessReceipt) : null;
    /** Validation prevents an old receipt from authorizing a word consumed by a replacement attempt. */
    const receipt = parsedReceipt?.success && liveDraftReceiptMatches(parsedReceipt.data, view!, view!.run!.currentRiddle!.guessesUsed) ? parsedReceipt.data : undefined;
    /** Stable content excludes the local retention timestamp. */
    const next = JSON.stringify({version: 1, writerId, binding: identity, letters: draft.letters, activeSlotIndex: draft.activeSlotIndex, ...(receipt ? {guessReceipt: receipt} : {})});
    if (next === content) return;
    recoveryGeneration++;
    /** A competing revision revokes mutation permission before any actual write. */
    const raw = read();
    if (raw === undefined || observed === undefined && raw !== null || observed !== undefined && raw !== observed) return;
    observed = raw;
    try {
      /** One bounded record stores input without command or economy state. */
      const payload = next.slice(0, -1) + `,"savedAtMs":${now()}}`;
      if (payload.length <= 8192 && storage.write(payload)) {
        observed = payload;
        if (read() === payload) content = next;
      }
    } catch { /* Optional persistence cannot reject an input event. */ }
  };
  /** Close, terminal receipt and account retirement remove only this journey's observed bytes. */
  const clear = (): void => {
    recoveryGeneration++;
    if (!ownerId || !initialized || typeof observed !== "string" || read() !== observed) return;
    try {if (storage.remove()) {observed = null; content = null;}} catch { /* Authority still retires the seat. */ }
  };
  return {restore, restoreWithReceipt, save, clear};
}
