import {beforeEach, expect, it, jest} from "@jest/globals";

/** Browser storage retained across simulated account switches. */
let mockSaved: string | null = null;
/** A different tab replaces the value immediately after one storage read. */
let mockAfterRead: string | undefined;
jest.mock("../../playerPreferences", () => ({
  /** Reads the shared browser's saved run. */
  safeBrowserStorageGet: () => {
    /** Exact snapshot returned to this caller before another tab writes. */
    const snapshot = mockSaved;
    if (mockAfterRead !== undefined) {mockSaved = mockAfterRead; mockAfterRead = undefined;}
    return snapshot;
  },
  /** Writes the shared browser's saved run. */
  safeBrowserStorageSet: (_kind: string, _key: string, value: string) => { mockSaved = value; },
  /** Clears the shared browser's saved run. */
  safeBrowserStorageRemove: () => { mockSaved = null; },
}));

jest.mock("../../../platform/browserStorage", () => ({
  /** Observes the same shared snapshot through the strict browser read adapter. */
  observeBrowserStorage: () => {
    /** Value returned before a competing tab writes its replacement. */
    const snapshot = mockSaved;
    if (mockAfterRead !== undefined) {mockSaved = mockAfterRead; mockAfterRead = undefined;}
    return snapshot;
  },
}));

import {readActiveRace, saveActiveRace, clearActiveRace} from "../logic/activeRaceStorage";

it("preserves a newer hint for the same account when an older race is cleared", () => {
  saveActiveRace("alice", "newer-run");
  clearActiveRace("alice", "older-run");
  expect(readActiveRace("alice")).toBe("newer-run");
  clearActiveRace("alice", "newer-run");
  expect(readActiveRace("alice")).toBeNull();
});

beforeEach(() => { mockSaved = null; mockAfterRead = undefined; });

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

it("preserves a replacement account hint when malformed legacy cleanup observes an older snapshot", () => {
  mockSaved = "old-malformed-hint"; mockAfterRead = JSON.stringify({ownerId: "bob", runId: "new-run"});
  expect(readActiveRace("alice")).toBeNull();
  expect(readActiveRace("bob")).toBe("new-run");
});
it.each(["alice", "bob"])("preserves a hint replaced after the cleanup read, new owner=%s", ownerId => {
  saveActiveRace("alice", "old-run"); mockAfterRead = JSON.stringify({ownerId, runId: "new-run"});
  clearActiveRace("alice", "old-run"); expect(readActiveRace(ownerId)).toBe("new-run");
});
it.each([" ", "x".repeat(161)])("ignores invalid persisted authority run IDs: %s", runId => {
  mockSaved = JSON.stringify({ownerId: "alice", runId}); expect(readActiveRace("alice")).toBeNull();
});
it("normalizes a recoverable padded run identifier before it becomes request ownership", () => {
  mockSaved = JSON.stringify({ownerId: "alice", runId: "  owned-run  "}); expect(readActiveRace("alice")).toBe("owned-run");
});
