import {expect, it} from "@jest/globals";
import {LiveRaceViewSchema, RACE_RULES} from "@qwordly/core/race";
import {createLiveRaceDraft, editLiveRaceDraft} from "../logic/liveRaceDraft";
import {createLiveRaceDraftStorage, LIVE_RACE_DRAFT_TTL_MS} from "../logic/liveRaceDraftStorage";

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

it("restores only unsent cells and cursor after the same canonical seat rejoins", () => {
  /** Isolated storage fixture owns the checkpoint under test. */
  const f = fixture(), first = f.owner();
  expect(first.restore(view)).toBeNull(); first.save(view, f.draft);
  expect(f.owner().restore(view)).toMatchObject({letters: ["t", "e", "", ""], activeSlotIndex: f.draft.activeSlotIndex, revision: 0});
  expect(Object.keys(JSON.parse(f.raw!)).sort()).toEqual(["activeSlotIndex", "binding", "letters", "savedAtMs", "version", "writerId"]);
});

it.each(["ticket", "run", "locale", "riddle", "position", "accepted-guess", "width", "terminal"])("rejects a stale checkpoint after %s changes", field => {
  /** Isolated storage fixture owns the checkpoint under test. */
  const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft);
  /** Changed canonical authority must decide recovery eligibility. */
  const next = structuredClone(view);
  if (field === "ticket") next.ticketId = "b".repeat(64);
  if (field === "run") next.run!.runId = "other";
  if (field === "locale") next.run!.locale = "fr";
  if (field === "riddle") next.run!.currentRiddle!.riddleId = "other";
  if (field === "position") next.run!.currentRiddle!.position++;
  if (field === "accepted-guess") next.run!.currentRiddle!.guessesUsed++;
  if (field === "width") next.run!.currentRiddle!.answerLength++;
  if (field === "terminal") next.phase = "result";
  expect(f.owner().restore(next)).toBeNull();
});

it("rejects other accounts, expired drafts, future timestamps and malformed cells", () => {
  /** Isolated storage fixture owns the checkpoint under test. */
  const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft);
  /** Original bytes prove unchanged and failed writes preserve persistence. */
  const saved = f.raw!;
  expect(createLiveRaceDraftStorage("Bob", f.storage, () => 1000).restore(view)).toBeNull();
  f.at = 1001 + LIVE_RACE_DRAFT_TTL_MS; expect(f.owner().restore(view)).toBeNull();
  f.at = 999; expect(f.owner().restore(view)).toBeNull();
  f.at = 1000;
  for (const patch of [{letters: ["te", "", "", ""]}, {letters: [null, "", "", ""]}, {activeSlotIndex: -1}, {requestId: "do-not-replay"}]) {
    f.raw = JSON.stringify({...JSON.parse(saved), ...patch}); expect(f.owner().restore(view)).toBeNull();
  }
});

it("merges canonical hints and repairs cursor without replacing the remaining prefix", () => {
  /** Isolated storage fixture owns the checkpoint under test. */
  const f = fixture(), first = f.owner(); first.restore(view);
  first.save(view, {...f.draft, activeSlotIndex: 0});
  /** Changed canonical authority must decide recovery eligibility. */
  const next = structuredClone(view); next.run!.currentRiddle!.revealedLetters = [{index: 0, letter: "t"}];
  expect(f.owner().restore(next)).toMatchObject({letters: ["t", "e", "", ""], activeSlotIndex: 2});
});

it("does not rewrite identical drafts, retries denied changes and preserves another tab's revision", () => {
  /** Isolated storage fixture owns the checkpoint under test. */
  const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft);
  /** Original bytes prove unchanged and failed writes preserve persistence. */
  const saved = f.raw; first.save(view, f.draft); expect(f.writes).toBe(1); expect(f.raw).toBe(saved);
  /** New input must remain eligible for retry after storage denial. */
  const changed = {...f.draft, letters: ["t", "e", "s", ""]};
  f.denied = true; first.save(view, changed); expect(f.raw).toBe(saved);
  f.denied = false; first.save(view, changed); expect(f.owner().restore(view)?.letters).toEqual(changed.letters);
  f.raw = JSON.stringify({...JSON.parse(f.raw!), letters: ["x", "", "", ""]});
  /** Foreign observed bytes must survive the old owner cleanup. */
  const competing = f.raw; first.save(view, f.draft); first.clear(); expect(f.raw).toBe(competing);
});

it("clears the observed draft on explicit retirement and tolerates unavailable storage", () => {
  /** Isolated storage fixture owns the checkpoint under test. */
  const f = fixture(), first = f.owner(); first.restore(view); first.save(view, f.draft); first.clear(); expect(f.raw).toBeNull();
  /** Throwing browser persistence must not stop canonical gameplay. */
  const unavailable = createLiveRaceDraftStorage("Alice", {read: () => {throw Error("blocked");}, write: () => {throw Error("blocked");}, remove: () => {throw Error("blocked");}});
  expect(unavailable.restore(view)).toBeNull(); expect(() => unavailable.save(view, f.draft)).not.toThrow(); expect(() => unavailable.clear()).not.toThrow();
});

it("retiring an older instance preserves a replacement checkpoint written in the same millisecond", () => {
  /** Fixed time and identical input make timestamp-only revisions indistinguishable. */
  const f = fixture(), old = f.owner(), replacement = f.owner();
  old.restore(view); old.save(view, f.draft);
  replacement.restore(view); replacement.save(view, f.draft);
  /** Exact replacement bytes must survive both stale editing and stale cleanup. */
  const replacementRaw = f.raw;
  old.save(view, {...f.draft, letters: ["x", "", "", ""]});
  expect(f.raw).toBe(replacementRaw);
  old.clear(); expect(f.raw).toBe(replacementRaw);
});

it.each([true, false])("storage becoming readable cannot silently claim an unseen competing checkpoint (%s)", competing => {
  /** Initial denial leaves the existing storage revision unknown. */
  const f = fixture();
  /** The original instance cannot observe what another instance writes during denial. */
  let unreadable = true;
  /** Optional reads recover without restarting the mounted game. */
  const old = createLiveRaceDraftStorage("Alice", {...f.storage, read: () => unreadable ? undefined : f.storage.read()}, () => 1000);
  old.restore(view); old.save(view, f.draft);
  if (competing) {
    /** A successful independent writer establishes a checkpoint the old instance never observed. */
    const replacement = f.owner(); replacement.restore(view); replacement.save(view, f.draft);
  }
  /** Recovery must preserve a competing record while allowing writes into a verified empty key. */
  const before = f.raw;
  unreadable = false;
  old.save(view, {...f.draft, letters: ["x", "", "", ""]});
  if (competing) {expect(f.raw).toBe(before); old.clear(); expect(f.raw).toBe(before);}
  else expect(f.owner().restore(view)?.letters).toEqual(["x", "", "", ""]);
});

it("unchanged confirmed checkpoints skip storage reads while real mutations still verify ownership", () => {
  /** Counts actual optional storage observations for an acknowledged checkpoint. */
  let reads = 0;
  /** Independent raw storage also permits a competing writer. */
  const f = fixture();
  /** The current owner must read before writing but not before a confirmed semantic no-op. */
  const first = createLiveRaceDraftStorage("Alice", {...f.storage, read: () => {reads++; return f.storage.read();}}, () => 1000);
  first.restore(view); first.save(view, f.draft);
  /** The initial write has already been verified by a readback. */
  const before = reads;
  for (let index = 0; index < 5; index++) first.save({...view, serverNowMs: view.serverNowMs + index}, f.draft);
  expect(reads).toBe(before);
  /** Another writer may take ownership while no-op observations are skipped. */
  const replacement = f.owner(); replacement.restore(view); replacement.save(view, f.draft);
  /** Its exact revision must survive later actual edits and cleanup. */
  const replacementRaw = f.raw;
  first.save(view, f.draft); expect(reads).toBe(before);
  first.save(view, {...f.draft, letters: ["x", "", "", ""]}); expect(reads).toBe(before + 1);
  first.clear(); expect(reads).toBe(before + 2); expect(f.raw).toBe(replacementRaw);
});

it("an unverified write cannot be mistaken for an unchanged confirmed checkpoint", () => {
  /** Acknowledgement temporarily fails after the storage writer accepts bytes. */
  let wrote = false, denyReadback = true;
  /** Backing bytes remain inspectable after readback recovers. */
  const f = fixture();
  /** Successful writes and readable acknowledgements are distinct persistence outcomes. */
  const first = createLiveRaceDraftStorage("Alice", {...f.storage,
    read: () => wrote && denyReadback ? undefined : f.storage.read(),
    write: value => {wrote = true; return f.storage.write(value);}}, () => 1000);
  first.restore(view); first.save(view, f.draft); expect(f.writes).toBe(1);
  denyReadback = false; first.save(view, f.draft); expect(f.writes).toBe(2);
  first.save(view, f.draft); expect(f.writes).toBe(2);
  expect(f.owner().restore(view)?.letters).toEqual(f.draft.letters);
});

it("an ambiguous post-submit marker cannot revive a consumed word after a failed checkpoint clear", () => {
  /** This complete word was composed after an earlier command that never reached authority. */
  const f = fixture(), first = f.owner();
  /** The marker alone does not identify which request the server later accepts. */
  const full = editLiveRaceDraft(view.run!.currentRiddle!, createLiveRaceDraft(view.run!.currentRiddle!), "text", "zzzz");
  first.restore(view); first.save(view, full);
  f.raw = JSON.stringify({...JSON.parse(f.raw!), postSubmitInput: true});
  /** A replacement submits this recovered word, but storage cannot persist its cleared draft. */
  const replacement = f.owner(); replacement.restore(view); f.denied = true;
  replacement.save(view, createLiveRaceDraft(view.run!.currentRiddle!));
  /** That replacement's accepted guess consumes the word while the old marker remains on disk. */
  const accepted = structuredClone(view); accepted.run!.currentRiddle!.guessesUsed++;
  expect(f.owner().restore(accepted)).toBeNull();
});
