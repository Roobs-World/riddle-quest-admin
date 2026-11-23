import {beforeEach, expect, it, jest} from "@jest/globals";
import {raceMatchFailure} from "../../../../core/race";
/** Storage key observed at the real browser-persistence seam. */
let mockKey: string | null = null;
/** Serialized recovery hint shared across simulated tab lifetimes. */
let mockSaved: string | null = null;
/** A different tab replaces the value immediately after one storage read. */
let mockAfterRead: string | undefined;
jest.mock("../../playerPreferences", () => ({
  safeBrowserStorageGet: () => {
    /** Exact snapshot returned to this caller before another tab writes. */
    const snapshot = mockSaved;
    if (mockAfterRead !== undefined) {mockSaved = mockAfterRead; mockAfterRead = undefined;}
    return snapshot;
  },
  safeBrowserStorageSet: (_area: string, key: string, value: string) => {mockKey = key; mockSaved = value;},
  safeBrowserStorageRemove: () => {mockSaved = null;},
}));
jest.mock("../../../platform/browserStorage", () => ({
  /** Observes a shared serialized journal before a competing tab changes it. */
  observeBrowserStorage: () => {
    /** Exact revision returned to the observing lifetime. */
    const snapshot = mockSaved;
    if (mockAfterRead !== undefined) {mockSaved = mockAfterRead; mockAfterRead = undefined;}
    return snapshot;
  },
}));
import {browserRaceRecovery, parseRaceRecovery, RACE_RECOVERY_KEY, RACE_RECOVERY_TTL_MS, type RaceRecovery} from "../logic/raceRecoveryStorage";
/** Complete owner-bound search receipt with a bounded retry deadline. */
const record: RaceRecovery = {version: 1, id: "revision-1", ownerId: "alice", locale: "en", savedAtMs: 1000,
  expiresAtMs: 1000 + RACE_RECOVERY_TTL_MS, intent: {kind: "search", request: {locale: "en", requestId: "request-1", categoryId: "history"},
    failure: raceMatchFailure("temporarily-unavailable", 5000), retryAtMs: 6000}};
beforeEach(() => {mockSaved = null; mockAfterRead = undefined;});
it("binds hints to account, language and bounded retention", () => {
  browserRaceRecovery.save(record);
  expect(mockKey).toBe(RACE_RECOVERY_KEY);
  expect(browserRaceRecovery.read("alice", "en", 2000)).toEqual(record);
  expect(browserRaceRecovery.read("bob", "en", 2000)).toBeNull();
  expect(browserRaceRecovery.read("alice", "fr", 2000)).toBeNull();
  expect(browserRaceRecovery.read(undefined, "en", 2000)).toBeNull();
  expect(browserRaceRecovery.read("alice", "en", record.expiresAtMs)).toBeNull();
  expect(browserRaceRecovery.read("alice", "en", 999)).toBeNull();
});
it("keeps newer tab revisions and other accounts during cleanup", () => {
  browserRaceRecovery.save({...record, id: "revision-2"});
  browserRaceRecovery.clear("alice", "revision-1");
  browserRaceRecovery.clear("bob", "revision-2");
  expect(browserRaceRecovery.read("alice", "en", 2000)?.id).toBe("revision-2");
  browserRaceRecovery.clear("alice", "revision-2");
  expect(mockSaved).toBeNull();
});
it.each([
  {...record, intent: {kind: "search", request: {locale: "en"}}}, {...record, version: 99}, {...record, expiresAtMs: Infinity}, {...record, expiresAtMs: 1000},
  {...record, expiresAtMs: record.expiresAtMs + 1}, {...record, answers: ["private"]},
  {...record, intent: {kind: "challenge", challengeId: "challenge", score: 100}},
  {...record, intent: {kind: "search", request: {locale: "fr", requestId: "request-1"}}},
  {...record, intent: {kind: "start", request: {locale: "en", categoryId: "history"}}},
])("ignores invalid, incompatible or answer-bearing hints: %j", value => {
  expect(parseRaceRecovery(value, "alice", "en", 2000)).toBeNull();
  mockSaved = JSON.stringify(value);
  expect(browserRaceRecovery.read("alice", "en", 2000)).toBeNull();
});
it("tolerates unavailable, malformed and oversized browser storage", () => {
  mockSaved = "broken";
  expect(browserRaceRecovery.read("alice", "en", 2000)).toBeNull();
  browserRaceRecovery.clear("alice", "revision-1");
  mockSaved = "x".repeat(4097);
  expect(browserRaceRecovery.read("alice", "en", 2000)).toBeNull();
  browserRaceRecovery.clear("alice", "revision-1");
});

it.each(["alice", "bob"])("preserves a revision replaced after the cleanup read, new owner=%s", ownerId => {
  browserRaceRecovery.save(record); mockAfterRead = JSON.stringify({...record, ownerId, id: "revision-2"});
  browserRaceRecovery.clear("alice", record.id);
  expect(browserRaceRecovery.read(ownerId, "en", 2000)?.id).toBe("revision-2");
});
