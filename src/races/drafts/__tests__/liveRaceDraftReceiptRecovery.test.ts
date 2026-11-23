import {expect, it, jest} from "@jest/globals";
import {LiveRaceViewSchema, RACE_RULES} from "../../contracts/index";
import {createLiveRaceDraft, editLiveRaceDraft, reconcileLiveRaceDraft} from "../liveRaceDraft";
import {createLiveRaceDraftStorage, LIVE_RACE_DRAFT_TTL_MS} from "../../browser/storage/liveRaceDraftStorage";

/** Schema-valid viewer seat used by the same reconciliation helper as the live React adapter. */
const view = LiveRaceViewSchema.parse({ticketId: "a".repeat(64), phase: "racing", serverNowMs: 1000,
  searchEndsAtMs: 60000, startsAtMs: 0, player: {displayName: "Alice", avatarUrl: null, bot: false, correctCount: 0},
  opponent: {displayName: "Bob", avatarUrl: null, bot: false, correctCount: 0}, result: null, rewardCoins: 0,
  run: {runId: "run-1", role: "creator", status: "active", categoryId: "mixed", locale: "en", rules: RACE_RULES,
    correctCount: 0, wallElapsedMs: 1000, totalPenaltyMs: 0, adjustedElapsedMs: 1000, events: [],
    currentRiddle: {riddleId: "question-1", text: "Clue", answerLength: 4, position: 0, guessesUsed: 0,
      guessesRemaining: 5, hintAvailable: true, revealedLetters: [], confirmedGuesses: []}}});


/** Exact raw revision makes competing tabs and optional storage failures observable. */
function fixture() {
  /** Mutable persistence and retention clock for one isolated test. */
  let raw: string | null = null, writes = 0, denied = false, at = 1000;
  /** Exact revision storage reports accepted and denied writes. */
  const storage = {read: () => raw, write: (value: string) => {writes++; if (denied) return false; raw = value; return true;}, remove: () => {raw = null; return true;}};
  /** Each instance simulates a fresh mounted account journey. */
  const owner = () => createLiveRaceDraftStorage("Alice", storage, () => at);
  /** Player-authored prefix used for reload and stale-authority cases. */
  const draft = editLiveRaceDraft(view.run!.currentRiddle!, createLiveRaceDraft(view.run!.currentRiddle!), "text", "te");
  return {owner, storage, draft,
    /** Exposes exact bytes for competing-tab mutations. */ get raw() {return raw;},
    /** Simulates a different writer replacing the checkpoint. */ set raw(value: string | null) {raw = value;},
    /** Counts physical writes rather than adapter invocations. */ get writes() {return writes;},
    /** Simulates optional storage rejecting a changed draft. */ set denied(value: boolean) {denied = value;},
    /** Controls expiration independently of the race clock. */ set at(value: number) {at = value;}};
}

/** Fixture-controlled private proof acknowledgement. */
type AcceptedProof = {
  /** Server-confirmed original attempt. */
  status: "accepted";
};
/** Exact original request locator deliberately omits its submitted word. */
const query = {ticketId: view.ticketId, requestId: "original-guess-001", riddleId: "question-1", position: 0, guessesUsedBefore: 0};
/** A canonical accepted wrong guess advances only this question's attempt version. */
const advanced = () => {
  /** Same question retains every identity except the accepted attempt version. */
  const next = structuredClone(view); next.run!.currentRiddle!.guessesUsed++; return next;
};
it("restores independent post-submit cells only after confirming the exact original accepted request", async () => {
  /** Original journey saves new input under its still-visible pre-reply authority. */
  const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft, query);
  /** Only a locator accompanies presentation; no command or guess is persisted. */
  expect(JSON.parse(f.raw!).guessReceipt).toEqual(query);
  expect(JSON.parse(f.raw!)).not.toHaveProperty("guess");
  expect(f.owner().restore(advanced())).toBeNull();
  /** Authenticated confirmation supplies the missing accepted-attempt identity. */
  const confirm = jest.fn(async () => ({status: "accepted" as const}));
  /** Confirmed cells are returned only after the bounded lookup finishes. */
  const recovered = await f.owner().restoreWithReceipt(advanced(), confirm);
  expect(recovered?.letters).toEqual(f.draft.letters);
  expect(confirm).toHaveBeenCalledWith(query);
});
it("exact-count and legacy records recover without any optional lookup", async () => {
  /** Ordinary unsent input incurs no new network request. */
  const f = fixture(), first = f.owner(), confirm = jest.fn(async () => ({status: "accepted" as const}));
  first.restore(view); first.save(view, f.draft);
  expect((await f.owner().restoreWithReceipt(view, confirm))?.letters).toEqual(f.draft.letters);
  first.save(view, f.draft, query);
  expect((await f.owner().restoreWithReceipt(view, confirm))?.letters).toEqual(f.draft.letters);
  expect(confirm).not.toHaveBeenCalled();
});
it.each(["unconfirmed", "malformed", "missing", "rejected"])("drops ambiguous cells for %s proof without mutating the checkpoint", async kind => {
  /** Optional provider failure never authorizes replay or local migration. */
  const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft, query);
  /** The exact saved bytes remain owned by a future journey. */
  const raw = f.raw, confirm = kind === "missing" ? undefined : async () => {
    if (kind === "rejected") throw new Error("endpoint-unavailable");
    return kind === "malformed" ? {status: "accepted", guess: "answer"} as never : {status: "unconfirmed" as const};
  };
  expect(await f.owner().restoreWithReceipt(advanced(), confirm)).toBeNull();
  expect(f.raw).toBe(raw);
});
it.each(["count", "ticket", "run", "locale", "riddle", "position", "width", "account"])("never queries across a changed %s boundary", async field => {
  /** Receipt proof is eligible only within the checkpoint's canonical question identity. */
  const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft, query);
  /** Change a single authority boundary after the expected attempt advance. */
  const next = advanced(), confirm = jest.fn(async () => ({status: "accepted" as const}));
  if (field === "count") next.run!.currentRiddle!.guessesUsed++;
  if (field === "ticket") next.ticketId = "b".repeat(64);
  if (field === "run") next.run!.runId = "other";
  if (field === "locale") next.run!.locale = "fr";
  if (field === "riddle") next.run!.currentRiddle!.riddleId = "other";
  if (field === "position") next.run!.currentRiddle!.position++;
  if (field === "width") next.run!.currentRiddle!.answerLength++;
  /** Account changes create an independent presentation owner. */
  const owner = field === "account" ? createLiveRaceDraftStorage("Bob", f.storage, () => 1000) : f.owner();
  expect(await owner.restoreWithReceipt(next, confirm)).toBeNull();
  expect(confirm).not.toHaveBeenCalled();
});
it("cannot revive a replacement's consumed word when clearing its checkpoint fails", async () => {
  /** Full word was independently composed while the original request was still unaccepted. */
  const f = fixture(), first = f.owner(), full = editLiveRaceDraft(view.run!.currentRiddle!, createLiveRaceDraft(view.run!.currentRiddle!), "text", "zzzz");
  first.restore(view); first.save(view, full, query);
  /** Replacement recovers at the exact count and submits its own different request. */
  const replacement = f.owner(); expect(replacement.restore(view)?.letters).toEqual(full.letters); f.denied = true;
  replacement.save(view, createLiveRaceDraft(view.run!.currentRiddle!));
  /** Only the replacement command was accepted; the original locator cannot supply proof. */
  const confirm = jest.fn(async locator => ({status: locator.requestId === "replacement-guess" ? "accepted" as const : "unconfirmed" as const}));
  expect(await f.owner().restoreWithReceipt(advanced(), confirm)).toBeNull();
  expect(confirm).toHaveBeenCalledWith(query);
});
it("a confirmed old locator cannot bridge another attempt after a failed migrated-checkpoint clear", async () => {
  /** The original accepted request permits recovery at count one. */
  const f = fixture(), first = f.owner(), full = editLiveRaceDraft(view.run!.currentRiddle!, createLiveRaceDraft(view.run!.currentRiddle!), "text", "zzzz");
  first.restore(view); first.save(view, full, query);
  /** Successful normalized save removes the old locator rather than rebinding its proof. */
  const replacement = f.owner(), next = advanced(), restored = await replacement.restoreWithReceipt(next, async () => ({status: "accepted"}));
  expect(restored).not.toBeNull(); replacement.save(next, restored!);
  expect(JSON.parse(f.raw!)).not.toHaveProperty("guessReceipt");
  f.denied = true; replacement.save(next, createLiveRaceDraft(next.run!.currentRiddle!));
  next.run!.currentRiddle!.guessesUsed++;
  /** Its replacement guess has consumed these cells; stale original proof must not be reused. */
  const confirm = jest.fn(async () => ({status: "accepted" as const}));
  expect(await f.owner().restoreWithReceipt(next, confirm)).toBeNull(); expect(confirm).not.toHaveBeenCalled();
});
it.each(["writer", "edit", "clear", "abort"])("a late accepted lookup cannot overwrite a newer %s", async kind => {
  /** Keep the server promise pending while a competing owner or local event takes precedence. */
  const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft, query);
  /** Fixture-controlled transport supplies a late successful acknowledgement. */
  let resolve!: (value: AcceptedProof) => void;
  /** Each journey owns cancellation independently of its provider promise. */
  const controller = new AbortController(), replacement = f.owner(), next = advanced();
  /** Pending recovery cannot publish before receipt ownership is rechecked. */
  const pending = replacement.restoreWithReceipt(next, () => new Promise(done => {resolve = done;}), controller.signal);
  if (kind === "writer") {
    /** A fresh mounted writer claims an independently versioned checkpoint. */
    const other = f.owner(); other.restore(view); other.save(view, f.draft, query);}
  if (kind === "edit") replacement.save(next, {...f.draft, letters: ["x", "", "", ""]});
  if (kind === "clear") replacement.clear();
  if (kind === "abort") controller.abort();
  /** Preserve the winning revision after the now-superseded lookup resolves. */
  const raw = f.raw; resolve({status: "accepted"});
  expect(await pending).toBeNull(); expect(f.raw).toBe(raw);
});
it("bounds a stalled lookup and ignores late acceptance without retained timers", async () => {
  jest.useFakeTimers();
  try {
    /** Original post-submit presentation is eligible but authority is unavailable. */
    const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft, query);
    /** The provider may ignore local cancellation and complete later. */
    let resolve!: (value: AcceptedProof) => void;
    /** A stalled provider is subject to the finite read deadline. */
    const pending = f.owner().restoreWithReceipt(advanced(), () => new Promise(done => {resolve = done;}));
    await jest.advanceTimersByTimeAsync(2000);
    expect(await pending).toBeNull(); expect(jest.getTimerCount()).toBe(0);
    resolve({status: "accepted"}); await Promise.resolve(); expect(jest.getTimerCount()).toBe(0);
  } finally {jest.useRealTimers();}
});

it("does not restore a checkpoint whose retention expires during proof lookup", async () => {
  /** The request starts while the local presentation is still retained. */
  const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft, query);
  /** Advancing the local clock cannot extend presentation retention through a server proof. */
  let resolve!: (value: AcceptedProof) => void;
  /** This invocation owns one pending proof read. */
  const pending = f.owner().restoreWithReceipt(advanced(), () => new Promise(done => {resolve = done;}));
  f.at = 1001 + LIVE_RACE_DRAFT_TTL_MS; resolve({status: "accepted"});
  expect(await pending).toBeNull();
});

it.each([false, true])("invalidates untouched restored cells on a later accepted attempt (proof=%s)", async proof => {
  /** Restore either an exact legacy checkpoint or an authenticated one-attempt bridge. */
  const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft, proof ? query : undefined);
  /** Captured rejoin authority precedes the competing accepted guess. */
  const canonical = proof ? advanced() : view;
  /** Receipt delivery restores presentation without inventing new typing intent. */
  const restored = (await f.owner().restoreWithReceipt(canonical, async () => ({status: "accepted"})))!;
  expect(reconcileLiveRaceDraft(restored, canonical, canonical)).toBe(restored);
  /** A fresh observation invalidates untouched recovery while retaining canonical hint locks. */
  const later = structuredClone(canonical); later.run!.currentRiddle!.guessesUsed++;
  later.run!.currentRiddle!.revealedLetters = [{index: 0, letter: "A"}];
  expect(reconcileLiveRaceDraft(restored, canonical, later).letters).toEqual(["A", "", "", ""]);
  /** Cursor movement is not new answer intent. */
  const focused = editLiveRaceDraft(canonical.run!.currentRiddle!, restored, "slot", 3);
  expect(reconcileLiveRaceDraft(focused, canonical, later).letters).toEqual(["A", "", "", ""]);
  /** Real changed letters remain independent local intent across accepted attempts. */
  const edited = editLiveRaceDraft(canonical.run!.currentRiddle!, restored, "letter", "x");
  expect(reconcileLiveRaceDraft(edited, canonical, later).letters.slice(1)).toEqual(edited.letters.slice(1));
});
