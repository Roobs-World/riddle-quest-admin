import {commitJestStartupSession} from "../commitJestStartupSession";
import {createNotificationOperationGate} from "../notifications/operationGate";
import {setLocaleAndWait} from "../../play/i18n";
import type {JestSession} from "../types";

jest.mock("../../play/i18n", () => ({
  ...jest.requireActual("../../play/i18n"),
  setLocaleAndWait: jest.fn(),
}));

/** Controls independent startup reads without relying on wall-clock timing. */
const deferred = <T,>() => {
  /** Completes a controlled read. */
  let resolve!: (value: T) => void;
  /** Rejects a controlled read. */
  let reject!: (error: Error) => void;
  /** Pending read observed by startup. */
  const promise = new Promise<T>((done, fail) => {resolve = done; reject = fail;});
  return {promise, resolve, reject};
};

/** Signed session whose local balance must not replace authoritative progress. */
const session: JestSession = {
  firebaseUid: "uid", player: {playerId: "player", registered: true}, profile: null,
  entryIntent: {}, preferences: {locale: "tr"}, playerData: null, firebaseAuthenticated: true,
};

/** Provides isolated collaborators with pending translation and profile reads. */
const fixture = () => {
  /** Translation readiness independent from the profile read. */
  const locale = deferred<void>();
  /** Authoritative profile readiness. */
  const profile = deferred<JestSession>();
  jest.mocked(setLocaleAndWait).mockReturnValue(locale.promise);
  /** Deletion gate held while preparing the session. */
  const gate = createNotificationOperationGate({crossContextLock: null, deletionPending: () => false,
    deletionEpoch: () => null, requireCrossContextLock: false});
  /** Signals when preparation begins under the shared gate. */
  const started = deferred<void>();
  /** Starts the profile read without waiting for translated namespaces. */
  const prepareSession = jest.fn(() => {started.resolve(); return profile.promise;});
  /** Observes all state exposed by the commit. */
  const effects = {enablePlayerStateWrites: jest.fn(), setSession: jest.fn(),
    setEngagementProgress: jest.fn(), trackFunnel: jest.fn()};
  return {locale, profile, gate, started, prepareSession, effects};
};

beforeEach(() => jest.clearAllMocks());

it.each(["locale", "profile"] as const)("starts reads together and waits for both when %s finishes first", async (first) => {
  /** Independently controlled reads. */
  const f = fixture();
  /** Hydrated progress replaces the local snapshot before any writes or mount. */
  const hydrated: JestSession = {...session, playerData: {schemaVersion: 1, updatedAt: 1,
    profile: {coins: 300, level: 7, winStreak: 3, wins: 12}}};
  /** In-flight commit holds both required reads. */
  const commit = commitJestStartupSession({gate: f.gate, isActive: () => true,
    session, prepareSession: f.prepareSession, ...f.effects});
  await f.started.promise;
  expect(setLocaleAndWait).toHaveBeenCalledWith("en");
  expect(f.prepareSession).toHaveBeenCalledWith({...session, preferences: {locale: "en"}}, "en");
  if (first === "locale") f.locale.resolve(); else f.profile.resolve(hydrated);
  await Promise.resolve();
  expect(f.effects.enablePlayerStateWrites).not.toHaveBeenCalled();
  expect(f.effects.setSession).not.toHaveBeenCalled();
  if (first === "locale") f.profile.resolve(hydrated); else f.locale.resolve();
  await expect(commit).resolves.toBe(true);
  expect(f.effects.enablePlayerStateWrites).toHaveBeenCalledWith(hydrated.playerData, hydrated.player.playerId);
  expect(f.effects.setSession).toHaveBeenCalledWith({...hydrated, preferences: {locale: "en"}});
  expect(f.effects.setEngagementProgress).toHaveBeenCalledWith({level: 7, winStreak: 3, wins: 12});
});

it("does not mount or enable writes when the mandatory server profile fails", async () => {
  /** Required profile read fails after translated content is ready. */
  const f = fixture();
  /** Failure must be observed by the app's retry handling. */
  const commit = commitJestStartupSession({gate: f.gate, isActive: () => true,
    session, prepareSession: f.prepareSession, ...f.effects});
  await f.started.promise;
  f.locale.resolve();
  f.profile.reject(new Error("jest-initial-profile-unavailable"));
  await expect(commit).rejects.toThrow("jest-initial-profile-unavailable");
  expect(f.effects.enablePlayerStateWrites).not.toHaveBeenCalled();
  expect(f.effects.setSession).not.toHaveBeenCalled();
});

it.each(["unmount", "deletion"])("does not expose a completed profile after %s", async (cancel) => {
  /** Session preparation is still pending when cancellation wins. */
  const f = fixture();
  /** Reflects the mounted startup attempt. */
  let active = true;
  /** Tracks the session commit waiting for its reads. */
  const commit = commitJestStartupSession({gate: f.gate, isActive: () => active,
    session, prepareSession: f.prepareSession, ...f.effects});
  await f.started.promise;
  if (cancel === "unmount") active = false; else f.gate.close();
  f.locale.resolve(); f.profile.resolve(session);
  await expect(commit).resolves.toBe(false);
  expect(f.effects.enablePlayerStateWrites).not.toHaveBeenCalled();
  expect(f.effects.setSession).not.toHaveBeenCalled();
});

it("does not start authenticated reads when deletion has already closed the gate", async () => {
  /** Closed gate prevents preloading and profile hydration. */
  const f = fixture();
  f.gate.close();
  await expect(commitJestStartupSession({gate: f.gate, isActive: () => true,
    session, prepareSession: f.prepareSession, ...f.effects})).resolves.toBe(false);
  expect(f.prepareSession).not.toHaveBeenCalled();
  expect(setLocaleAndWait).not.toHaveBeenCalled();
});
