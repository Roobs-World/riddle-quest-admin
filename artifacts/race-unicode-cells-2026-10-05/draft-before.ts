import {RACE_DECK_SIZE, RACE_MAX_GUESSES_PER_RIDDLE, RaceLocaleSchema, RaceRunIdRequestSchema, type RaceRunView} from "@qwordly/core/race";
import {MAX_RIDDLE_ANSWER_CHARACTERS, splitGraphemes} from "@qwordly/core/game";
import {safeBrowserStorageSet, safeBrowserStorageRemove} from "../../playerPreferences";
import {observeBrowserStorage} from "../../../platform/browserStorage";
import type {RaceSessionState} from "../RaceSession.types";
import {findFirstEditableRaceSlot} from "./racePresentation";
import {isRaceSlotEditable} from "./raceInput";
import {estimatedRaceServerNow} from "./raceCountdown";

/** One bounded presentation record, separate from authoritative run and command hints. */
export const RACE_DRAFT_KEY = "riddleQuest:raceDraft";
/** Local input is accepted for thirty minutes; server lifecycle remains authoritative. */
export const RACE_DRAFT_TTL_MS = 30 * 60 * 1000;
/** Optional raw storage supports exact-observation checks and deterministic failure tests. */
export type RaceDraftStorage = {
  /** Observes serialized bytes, null for an empty key, or undefined when unavailable. */ read: () => string | null | undefined;
  /** Replaces the single bounded draft. */ write: (value: string) => void;
  /** Removes only a caller-verified observed record. */ remove: () => void;
};
/** Only player-authored input and its question binding may be serialized. */
type DraftRecord = {
  /** Strict presentation format. */ version: 1;
  /** Account owning this input. */ ownerId: string;
  /** Server-issued run identifier. */ runId: string;
  /** Confirmed content language. */ locale: RaceRunView["locale"];
  /** Exact question content identity. */ riddleId: string;
  /** Position distinguishes repeated content within a run. */ position: number;
  /** Confirmed guess version detects a submitted word committed before reload. */ guessesUsed: number;
  /** Unconfirmed same-question guess must not reappear as unsent input after commit. */ pendingGuess: boolean;
  /** Player input by answer slot, without feedback or answers. */ letters: string[];
  /** Requested editable selection. */ activeSlotIndex: number;
  /** Local retention clock, never race timing. */ savedAtMs: number;
};
/** Allowed fields exclude snapshots, solutions, history, economy and arbitrary metadata. */
const fields = ["version", "ownerId", "runId", "locale", "riddleId", "position", "guessesUsed", "pendingGuess", "letters", "activeSlotIndex", "savedAtMs"];
/** Strictly parses bounded input without treating browser data as gameplay authority. */
const parse = (raw: string | null | undefined): DraftRecord | null => {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  try {
    /** Untrusted serialized presentation record. */
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Object.keys(value).length !== fields.length ||
      Object.keys(value).some(key => !fields.includes(key)) || value.version !== 1 ||
      typeof value.ownerId !== "string" || !value.ownerId.trim() || value.ownerId.length > 160 ||
      !RaceRunIdRequestSchema.safeParse({runId: value.runId}).success || !RaceRunIdRequestSchema.safeParse({runId: value.riddleId}).success ||
      !RaceLocaleSchema.safeParse(value.locale).success || !Number.isInteger(value.position) || value.position < 0 || value.position >= RACE_DECK_SIZE ||
      !Number.isInteger(value.guessesUsed) || value.guessesUsed < 0 || value.guessesUsed > RACE_MAX_GUESSES_PER_RIDDLE || typeof value.pendingGuess !== "boolean" ||
      !Array.isArray(value.letters) || !value.letters.length || value.letters.length > MAX_RIDDLE_ANSWER_CHARACTERS ||
      value.letters.some((letter: unknown) => typeof letter !== "string" || letter.length > 64 || letter !== "" && (!letter.trim() || splitGraphemes(letter.normalize("NFC")).length !== 1)) ||
      !Number.isInteger(value.activeSlotIndex) || value.activeSlotIndex < 0 || value.activeSlotIndex >= value.letters.length ||
      !Number.isSafeInteger(value.savedAtMs) || value.savedAtMs < 0 || value.savedAtMs > Number.MAX_SAFE_INTEGER - RACE_DRAFT_TTL_MS) return null;
    return {...value, letters: value.letters.map((letter: string) => letter.normalize("NFC"))};
  } catch {return null;}
};
/** Browser restrictions never interrupt canonical race acceptance. */
const browser: RaceDraftStorage = {read: () => observeBrowserStorage("local", RACE_DRAFT_KEY),
  write: value => safeBrowserStorageSet("local", RACE_DRAFT_KEY, value), remove: () => safeBrowserStorageRemove("local", RACE_DRAFT_KEY)};
/** Keeps reload input owned, bounded and independent of scoring and transport. */
export class RaceDrafts {
  /** Exact account/run/language whose storage revision this session observed. */
  private binding: string | null = null;
  /** A different tab's write revokes this session's overwrite permission. */
  private observed: string | null = null;
  /** Avoids synchronous storage writes on unchanged render and clock transitions. */
  private content: string | null = null;
  /** Failed optional writes retry at most once per second of the private monotonic clock. */
  private retryAtMs = -Infinity;
  /** Exact attempted write can be confirmed later without reclaiming a newer tab's value. */
  private pendingWrite: {
    /** Serialized bytes submitted by this lifetime. */ raw: string;
    /** Semantic input corresponding to those bytes. */ content: string;
    /** Changed journeys cannot adopt an older write. */ current: () => boolean;
  } | null = null;
  /** Terminal cleanup retains exact bytes and the confirming account lifetime, never run authority. */
  private cleanup: {
    /** Exact observed or attempted values eligible for terminal removal. */ raws: string[];
    /** Terminal authority's lifetime must remain active. */ current: () => boolean;
    /** Failed removals retry at most once per monotonic second. */ retryAtMs: number;
  } | null = null;
  /** Optional raw storage adapter retains its method receivers. */
  private readonly storage: RaceDraftStorage;
  /** Accepts storage without exposing authoritative state to it. */
  constructor(storage: RaceDraftStorage = browser) {this.storage = storage;}
  /** Disposal drops memory only so a subsequent mount can resume unsent input. */
  reset(): void {this.binding = null; this.observed = null; this.content = null; this.retryAtMs = -Infinity; this.cleanup = null; this.pendingWrite = null;}
  /** Broken storage behaves as an unavailable optional cache. */
  private read(): string | null | undefined {try {return this.storage.read();} catch {return undefined;}}
  /** Captures one storage revision for a new confirmed run without reclaiming newer tab edits. */
  private bind(ownerId: string | undefined, run: RaceRunView, current: () => boolean): boolean {
    if (!ownerId) return false;
    /** Private canonical identity determines the storage lifetime. */
    const binding = JSON.stringify([ownerId, run.runId, run.locale]);
    if (this.binding === binding) return current();
    /** Storage callbacks may synchronously replace the account. */
    const observed = this.read();
    if (!current() || observed === undefined) return false;
    this.binding = binding; this.observed = observed; this.content = null; this.retryAtMs = -Infinity; this.cleanup = null; this.pendingWrite = null;
    return true;
  }
  /** Restores input only after the requested canonical run and current puzzle were validated. */
  restore(ownerId: string | undefined, run: RaceRunView, wallNow: () => number, current: () => boolean): Pick<RaceSessionState, "currentLetters" | "activeSlotIndex"> | undefined {
    if (!this.bind(ownerId, run, current) || run.status !== "active" || !run.currentRiddle) return;
    try {
      /** Local presentation data cannot supply server facts. */
      const record = parse(this.observed), riddle = run.currentRiddle, now = wallNow();
      if (!current() || !record || !Number.isSafeInteger(now) || record.savedAtMs > now || now >= record.savedAtMs + RACE_DRAFT_TTL_MS ||
        record.ownerId !== ownerId || record.runId !== run.runId || record.locale !== run.locale ||
        record.riddleId !== riddle.riddleId || record.position !== riddle.position || record.letters.length !== riddle.answerLength ||
        record.guessesUsed > riddle.guessesUsed || record.pendingGuess && record.guessesUsed < riddle.guessesUsed) return;
      /** Remember only semantic content; an unchanged reload does not extend retention. */
      const {savedAtMs: _savedAtMs, ...content} = record;
      this.content = JSON.stringify(content);
      /** Server hints always replace their own draft positions. */
      const currentLetters = [...record.letters];
      for (const reveal of riddle.revealedLetters) currentLetters[reveal.index] = reveal.letter;
      return {currentLetters, activeSlotIndex: isRaceSlotEditable(riddle, record.activeSlotIndex) ? record.activeSlotIndex : findFirstEditableRaceSlot(riddle)};
    } catch {return undefined;}
  }
  /** A later successful read may confirm only this live journey's exact attempted write. */
  private confirmWrite(raw: string | null): void {
    /** Candidate bytes are never authority or a permission to replace other values. */
    const pending = this.pendingWrite;
    if (!pending) return;
    if (!pending.current()) {this.pendingWrite = null; return;}
    if (raw === pending.raw) {
      this.observed = raw; this.content = pending.content; this.retryAtMs = -Infinity; this.pendingWrite = null;
    }
  }
  /** Retries only terminal-authorized cleanup while its captured session remains current. */
  retryCleanup(nowMs: number): void {
    /** Cleanup never outlives disposal, account changes or a replacement journey. */
    const cleanup = this.cleanup;
    if (!cleanup) return;
    if (!cleanup.current()) {this.cleanup = null; return;}
    if (!Number.isFinite(nowMs) || nowMs < cleanup.retryAtMs) return;
    cleanup.retryAtMs = nowMs + 1000;
    try {
      /** A read failure remains recoverable; changed bytes revoke deletion permission. */
      const raw = this.read();
      if (!cleanup.current() || raw === undefined) return;
      if (typeof raw !== "string" || !cleanup.raws.includes(raw)) {if (this.cleanup === cleanup) this.cleanup = null; return;}
      /** Recheck immediately before removal in case another tab replaced the first observation. */
      const checked = this.read();
      if (!cleanup.current() || checked === undefined) return;
      if (checked !== raw) {if (this.cleanup === cleanup) this.cleanup = null; return;}
      this.storage.remove();
      if (cleanup.current() && this.read() === null && cleanup.current() && this.cleanup === cleanup) {
        this.observed = null; this.cleanup = null; this.pendingWrite = null;
      }
    } catch { /* Optional removal failure retains bounded cleanup for this lifetime only. */ }
  }
  /** Persists changed input only for an owned current or privately known provisional successor. */
  sync(ownerId: string | undefined, owned: RaceRunView, state: RaceSessionState, projected: boolean, wallNow: () => number, current: () => boolean, receivedAtMs: number, monotonicNowMs: number): void {
    if (!this.bind(ownerId, owned, current)) return;
    try {
      if (["completed", "timed_out", "abandoned"].includes(owned.status)) {
        /** Terminal authority may clear only its observed matching record. */
        const raws = [this.observed, this.pendingWrite?.current() ? this.pendingWrite.raw : null].filter((raw): raw is string => {
          /** Both retained candidates must belong to the canonical terminal identity. */
          const record = parse(raw);
          return typeof raw === "string" && !!record && record.ownerId === ownerId && record.runId === owned.runId && record.locale === owned.locale;
        });
        if (current() && raws.length) {
          if (!this.cleanup) this.cleanup = {raws, current, retryAtMs: -Infinity};
          this.retryCleanup(monotonicNowMs);
        }
        return;
      }
      /** Visible metadata cannot redirect input into another run or arbitrary deck position. */
      const visible = state.run, riddle = visible?.currentRiddle, confirmed = owned.currentRiddle;
      /** Server-scheduled activation is derived solely from the private receipt and monotonic time. */
      const started = owned.status === "active" || owned.status === "scheduled" && owned.serverNowMs !== undefined && owned.startsAtMs !== undefined &&
        Number.isFinite(receivedAtMs) && Number.isFinite(monotonicNowMs) &&
        estimatedRaceServerNow(owned.serverNowMs, receivedAtMs, monotonicNowMs) >= owned.startsAtMs;
      if (!started || visible?.status !== "active" || visible.runId !== owned.runId || visible.locale !== owned.locale || !riddle || !confirmed) return;
      /** Provisional input binds only to the immediate successor from the private immutable deck. */
      const prompt = riddle.position === confirmed.position ? confirmed : projected && riddle.position === confirmed.position + 1 ? owned.preloadedRiddles?.[riddle.position] : undefined;
      if (!prompt || prompt.riddleId !== riddle.riddleId || prompt.answerLength !== riddle.answerLength || state.currentLetters.length !== prompt.answerLength) return;
      /** Serializable content contains no evaluation, reveals, feedback or competitive facts. */
      const content = {version: 1, ownerId, runId: owned.runId, locale: owned.locale, riddleId: prompt.riddleId, position: prompt.position,
        guessesUsed: prompt === confirmed ? confirmed.guessesUsed : 0, pendingGuess: prompt === confirmed && state.pending === "raceGuess",
        letters: [...state.currentLetters], activeSlotIndex: state.activeSlotIndex};
      /** Unchanged clock and presentation updates do not write storage or reset expiry. */
      const key = JSON.stringify(content);
      if (key === this.content && !this.pendingWrite || !Number.isFinite(monotonicNowMs) || monotonicNowMs < this.retryAtMs) return;
      /** Only valid local retention clocks and bounded drafts are eligible. */
      const raw = JSON.stringify({...content, savedAtMs: wallNow()});
      if (!parse(raw) || !current()) return;
      /** Unavailable reads can recover; a different observed revision permanently protects that tab. */
      const observed = this.read();
      if (!current()) return;
      if (observed === undefined) {this.retryAtMs = monotonicNowMs + 1000; return;}
      this.confirmWrite(observed);
      if (observed !== this.observed) {this.content = key; this.pendingWrite = null; return;}
      if (key === this.content) {this.pendingWrite = null; this.retryAtMs = -Infinity; return;}
      this.pendingWrite = {raw, content: key, current};
      this.storage.write(raw);
      if (current() && this.read() === raw && current()) {
        this.observed = raw; this.content = key; this.retryAtMs = -Infinity; this.pendingWrite = null;
      } else if (current()) this.retryAtMs = monotonicNowMs + 1000;
    } catch {if (current()) this.retryAtMs = monotonicNowMs + 1000; /* Optional input never rejects authority. */ }
  }
}
