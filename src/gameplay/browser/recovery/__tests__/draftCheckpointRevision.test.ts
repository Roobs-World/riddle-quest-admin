import {expect, it} from "@jest/globals";
import {createInitialGameSession, gameSessionReducer} from "../../../session/gameSession";
import {createSavedGame, GameSessionCheckpoints} from "../../../session/checkpoints/GameSessionCheckpoints";
import {parseDraftCheckpointRevision} from "../../../session/checkpoints/draftCheckpointRevision";
import {preferProviderDraft} from "../../../session/checkpoints/draftCheckpointReconciliation";
import {createJournalWriter} from "../../../session/journal/journalWriter";
import {createPendingPlayJournalStorage} from "../../../session/journal/pendingPlayJournalDiagnostics";
import {readPendingGuessJournal} from "../../../session/journal/readPendingGuessJournal";
import {writePendingGuessJournal, acquirePendingPlayLease, releasePendingPlayLease, createRejectedPlayDraft} from "../../../session/journal/pendingGuessJournal";
import {parseSavedGame} from "../../../../accounts/browser/playerState/playerDataValidation";

/** One question shares a real reducer, guarded journal writer and provider projection. */
function fixture() {
  /** Independent durable bytes survive replacement views. */
  const values = new Map<string, string>();
  /** Both readers use the same concrete storage operations. */
  const storage = {getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {values.set(key, value);}, removeItem: (key: string) => {values.delete(key);}};
  /** Retirement revokes the original writer without changing its captured predecessor. */
  let live = true;
  /** One account and locale own the guarded writer. */
  const scope = "Alice:1:en", writer = createJournalWriter({storage, owner: "first-view", now: () => 1000,
    owns: candidate => live && candidate === scope,
    operations: [readPendingGuessJournal, writePendingGuessJournal, acquirePendingPlayLease, releasePendingPlayLease]});
  /** The authority-issued question permits ordinary confirmed draft input. */
  let state = gameSessionReducer({...createInitialGameSession(), user: {uid: "Alice", isAnonymous: true}},
    {type: "loadRiddle", riddle: {riddleId: "piano", sessionToken: "00000000-0000-4000-8000-000000000001",
      text: "Keys", answerLength: 5, gameMode: "classic", index: 1, attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false}});
  for (const letter of "PI") state = gameSessionReducer(state, {type: "typeLetter", letter});
  if (!state.riddle) throw new Error("The issued question must exist.");
  /** The old journal acknowledges only the first two letters. */
  const journal = writer.create(state, scope, state.riddle, state);
  expect(writer.read(scope)).toBeNull();
  expect(writer.write(journal)).toBe(true);
  /** Further accepted input changes the same recovery lineage. */
  let latest = state;
  for (const letter of "AN") latest = gameSessionReducer(latest, {type: "typeLetter", letter});
  /** The independent provider successfully stores the newer complete prefix. */
  const saved = createSavedGame(latest, 1);
  if (!saved) throw new Error("The active provider checkpoint must exist.");
  return {state, latest, saved, journal, writer, scope, storage, retire: () => {live = false;}};
}

it("prefers a newer durable provider draft without a pagehide or successful journal retry", () => {
  /** Independent durable projections expose the ordering decision. */
  const {journal, saved} = fixture();
  expect(journal.draft).toEqual(["P", "I", "", "", ""]);
  expect(saved.currentLetters).toEqual(["P", "I", "A", "N", ""]);
  expect(journal.draftRevision?.sequence).toBe(2);
  expect(saved.draftRevision?.sequence).toBe(4);
  expect(preferProviderDraft(journal, saved)).toBe(true);
});

it("orders shorter drafts by revision rather than length or wall time", () => {
  /** Deletion can create newer input with fewer letters. */
  const {latest, saved, journal} = fixture();
  /** A real backspace advances input order. */
  const shorter = gameSessionReducer(latest, {type: "backspace"});
  /** A backwards wall clock cannot reverse logical input order. */
  const shorterSave = createSavedGame(shorter, 0);
  expect(preferProviderDraft({...journal, draft: latest.currentLetters, draftRevision: latest.draftRevision}, shorterSave)).toBe(true);
  expect(preferProviderDraft({...journal, draft: shorter.currentLetters, draftRevision: shorter.draftRevision}, saved)).toBe(false);
});

it("retains a newer shorter draft and its revision when queued play is rejected", () => {
  /** A provider checkpoint predates the player's latest backspace. */
  const {latest, saved, journal} = fixture();
  /** Rejection must preserve the same-question edit rather than the old journal prefix. */
  const shorter = gameSessionReducer(latest, {type: "backspace"});
  /** Production rollback constructs the retained draft. */
  const retained = createRejectedPlayDraft(journal, shorter);
  if (!retained) throw new Error("The same-question draft must remain recoverable.");
  expect(retained.draft).toEqual(["P", "I", "A", "", ""]);
  expect(retained.draftRevision?.sequence).toBe(5);
  expect(preferProviderDraft(retained, saved)).toBe(false);
  expect(gameSessionReducer(latest, {type: "restoreQueuedGuesses", base: retained.base, guesses: [],
    draft: retained.draft, draftActiveSlotIndex: retained.draftActiveSlotIndex,
    draftRevision: retained.draftRevision}).draftRevision?.sequence).toBe(5);
});

it("keeps a confirmed base's revision separate from later type-ahead input", () => {
  /** The complete draft is submitted before a new answer is composed. */
  const {latest} = fixture();
  /** The fifth character produces the original accepted input revision. */
  const complete = gameSessionReducer(latest, {type: "typeLetter", letter: "O"});
  /** A wrong-guess preview permits independent type-ahead while confirmation is pending. */
  let pending = gameSessionReducer({...complete, riddle: {...complete.riddle!, evaluation: {answer: "whisk", locale: "en"}}}, {type: "guessRequested"});
  for (const letter of "AB") pending = gameSessionReducer(pending, {type: "typeLetter", letter});
  expect(pending.draftRevision.sequence).toBe(7);
  expect(createSavedGame(pending, 1)?.draftRevision?.sequence).toBe(5);
  pending = gameSessionReducer(pending, {type: "guessCheckpointAdvanced", feedback: {guess: [..."PIANO"],
    feedback: ["red", "red", "red", "red", "red"]}, attempts: 1, isCorrect: false, gameOver: false, canContinue: false});
  expect(pending.pendingGuessState?.draftRevision?.sequence).toBe(5);
  expect(createSavedGame(pending, 1)?.draftRevision?.sequence).toBe(5);
});

it.each(["guess", "hint", "continue", "skip", "skip-preview", "successor"])("preserves %s delivery ownership even with a newer provider draft", kind => {
  /** Independent durable projections expose the ordering decision. */
  const {journal, saved} = fixture();
  /** Required requests keep their exact issued question identity. */
  const payload = {riddleId: journal.riddle.riddleId, sessionToken: journal.riddle.sessionToken, gameMode: "classic" as const};
  if (kind === "guess") journal.queue.push({message: {type: "game:submitGuess", requestId: "guess-owned",
    payload: {...payload, requestId: "guess-owned", guess: "PIANO"}}, attempts: 1, isCorrect: true, gameOver: true,
    canContinue: false, feedback: ["green", "green", "green", "green", "green"]});
  else if (kind === "hint") journal.coinAction = {type: "game:requestHint", requestId: "hint-owned",
    payload: {...payload, requestId: "hint-owned", currentAttempt: journal.draft}};
  else if (kind === "continue") journal.coinAction = {type: "game:spendCoins", requestId: "continue-owned", payload: {...payload, reason: "continue"}};
  else if (kind === "skip") journal.coinAction = {type: "game:skipRiddle", requestId: "skip-owned", payload: {...payload, gameMode: "classic"}};
  else if (kind === "skip-preview") journal.skipPreview = {requestId: "skip-owned", sessionToken: payload.sessionToken, riddle: journal.riddle};
  else journal.successors.push({riddle: journal.riddle, base: journal.base, draft: journal.draft});
  expect(preferProviderDraft(journal, saved)).toBe(false);
});

it.each(["legacy", "tie", "other-origin", "other-session", "other-mode", "other-riddle", "other-attempt", "hint"])("keeps conservative recovery for %s", kind => {
  /** Independent durable projections expose the ordering decision. */
  const {journal, saved} = fixture();
  if (kind === "legacy") delete journal.draftRevision;
  if (kind === "tie") saved.draftRevision = journal.draftRevision;
  if (kind === "other-origin") saved.draftRevision = {origin: "independent-view", sequence: 100};
  if (kind === "other-session") saved.sessionToken = "00000000-0000-4000-8000-000000000002";
  if (kind === "other-mode") saved.gameMode = "challenge";
  if (kind === "other-riddle") saved.riddleId = "another";
  if (kind === "other-attempt") saved.engineSnapshot.attemptsUsed = 1;
  if (kind === "hint") journal.riddle.revealedHints = [{index: 4, letter: "O"}];
  expect(preferProviderDraft(journal, saved)).toBe(false);
});

it("restores the provider revision and continues the same logical input sequence", () => {
  /** The replacement owner begins with a matching provider checkpoint. */
  const {saved, latest} = fixture();
  /** A fresh reducer has not yet restored the persisted lineage. */
  const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: latest.riddle!});
  /** Production checkpoint policy supplies the matching restore action. */
  const decision = new GameSessionCheckpoints().update(loaded, saved);
  if (decision?.kind !== "restore") throw new Error("A matching checkpoint must restore.");
  /** The real reducer adopts persisted input ordering. */
  const restored = gameSessionReducer(loaded, decision.action);
  expect(restored.draftRevision).toEqual(latest.draftRevision);
  /** The next player edit continues the adopted sequence. */
  const next = gameSessionReducer(restored, {type: "typeLetter", letter: "O"});
  expect(next.draftRevision).toEqual({...latest.draftRevision, sequence: latest.draftRevision.sequence + 1});
  expect(gameSessionReducer(next, {type: "openModal", modal: "settings"}).draftRevision).toBe(next.draftRevision);
});

it.each([null, [], {origin: "", sequence: 1}, {origin: "x", sequence: -1}, {origin: "x", sequence: Number.MAX_SAFE_INTEGER + 1}])(
  "ignores malformed optional revisions without losing saved progress or required requests (%j)", revision => {
    /** Malformed optional metadata must preserve valid progress and paid work. */
    const {saved, journal, storage, scope} = fixture();
    expect(parseDraftCheckpointRevision(revision)).toBeUndefined();
    expect(parseSavedGame({...saved, draftRevision: revision})).toMatchObject({currentLetters: ["P", "I", "A", "N", ""]});
    journal.coinAction = {type: "game:skipRiddle", requestId: "skip-required",
      payload: {riddleId: journal.riddle.riddleId, sessionToken: journal.riddle.sessionToken, gameMode: "classic"}};
    storage.setItem("riddleQuest:pendingPlay:v1:" + scope, JSON.stringify({...journal, draftRevision: revision,
      base: {...journal.base, draftRevision: revision}}));
    expect(readPendingGuessJournal(scope, storage)).toMatchObject({coinAction: {requestId: "skip-required"}});
    expect(readPendingGuessJournal(scope, storage)?.draftRevision).toBeUndefined();
    expect(readPendingGuessJournal(scope, storage)?.base.draftRevision).toBeUndefined();
  },
);

it.each(["other-tab", "retired"])("keeps guarded convergence from overwriting a %s predecessor", kind => {
  /** Convergence still uses the original guarded writer. */
  const {journal, saved, writer, latest, scope, storage, retire} = fixture();
  expect(preferProviderDraft(journal, saved)).toBe(true);
  /** Another tab owns a separately idempotent paid request. */
  const replacement = {...journal, draft: ["S", "", "", "", ""], coinAction: {type: "game:skipRiddle" as const,
    requestId: "skip-other-tab", payload: {riddleId: journal.riddle.riddleId, sessionToken: journal.riddle.sessionToken, gameMode: "classic" as const}}};
  if (kind === "other-tab") expect(createPendingPlayJournalStorage(storage).write(replacement)).toBe(true);
  else retire();
  /** Exact durable bytes must remain unchanged after a rejected write. */
  const before = storage.getItem("riddleQuest:pendingPlay:v1:" + scope);
  writer.checkpoint(scope, latest, journal, latest);
  expect(storage.getItem("riddleQuest:pendingPlay:v1:" + scope)).toBe(before);
});
