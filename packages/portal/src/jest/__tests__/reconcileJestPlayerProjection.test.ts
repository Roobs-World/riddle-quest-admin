import {expect, it} from "@jest/globals";
import {reconcileJestPlayerProjection} from "../reconcileJestPlayerProjection";
import {createSavedGame} from "@qwordly/hosted/play/GameSessionCheckpoints";
import {createInitialGameSession, gameSessionReducer} from "@qwordly/hosted/play/gameSession";

/** Validated client checkpoint from the real reducer. */
const checkpoint = (letters: string, savedAt: number, sessionToken = "00000000-0000-4000-8000-000000000001") => {
  /** Authority-issued session provides the resume identity. */
  let state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
    riddleId: "question", sessionToken, text: "Clue", answerLength: 5, gameMode: "classic",
    attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false,
  }});
  for (const letter of letters) state = gameSessionReducer(state, {type: "typeLetter", letter});
  return createSavedGame(state, savedAt);
};
/** Newly hydrated authority profile must be retained independently of local draft freshness. */
const profile = {username: "New", coins: 80, level: 1, xp: 0, winStreak: 0,
  gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1};

it("retains a newer same-session draft with the newly hydrated authority profile", () => {
  /** Provider read precedes the latest accepted local edit. */
  const incoming = {schemaVersion: 1 as const, updatedAt: 100, profile, activeGame: checkpoint("P", 1)};
  /** Local progress does not carry an older cached economy profile into startup. */
  const previous = {schemaVersion: 1 as const, updatedAt: 2, profile: {...profile, coins: 900}, activeGame: checkpoint("PIAN", 2)};
  expect(reconcileJestPlayerProjection(previous, incoming)).toMatchObject({profile, activeGame: {currentLetters: ["P", "I", "A", "N", ""]}});
});

it("retains an unsaved draft after a provider read returns no active checkpoint", () => {
  /** Guest draft can still be pending when registration restarts startup for the same target player. */
  const previous = {schemaVersion: 1 as const, updatedAt: 2, activeGame: checkpoint("PIAN", 2)};
  expect(reconcileJestPlayerProjection(previous, null)).toMatchObject({activeGame: {currentLetters: ["P", "I", "A", "N", ""]}});
});

it("prefers a different provider-issued session and newer same-session checkpoints", () => {
  /** Latest local accepted draft belongs to the earlier provider state. */
  const previous = {schemaVersion: 1 as const, updatedAt: 2, activeGame: checkpoint("PIAN", 2)};
  /** Newer SDK checkpoints already replace the local draft. */
  const newer = {schemaVersion: 1 as const, updatedAt: 3, activeGame: checkpoint("PIANO", 3)};
  expect(reconcileJestPlayerProjection(previous, newer)).toBe(newer);
  /** Another issued session cannot be overwritten even if its stored clock appears older. */
  const successor = {schemaVersion: 1 as const, updatedAt: 1, activeGame: checkpoint("", 1, "00000000-0000-4000-8000-000000000002")};
  expect(reconcileJestPlayerProjection(previous, successor)).toBe(successor);
});

it("keeps an accepted completion clear over an older stored checkpoint", () => {
  /** Acknowledged completion supersedes an earlier provider read. */
  const cleared = {schemaVersion: 1 as const, updatedAt: 3, activeGame: null};
  /** SDK storage has not acknowledged the clear yet. */
  const incoming = {schemaVersion: 1 as const, updatedAt: 100, activeGame: checkpoint("PIAN", 2)};
  expect(reconcileJestPlayerProjection(cleared, incoming)?.activeGame).toBeNull();
  /** A checkpoint actually created after the clear represents later progress. */
  const newer = {...incoming, activeGame: checkpoint("PI", 4)};
  expect(reconcileJestPlayerProjection(cleared, newer)).toBe(newer);
});
