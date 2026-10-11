import {splitGraphemes, computeFeedback} from "@qwordly/core/game";
import {describe, expect, it} from "@jest/globals";
import {RACE_HINT_PENALTY_MS, type RaceRunView} from "@qwordly/core/race";
import {RACE_DRAFT_TTL_MS, type RaceDraftStorage} from "../logic/raceDraftStorage";
import {fixture, harness} from "./raceSession.support";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

/** Shared browser-style serialized storage survives remount and can fail independently. */
const memory = () => {
  /** Exactly one bounded raw record, including intentionally untrusted test values. */
  let raw: string | null = null;
  /** Denied storage operation being exercised. */
  let fault = "";
  /** Observable successful persistence writes. */
  const writes: string[] = [];
  /** Includes thrown and silently denied attempts to verify bounded recovery. */
  let attempts = 0;
  /** Removal attempts include permission failures and silent rejection. */
  let removals = 0;
  /** Public optional I/O seam, without replacing race internals. */
  const storage: RaceDraftStorage = {
    /** Reads the optional raw record. */
    read() {if (fault === "read") throw new Error("denied"); return raw;},
    /** Replaces the optional raw record. */
    write(value) {attempts++; if (fault === "write") throw new Error("quota"); if (fault === "silent-write") return; raw = value; writes.push(value); if (fault === "confirmation") fault = "read";},
    /** Clears the optional raw record. */
    remove() {removals++; if (fault === "remove") throw new Error("denied"); if (fault === "silent-remove") return; raw = null;},
  };
  return {storage, writes, attempts: () => attempts, removals: () => removals, read: () => raw, replace: (value: string | null) => {raw = value;}, deny: (value: string) => {fault = value;}};
};
/** A new session restores only after its own canonical resume response. */
const open = (run: RaceRunView, store: ReturnType<typeof memory>, now = 100000) => {
  /** No mutable draft is visible before authority confirms its run. */
  const h = harness({locale: run.locale}, run.runId, {draftStorage: store.storage, wallNow: () => now});
  expect(h.session.getSnapshot().currentLetters).toEqual([]);
  h.respond("raceResume", {run}); expect(h.session.getSnapshot().error).toBeNull();
  h.advance(3480); return h;
};
/** Saves a partial answer and deliberate selection through the actual session input policy. */
const typed = async () => {
  /** Canonical question and one browser cache belong to this case. */
  const run = await fixture(), store = memory(), h = open(run, store);
  h.session.input("text", "pi"); h.session.input("slot", 3);
  return {run, store, h};
};

describe("server-confirmed multiplayer draft reload", () => {
  it.each(["creator", "challenger"] as const)("restores unsent %s input and selection without changing canonical facts", async role => {
    /** Matched and creator paths use identical account/question-bound presentation recovery. */
    const run = {...await fixture(), role, ...(role === "challenger" ? {challengeId: "challenge-1", opponent: {displayName: "Nova", adjustedFinishMs: 60000, events: []}} : {})};
    /** One browser cache survives disposal. */
    const store = memory(), first = open(run, store);
    first.session.input("text", "pi"); first.session.input("slot", 3); first.session.dispose();
    /** The new mount accepts its server snapshot before reading the cached presentation. */
    const reload = open(run, store);
    expect(reload.session.getSnapshot()).toMatchObject({currentLetters: ["p", "i", "", "", ""], activeSlotIndex: 3, run, raceGuesses: []});
    expect(reload.commands.map(command => command.type)).toEqual(["game:resumeRace"]);
    /** Sensitive competitive/economy fields never enter the local serialized record. */
    const record = JSON.parse(store.read()!);
    expect(Object.keys(record).sort()).toEqual(["activeSlotIndex", "guessesUsed", "letters", "locale", "ownerId", "pendingGuess", "position", "riddleId", "runId", "savedAtMs", "version"].sort());
    expect(record).not.toHaveProperty("evaluation"); expect(record).not.toHaveProperty("raceGuesses");
  });
  it("restores answer-free legacy input without requiring a bundled evaluation or deck", async () => {
    /** Compatibility never relies on an answer key in browser storage. */
    const original = await fixture(), run = {...original, preloadedRiddles: undefined, currentRiddle: {...original.currentRiddle!, evaluation: undefined}};
    /** Same-question input remains valid across a legacy response. */
    const store = memory(), first = open(run, store); first.session.input("text", "pi"); first.session.dispose();
    expect(open(run, store).session.getSnapshot().currentLetters).toEqual(["p", "i", "", "", ""]);
  });
  it.each(["ownerId", "runId", "locale", "riddleId", "position", "length"])("rejects another %s binding without rejecting authority", async field => {
    /** The server response is genuine; only the optional cached identity is changed. */
    const {run, store, h} = await typed(); h.session.dispose();
    /** Untrusted local binding must not become current input. */
    const record = JSON.parse(store.read()!);
    if (field === "length") record.letters.pop();
    else if (field === "position") record.position++;
    else record[field] = field === "locale" ? "fr" : "other-identity";
    store.replace(JSON.stringify(record));
    expect(open(run, store).session.getSnapshot()).toMatchObject({run, currentLetters: ["", "", "", "", ""], error: null});
  });
  it.each(["answer", "evaluation", "score", "events", "raceGuesses"])("rejects an injected %s field instead of hydrating it", async field => {
    /** Browser records cannot supply solutions or already-scored guesses. */
    const {run, store, h} = await typed(); h.session.dispose();
    store.replace(JSON.stringify({...JSON.parse(store.read()!), [field]: "untrusted"}));
    expect(open(run, store).session.getSnapshot()).toMatchObject({run, currentLetters: ["", "", "", "", ""], raceGuesses: [], error: null});
  });
  it.each([[-1, false], [RACE_DRAFT_TTL_MS - 1, true], [RACE_DRAFT_TTL_MS, false]] as const)("enforces retention at save offset %s", async (offset, accepted) => {
    /** Local wall time determines cache retention only, never race timing. */
    const {run, store, h} = await typed(); h.session.dispose();
    expect(open(run, store, 100000 + offset).session.getSnapshot().currentLetters).toEqual(accepted ? ["p", "i", "", "", ""] : ["", "", "", "", ""]);
  });
  it.each([
    ["version", 2], ["ownerId", ""], ["position", -1], ["position", 15], ["guessesUsed", 6],
    ["guessesUsed", 1], ["pendingGuess", "false"], ["letters", ["ab", "", "", "", ""]],
    ["letters", [" ", "", "", "", ""]], ["activeSlotIndex", 5], ["savedAtMs", -1], ["savedAtMs", 1.5],
  ])("ignores malformed or future-version draft %s=%s", async (field, value) => {
    /** Valid authority must survive hostile optional presentation data. */
    const {run, store, h} = await typed(); h.session.dispose();
    store.replace(JSON.stringify({...JSON.parse(store.read()!), [field as string]: value}));
    expect(open(run, store).session.getSnapshot()).toMatchObject({run, currentLetters: ["", "", "", "", ""], error: null});
  });
  it("normalizes one decomposed grapheme without changing the canonical run", async () => {
    /** Unicode browser input must remain one answer slot across serialization. */
    const {run, store, h} = await typed(); h.session.dispose();
    store.replace(JSON.stringify({...JSON.parse(store.read()!), letters: ["e\u0301", "i", "", "", ""]}));
    expect(open(run, store).session.getSnapshot()).toMatchObject({run, currentLetters: ["é", "i", "", "", ""]});
  });
  it("merges canonical hints and repairs a selection that became read-only during reload", async () => {
    /** A wrong local letter must yield to a newly confirmed hint. */
    const {run, store, h} = await typed(); h.session.input("slot", 0); h.session.input("letter", "x"); h.session.input("slot", 0); h.session.dispose();
    /** Only this server response owns the paid time and revealed answer position. */
    const hinted = {...run, totalPenaltyMs: RACE_HINT_PENALTY_MS, adjustedElapsedMs: run.wallElapsedMs + RACE_HINT_PENALTY_MS,
      currentRiddle: {...run.currentRiddle!, revealedLetters: [{index: 0, letter: "p"}]},
      events: [{sequence: 0, type: "hint" as const, riddlePosition: 0, wallElapsedMs: run.wallElapsedMs,
        penaltyAddedMs: RACE_HINT_PENALTY_MS, totalPenaltyMs: RACE_HINT_PENALTY_MS, adjustedElapsedMs: run.wallElapsedMs + RACE_HINT_PENALTY_MS, correctCount: 0}]};
    /** Recovered selection skips the already composed second letter. */
    const restored = open(hinted, store).session;
    expect(restored.getSnapshot()).toMatchObject({currentLetters: ["p", "i", "", "", ""], activeSlotIndex: 2, run: hinted});
    restored.input("text", "ano");
    expect(restored.getSnapshot().currentLetters.join("")).toBe("piano");
  });
  it.each([false, true])("does not repeat a submitted wrong word after reload: committed %s", async committed => {
    /** A lost response may represent a committed or never-delivered wrong guess. */
    const run = await fixture(), store = memory(), first = open(run, store);
    first.session.input("text", "zzzzz"); first.session.submit(); first.session.dispose();
    /** The resume's guess version determines whether input was already submitted. */
    const resumed = {...run, currentRiddle: {...run.currentRiddle!, guessesUsed: committed ? 1 : 0, guessesRemaining: committed ? 4 : 5}};
    /** Reload itself never repeats the mutation. */
    const reload = open(resumed, store);
    expect(reload.session.getSnapshot().currentLetters).toEqual(["", "", "", "", ""]);
    expect(reload.commands.map(command => command.type)).toEqual(["game:resumeRace"]);
  });
  it.each([false, true])("restores provisional successor input only when authority confirms it: applied %s", async applied => {
    /** A valid local correct projection permits typing into the privately known next question. */
    const authority = createFakeRaceServices(), run = await fixture(false, authority), store = memory(), first = open(run, store);
    first.session.input("text", "piano"); first.session.submit(); first.session.input("text", "cl"); first.session.input("slot", 3);
    expect(first.session.getSnapshot().currentLetters).toEqual(["c", "l", "", "", ""]); first.session.dispose();
    /** Canonical advancement cannot come from the persisted draft. */
    const resumed = applied ? (await authority.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess: "piano", requestId: "confirmed-correct"})).run : run;
    expect(open(resumed, store).session.getSnapshot().currentLetters).toEqual(applied ? ["c", "l", "", "", ""] : ["", "", "", "", ""]);
  });
  it("preserves a newer tab's draft when an older live tab edits or resets", async () => {
    /** Two genuine sessions share the same raw browser record. */
    const {run, store, h: old} = await typed(), newer = open(run, store);
    newer.session.input("letter", "n");
    /** The latest tab's observed record must survive stale input and navigation. */
    const expected = store.read(); old.session.input("letter", "x"); old.session.rematch(); old.session.dispose();
    expect(store.read()).toBe(expected);
    expect(open(run, store).session.getSnapshot().currentLetters).toEqual(["p", "i", "", "n", ""]);
  });
  it("does not rewrite the draft or extend retention on unchanged clock updates", async () => {
    /** Clock rendering must not perform twenty synchronous writes per second. */
    const {store, h} = await typed();
    /** Snapshot before ordinary timer activity. */
    const raw = store.read(), writes = store.writes.length;
    for (let index = 0; index < 10; index++) h.advance(50);
    expect(store.read()).toBe(raw); expect(store.writes).toHaveLength(writes);
  });
  it("does not overwrite an unobserved saved draft when initial reads are denied", async () => {
    /** A new mount cannot claim an unreadable revision as an empty record. */
    const {run, store, h} = await typed(); h.session.dispose();
    /** The original persisted bytes remain protected while reads fail. */
    const saved = store.read(); store.deny("read");
    /** New input is live even when reload cannot recover its draft. */
    const reload = open(run, store); reload.session.input("text", "cl");
    expect(reload.session.getSnapshot().currentLetters).toEqual(["c", "l", "", "", ""]);
    expect(store.read()).toBe(saved);
  });
  it("does not overwrite a newer draft when an empty-cache session loses read access", async () => {
    /** Empty cache observation must not authorize writes after a later read failure. */
    const run = await fixture(), store = memory(); store.deny("write");
    /** This session observed an empty cache but its first write was rejected. */
    const old = open(run, store); store.deny("");
    /** Another tab writes before the stale tab's storage check becomes unavailable. */
    store.replace(null);
    /** Successful persistence belongs to the independently resumed tab. */
    const newer = open(run, store); newer.session.input("text", "pi");
    /** The stale tab must preserve these bytes despite its unavailable check. */
    const saved = store.read(); store.deny("read"); old.session.input("text", "cl");
    expect(old.session.getSnapshot().currentLetters).toEqual(["c", "l", "", "", ""]);
    expect(store.read()).toBe(saved);
  });
  it.each(["read", "write", "remove"])("isolates denied %s storage from input and canonical abandonment", async operation => {
    /** Broken optional persistence must not affect the race operation. */
    const run = await fixture(), store = memory(), h = open(run, store); store.deny(operation);
    expect(() => h.session.input("text", "pi")).not.toThrow();
    expect(h.session.getSnapshot().currentLetters).toEqual(["p", "i", "", "", ""]);
    h.session.abandon(); h.respond("raceAbandon", {run: {...run, status: "abandoned", currentRiddle: null}, result: null});
    expect(h.session.getSnapshot().error).toBeNull();
  });
  it.each(["write", "silent-write"])("recovers unchanged input after a temporary %s denial with bounded attempts", async fault => {
    /** One live canonical run continues accepting input during optional storage failure. */
    const run = await fixture(), store = memory(), first = open(run, store);
    store.deny(fault); first.session.input("text", "pi");
    /** Failed persistence leaves the previous record unchanged. */
    const before = store.read(), attempts = store.attempts();
    for (let index = 0; index < 10; index++) first.advance(50);
    expect(store.read()).toBe(before); expect(store.attempts()).toBe(attempts);
    store.deny(""); first.advance(1000);
    expect(JSON.parse(store.read()!).letters).toEqual(["p", "i", "", "", ""]);
    first.session.dispose();
    expect(open(run, store).session.getSnapshot().currentLetters).toEqual(["p", "i", "", "", ""]);
  });
  it("preserves a newer tab's draft when a deferred failed write becomes available", async () => {
    /** A failed write does not reserve ownership against future tabs. */
    const run = await fixture(), store = memory(), old = open(run, store);
    store.deny("write"); old.session.input("text", "cl"); store.deny("");
    /** A new session succeeds before the old session's next persistence attempt. */
    const newer = open(run, store); newer.session.input("text", "pi");
    /** Exact revision comparison must still reject the stale retry. */
    const expected = store.read(); old.advance(2000);
    expect(store.read()).toBe(expected); old.session.dispose(); newer.session.dispose();
  });
  it.each(["remove", "silent-remove", "read"])("recovers deferred terminal cleanup after temporary %s failure", async fault => {
    /** An authoritative abandonment discovered by resume leaves this session in its live hub. */
    const {run, store, h} = await typed(); store.deny(fault);
    h.session.retry(); h.respond("raceResume", {run: {...run, status: "abandoned", currentRiddle: null}});
    expect(h.session.getSnapshot().stage).toBe("categories");
    /** Cleanup is bounded while storage continues refusing deletion. */
    const attempts = store.removals(); for (let index = 0; index < 10; index++) h.advance(50);
    expect(store.removals()).toBe(attempts); expect(store.read()).not.toBeNull();
    store.deny(""); h.advance(1000); expect(store.read()).toBeNull(); h.session.dispose();
  });
  it.each(["replacement", "account", "disposed"])("cannot clear a %s journey during deferred terminal cleanup", async replacement => {
    /** A terminal receipt cannot grant unbounded future storage cleanup permission. */
    const {run, store, h} = await typed(); store.deny("silent-remove");
    h.session.retry(); h.respond("raceResume", {run: {...run, status: "abandoned", currentRiddle: null}});
    store.deny("");
    if (replacement === "replacement") store.replace(JSON.stringify({...JSON.parse(store.read()!), savedAtMs: 100001, letters: ["n", "e", "w", "", ""]}));
    else if (replacement === "account") h.session.enter({locale: "en", ownerId: "other-owner", tournamentLocale: "en"});
    else h.session.dispose();
    /** Clock activity after replacement retains the exact newer or inaccessible bytes. */
    const expected = store.read(); h.advance(2000); expect(store.read()).toBe(expected); h.session.dispose();
  });
  it("confirms an uncertain successful write before persisting newer live input", async () => {
    /** The write succeeds but its confirming read becomes unavailable. */
    const run = await fixture(), store = memory(), h = open(run, store); store.deny("confirmation");
    h.session.input("text", "pi"); h.session.input("letter", "a");
    expect(JSON.parse(store.read()!).letters).toEqual(["p", "i", "", "", ""]);
    store.deny(""); h.advance(1500);
    expect(JSON.parse(store.read()!).letters).toEqual(["p", "i", "a", "", ""]);
    h.session.dispose(); expect(open(run, store).session.getSnapshot().currentLetters).toEqual(["p", "i", "a", "", ""]);
  });
  it("does not rewrite or renew an unchanged write once its confirmation recovers", async () => {
    /** A delayed read-back should acknowledge the original bytes rather than issuing another write. */
    const run = await fixture(), store = memory(), h = open(run, store); store.deny("confirmation");
    h.session.input("text", "pi");
    /** Successful storage bytes must survive their delayed confirmation exactly. */
    const saved = store.read(), writes = store.writes.length; store.deny(""); h.advance(1500);
    expect(store.read()).toBe(saved); expect(store.writes).toHaveLength(writes);
    h.session.input("letter", "a"); expect(JSON.parse(store.read()!).letters).toEqual(["p", "i", "a", "", ""]); h.session.dispose();
  });
  it("cleans an unconfirmed successful write after terminal authority and read recovery", async () => {
    /** Terminal authority may arrive while a prior successful write still cannot be read back. */
    const run = await fixture(), store = memory(), h = open(run, store); store.deny("confirmation");
    h.session.input("text", "pi"); h.session.retry(); h.respond("raceResume", {run: {...run, status: "abandoned", currentRiddle: null}});
    expect(store.read()).not.toBeNull(); store.deny(""); h.advance(1500); expect(store.read()).toBeNull(); h.session.dispose();
  });
  it("preserves a newer tab's write instead of adopting an uncertain candidate", async () => {
    /** Only exact attempted bytes can confirm a write; a replacement belongs to another tab. */
    const run = await fixture(), store = memory(), h = open(run, store); store.deny("confirmation");
    h.session.input("text", "pi"); store.deny("");
    /** Replacement remains protected even while the old tab has further unsaved edits. */
    const newer = JSON.stringify({...JSON.parse(store.read()!), savedAtMs: 100001, letters: ["n", "e", "w", "", ""]});
    store.replace(newer); h.session.input("letter", "a"); h.advance(1500); expect(store.read()).toBe(newer); h.session.dispose();
  });
  it("persists a deliberate return to the prior draft while a write remains unconfirmed", async () => {
    /** A user can clear input before the uncertain successful write becomes readable again. */
    const run = await fixture(), store = memory(), h = open(run, store); store.deny("confirmation");
    h.session.input("text", "pi"); h.session.input("backspace"); h.session.input("backspace");
    expect(h.session.getSnapshot().currentLetters).toEqual(["", "", "", "", ""]);
    store.deny(""); h.advance(1500);
    expect(JSON.parse(store.read()!).letters).toEqual(["", "", "", "", ""]); h.session.dispose();
  });
  it("clears its observed draft only after canonical abandonment", async () => {
    /** A terminal server response owns cleanup; disposal alone retains input. */
    const {run, store, h} = await typed(); expect(store.read()).not.toBeNull();
    h.session.abandon(); h.respond("raceAbandon", {run: {...run, status: "abandoned", currentRiddle: null}, result: null});
    expect(h.session.getSnapshot().error).toBeNull(); expect(store.read()).toBeNull();
  });
});

it("restores consumed rows and feedback from authority after a fresh race lifetime", async () => {
  /** Complete canonical question retained by the server across a browser reload. */
  const run = await fixture();
  /** Server presentation rows preserve repeated words as separately consumed attempts. */
  const confirmedGuesses = ["aaaaa", "aaaaa", "bbbbb"].map(word => ({guess: [...word], feedback: computeFeedback(word, run.currentRiddle!.evaluation!.answer, run.locale)}));
  /** Public attempt reconstruction is shared with the reloaded session. */
  const {raceAttemptState} = await import("../RaceSessionAuthority");
  /** Returned authority owns both the consumed count and the exact confirmed suffix. */
  const resumed = {...run, currentRiddle: {...run.currentRiddle!, guessesUsed: 3, guessesRemaining: 2, confirmedGuesses}};
  expect(raceAttemptState(resumed).raceGuesses).toEqual(confirmedGuesses);
  /** A fresh session cannot use cached board rows before its Resume is validated. */
  const reload = harness({}, run.runId);
  reload.respond("raceResume", {run: JSON.parse(JSON.stringify(resumed))});
  expect(reload.session.getSnapshot().raceGuesses).toEqual(confirmedGuesses);
  expect(reload.session.getSnapshot().run?.currentRiddle?.guessesRemaining).toBe(2);
  reload.session.dispose();
});


it("keeps consumed legacy rows ahead of restored editable input", async () => {
  /** Compatible legacy authority reports consumed slots without their letters. */
  const run = await fixture();
  /** Fresh reload must reserve those slots before accepting new input. */
  const reload = harness({}, run.runId);
  reload.respond("raceResume", {run: {...run, currentRiddle: {...run.currentRiddle!, guessesUsed: 3, guessesRemaining: 2}}});
  expect(reload.session.getSnapshot().raceGuesses).toHaveLength(3);
  expect(reload.session.getSnapshot().currentLetters).toEqual(["", "", "", "", ""]);
  reload.session.dispose();
});

it.each([{locale: "hi", text: "लक्ष्म्यां"}, {locale: "fr", text: "a"+"\u0344".repeat(127)}] as const)("restores full $locale native graphemes after disposing the same question", async ({locale, text}) => {
  /** Canonical legacy presentation permits Unicode input without storing a solution in browser data. */
  const base = await fixture(), letters = splitGraphemes(text, locale), run = {...base, locale, preloadedRiddles: undefined,
    currentRiddle: {...base.currentRiddle!, evaluation: undefined, answerLength: letters.length}};
  /** The actual session input policy persists NFC cells, including canonically expanded input. */
  const store = memory(), first = open(run, store);
  first.session.input("text", text);expect(first.session.getSnapshot().currentLetters).toEqual(letters);first.session.dispose();
  expect(open(run, store).session.getSnapshot().currentLetters).toEqual(letters);
});

it("rejects restored cells whose separate normalization exceeds the whole guess budget", async () => {
  /** Each cell is valid in isolation but normalization across their boundary would disguise an oversized restored draft. */
  const {run, store, h} = await typed();h.session.dispose();
  /** Browser data is presentation only and cannot exceed the accepted input transport. */
  const record = JSON.parse(store.read()!);record.letters = ["a", "\u0344".repeat(192), "", "", ""];
  expect(record.letters.join("").normalize("NFC")).toHaveLength(384);
  expect(record.letters.map((letter: string) => letter.normalize("NFC")).join("")).toHaveLength(385);
  store.replace(JSON.stringify(record));
  expect(open(run, store).session.getSnapshot().currentLetters).toEqual(["", "", "", "", ""]);
});
