import type {LiveRaceView} from "@qwordly/core/race";
import {observeBrowserStorage, removeBrowserStorage, writeBrowserStorage} from "../../../platform/browserStorage";
import {isSingleAnswerCell} from "../../answerCell";
import {createRequestId} from "../../requestIds";
import {reconcileLiveRaceDraft, type LiveRaceDraft} from "./liveRaceDraft";

/** Local presentation expires independently of the authoritative match clock. */
export const LIVE_RACE_DRAFT_TTL_MS = 30 * 60 * 1000;
/** Each account has one bounded current live draft, separate from transport commands. */
export const liveRaceDraftKey = (ownerId: string) => `riddleQuest:liveRaceDraft:${encodeURIComponent(ownerId)}`;
/** Optional persistence permits deterministic denial and competing-tab verification. */
export type LiveRaceDraftStorage = {
  /** Undefined means unavailable, rather than an empty key. */ read: () => string | null | undefined;
  /** Reports whether the bytes were accepted. */ write: (value: string) => boolean;
  /** Removes the caller's verified revision. */ remove: () => boolean;
};
/** Only exact authoritative question and attempt identities may recover input. */
function binding(ownerId: string | undefined, view: LiveRaceView | null, guessesUsed = view?.run?.currentRiddle?.guessesUsed): string | null {
  /** Canonical run and question define the recovery boundary. */
  const run = view?.run, riddle = run?.currentRiddle;
  return ownerId && ownerId.length <= 160 && view && run && riddle && ["racing", "countdown"].includes(view.phase)
    ? JSON.stringify([ownerId, view.ticketId, run.runId, run.locale, riddle.riddleId, riddle.position, guessesUsed]) : null;
}

/** Owns observed storage bytes; competing tabs revoke writes rather than silently losing their input. */
export function createLiveRaceDraftStorage(ownerId?: string, injected?: LiveRaceDraftStorage, now = Date.now) {
  /** Distinguishes replacement writers even when their content and wall clocks are identical. */
  const writerId = createRequestId("live-draft-writer");
  /** Account-specific key keeps providers and accounts independent. */
  const key = ownerId ? liveRaceDraftKey(ownerId) : "";
  /** Injected storage and browser storage share the same failure contract. */
  const storage = injected ?? {read: () => observeBrowserStorage("local", key),
    write: (raw: string) => writeBrowserStorage("local", key, raw), remove: () => removeBrowserStorage("local", key)};
  /** Only the observed revision may be overwritten or removed. */
  let observed: string | null | undefined;
  /** Confirmed semantic content avoids unchanged writes. */
  let content: string | null = null;
  /** Persistence starts only after an eligible authoritative receipt. */
  let initialized = false;
  /** Reads without allowing optional storage failures to interrupt gameplay. */
  const read = () => {try {return storage.read();} catch {return undefined;}};
  /** Authoritative receipt establishes ownership before any local input is restored. */
  const restore = (view: LiveRaceView): LiveRaceDraft | null => {
    /** Full canonical binding prevents stale presentation recovery. */
    const identity = binding(ownerId, view);
    if (!identity) return null;
    initialized = true;
    observed = read();
    content = null;
    if (typeof observed !== "string" || observed.length > 8192) return null;
    try {
      /** Untrusted bytes are validated before any cells reach the UI. */
      const value = JSON.parse(observed), riddle = view.run!.currentRiddle!, at = now();
      if (!value || Object.keys(value).sort().join(",") !== "activeSlotIndex,binding,letters,postSubmitInput,savedAtMs,version,writerId" ||
        value.version !== 1 || typeof value.writerId !== "string" || !value.writerId || value.writerId.length > 100 ||
        typeof value.postSubmitInput !== "boolean" ||
        value.binding !== identity && !(value.postSubmitInput && riddle.guessesUsed > 0 && value.binding === binding(ownerId, view, riddle.guessesUsed - 1)) ||
        !Number.isSafeInteger(value.savedAtMs) ||
        value.savedAtMs < 0 || value.savedAtMs > at || at - value.savedAtMs > LIVE_RACE_DRAFT_TTL_MS ||
        !Array.isArray(value.letters) || value.letters.length !== riddle.answerLength ||
        value.letters.some((letter: unknown) => letter !== "" && !isSingleAnswerCell(letter, view.run!.locale)) ||
        !Number.isInteger(value.activeSlotIndex) || value.activeSlotIndex < 0 || value.activeSlotIndex >= riddle.answerLength) return null;
      /** Restored presentation still passes canonical hint reconciliation. */
      const draft: LiveRaceDraft = {letters: value.letters.map((letter: string) => letter.normalize("NFC")), activeSlotIndex: value.activeSlotIndex, revision: 0};
      return reconcileLiveRaceDraft(draft, view, view);
    } catch {return null;}
  };
  /** Unchanged receipts do not rewrite the checkpoint or extend its retention deadline. */
  const save = (view: LiveRaceView | null, draft: LiveRaceDraft, postSubmitInput = false): void => {
    /** Full canonical binding prevents stale presentation recovery. */
    const identity = binding(ownerId, view);
    if (!identity || !initialized || draft.letters.length !== view!.run!.currentRiddle!.answerLength) return;
    /** Stable content excludes the local retention timestamp. */
    const next = JSON.stringify({version: 1, writerId, binding: identity, letters: draft.letters, activeSlotIndex: draft.activeSlotIndex, postSubmitInput});
    if (next === content) return;
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
    if (!ownerId || !initialized || typeof observed !== "string" || read() !== observed) return;
    try {if (storage.remove()) {observed = null; content = null;}} catch { /* Authority still retires the seat. */ }
  };
  return {restore, save, clear};
}
