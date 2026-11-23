import {expect, it} from "@jest/globals";
import {LiveRaceViewSchema, RACE_RULES} from "../../../../core/race";
import {createLiveRaceDraft, editLiveRaceDraft, reconcileLiveRaceDraft, rejectLiveRaceDraft} from "../logic/liveRaceDraft";

/** Schema-valid viewer seat used by the same reconciliation helper as the live React adapter. */
const view = LiveRaceViewSchema.parse({ticketId: "a".repeat(64), phase: "racing", serverNowMs: 1000,
  searchEndsAtMs: 60000, startsAtMs: 0, player: {displayName: "Alice", avatarUrl: null, bot: false, correctCount: 0},
  opponent: {displayName: "Bob", avatarUrl: null, bot: false, correctCount: 0}, result: null, rewardCoins: 0,
  run: {runId: "run-1", role: "creator", status: "active", categoryId: "mixed", locale: "en", rules: RACE_RULES,
    correctCount: 0, wallElapsedMs: 1000, totalPenaltyMs: 0, adjustedElapsedMs: 1000, events: [],
    currentRiddle: {riddleId: "question-1", text: "Clue", answerLength: 4, position: 0, guessesUsed: 0,
      guessesRemaining: 5, hintAvailable: true, revealedLetters: [], confirmedGuesses: []}}});

it.each(["poll", "accepted-wrong", "hint"])("keeps unsent same-question letters when a live %s receipt changes authority", kind => {
  /** Native editing precedes an opponent poll, accepted wrong answer or another tab's paid hint. */
  const draft = editLiveRaceDraft(view.run!.currentRiddle!, createLiveRaceDraft(view.run!.currentRiddle!), "text", "te");
  /** Only the accepted attempt version or hint locks change, not question ownership. */
  const next = structuredClone(view);
  if (kind === "accepted-wrong") {next.run!.currentRiddle!.guessesUsed = 1; next.run!.currentRiddle!.guessesRemaining = 4;}
  if (kind === "hint") next.run!.currentRiddle!.revealedLetters = [{index: 0, letter: "t"}];
  expect(reconcileLiveRaceDraft(draft, view, next).letters).toEqual(["t", "e", "", ""]);
});

it.each(["seat", "run", "locale", "riddle", "position", "width", "terminal"])("never transfers a live draft across %s", field => {
  /** Same visible text alone is insufficient to bind an unsent answer. */
  const draft = editLiveRaceDraft(view.run!.currentRiddle!, createLiveRaceDraft(view.run!.currentRiddle!), "text", "te");
  /** A new authority binding must start with its own empty cells. */
  const next = structuredClone(view);
  if (field === "seat") next.ticketId = "b".repeat(64);
  if (field === "run") next.run!.runId = "run-2";
  if (field === "locale") next.run!.locale = "fr";
  if (field === "riddle") next.run!.currentRiddle!.riddleId = "question-2";
  if (field === "position") next.run!.currentRiddle!.position = 1;
  if (field === "width") next.run!.currentRiddle!.answerLength = 5;
  if (field === "terminal") {next.phase = "result"; next.run!.currentRiddle = null;}
  expect(reconcileLiveRaceDraft(draft, view, next).letters).toEqual(field === "terminal" ? [] : Array(field === "width" ? 5 : 4).fill(""));
});

it("replaces newly locked hint letters and repairs their selected slot without losing remaining input", () => {
  /** Local wrong first letter cannot override a server-confirmed reveal. */
  let draft = editLiveRaceDraft(view.run!.currentRiddle!, createLiveRaceDraft(view.run!.currentRiddle!), "text", "xe");
  draft = editLiveRaceDraft(view.run!.currentRiddle!, draft, "slot", 0);
  /** Paid host hint locks the selected cell. */
  const next = structuredClone(view); next.run!.currentRiddle!.revealedLetters = [{index: 0, letter: "t"}];
  expect(reconcileLiveRaceDraft(draft, view, next)).toMatchObject({letters: ["t", "e", "", ""], activeSlotIndex: 2, revision: draft.revision});
});

it.each(["untouched", "new-word", "emptied", "focus", "ignored"])("rejecting a live guess preserves the correct draft intent (%s)", edit => {
  /** Submitted word is immutable while its transport receipt is outstanding. */
  const prompt = view.run!.currentRiddle!;
  /** Original word kept independently of the new editable attempt. */
  const submitted = editLiveRaceDraft(prompt, createLiveRaceDraft(prompt), "text", "zzzz");
  /** The live UI clears only its next editable attempt, retaining the original command separately. */
  let draft = createLiveRaceDraft(prompt, submitted.revision);
  if (edit === "new-word" || edit === "emptied") draft = editLiveRaceDraft(prompt, draft, "text", "te");
  if (edit === "emptied") {draft = editLiveRaceDraft(prompt, draft, "backspace", ""); draft = editLiveRaceDraft(prompt, draft, "backspace", "");}
  if (edit === "focus") draft = editLiveRaceDraft(prompt, draft, "slot", 2);
  if (edit === "ignored") draft = editLiveRaceDraft(prompt, draft, "text", " ");
  /** Detects accidental mutation of the original submitted checkpoint. */
  const before = structuredClone(submitted);
  expect(rejectLiveRaceDraft(draft, submitted).letters).toEqual(edit === "new-word" ? ["t", "e", "", ""] : edit === "emptied" ? Array(4).fill("") : ["z", "z", "z", "z"]);
  expect(submitted).toEqual(before);
});

it("keeps ignored input and clock reconciliation from advancing the local edit revision", () => {
  /** Revisions track letters rather than transport timing or selected focus. */
  const prompt = view.run!.currentRiddle!, draft = createLiveRaceDraft(prompt);
  expect(editLiveRaceDraft(prompt, draft, "slot", -1)).toBe(draft);
  expect(editLiveRaceDraft(prompt, draft, "text", " ")).toBe(draft);
  expect(reconcileLiveRaceDraft(draft, view, {...view, serverNowMs: 2000})).toBe(draft);
});


it.each([["te", 0, "t", "st", 2], ["tes", 2, "s", "t", 3]] as const)("continues after hint locking %s at %s", (prefix, index, letter, suffix, target) => {
  /** Selecting an earlier filled letter must not discard the rest of the unsent word. */
  const prompt = view.run!.currentRiddle!;
  /** Existing prefix remains player-owned while a hint is in flight. */
  const filled = editLiveRaceDraft(prompt, createLiveRaceDraft(prompt), "text", prefix);
  /** Deliberate selection can point at a populated cell that the hint later locks. */
  const selected = editLiveRaceDraft(prompt, filled, "slot", index);
  /** A newly confirmed hint locks the selected cell while the next cell is already filled. */
  const next = structuredClone(view); next.run!.currentRiddle!.revealedLetters = [{index, letter}];
  /** Hint recovery must choose empty space before replacing existing input. */
  const recovered = reconcileLiveRaceDraft(selected, view, next);
  expect(recovered.activeSlotIndex).toBe(target);
  expect(editLiveRaceDraft(next.run!.currentRiddle!, recovered, "text", suffix).letters.join("")).toBe("test");
});
