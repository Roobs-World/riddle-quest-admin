import {beforeEach, expect, it, jest} from "@jest/globals";

/** Browser storage retained across simulated account switches. */
let mockSaved: string | null = null;
jest.mock("../../playerPreferences", () => ({
  /** Reads the shared browser's saved run. */
  safeBrowserStorageGet: () => mockSaved,
  /** Writes the shared browser's saved run. */
  safeBrowserStorageSet: (_kind: string, _key: string, value: string) => { mockSaved = value; },
  /** Clears the shared browser's saved run. */
  safeBrowserStorageRemove: () => { mockSaved = null; },
}));

import {readActiveRace, saveActiveRace, clearActiveRace} from "../logic/activeRaceStorage";

it("preserves a newer hint for the same account when an older race is cleared", () => {
  saveActiveRace("alice", "newer-run");
  clearActiveRace("alice", "older-run");
  expect(readActiveRace("alice")).toBe("newer-run");
  clearActiveRace("alice", "newer-run");
  expect(readActiveRace("alice")).toBeNull();
});

beforeEach(() => { mockSaved = null; });

it("resumes only the authenticated owner's run after an account switch", () => {
  saveActiveRace("alice", "alice-run");
  expect(readActiveRace("alice")).toBe("alice-run");
  expect(readActiveRace("bob")).toBeNull();
  expect(readActiveRace(undefined)).toBeNull();
});

it("discards legacy ownerless run IDs rather than sending them to the server", () => {
  mockSaved = "another-players-run";
  expect(readActiveRace("bob")).toBeNull();
  expect(mockSaved).toBeNull();
});

it("does not let a stale tab clear another player's newly saved run", () => {
  saveActiveRace("bob", "bob-run");
  clearActiveRace("alice");
  expect(readActiveRace("bob")).toBe("bob-run");
  clearActiveRace("bob");
  expect(readActiveRace("bob")).toBeNull();
});

it("does not persist a run without an authenticated owner", () => {
  saveActiveRace(undefined, "unknown-run");
  expect(mockSaved).toBeNull();
});
