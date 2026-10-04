import {beforeEach, expect, it, jest} from "@jest/globals";
import type {JestPlatformPort, JestSession} from "../types";
import type {NotificationCrossContextLock} from "../notifications/operationGate";

/** Describes effect. */
type Effect = () => void | (() => void);
/** Provides effects behavior. */
const effects: Effect[] = [];

jest.mock("react", () => ({
  useCallback: <Callback>(callback: Callback) => callback,
  useEffect: (effect: Effect) => effects.push(effect),
  useMemo: <Value>(factory: () => Value) => factory(),
  useRef: <Value>(value: Value) => ({current: value}),
}));

import {createNotificationOperationGate} from "../notifications/operationGate";
import {useJestPlayerStateWrites} from "../useJestPlayerStateWrites";
import {setPlayerMuted, setPlayerHighContrast, setPlayerReducedMotion} from "../../play/playerPreferences";

/** Provides session behavior. */
const session = (): JestSession => ({
  player: {playerId: "player-1", registered: true},
  profile: null,
  entryIntent: {},
  preferences: {},
  playerData: null,
  firebaseAuthenticated: true,
});

beforeEach(() => {
  effects.length = 0;
  jest.clearAllMocks();
});

it("blocks a queued SDK write after deletion and suppresses later local state mutation", async () => {
  /** Provides epoch behavior. */
  let epoch = "before";
  /** Provides enter shared behavior. */
  let enterShared: (() => Promise<unknown>) | undefined;
  /** Provides cross context lock behavior. */
  const crossContextLock: NotificationCrossContextLock = {
    runShared: (operation) =>
      new Promise((resolve, reject) => {
        enterShared = () => operation().then(resolve, reject);
      }),
    runExclusive: (operation) => operation(),
  };
  /** Provides gate behavior. */
  const gate = createNotificationOperationGate({
    crossContextLock,
    deletionEpoch: () => epoch,
    deletionPending: () => false,
  });
  /** Provides write player data behavior. */
  const writePlayerData = jest.fn(async () => undefined);
  /** Sets engagement progress. */
  const setEngagementProgress = jest.fn();
  /** Tracks failure. */
  const trackFailure = jest.fn();
  /** Provides warn behavior. */
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  /** Provides current session behavior. */
  const currentSession = session();
  /** Provides writes behavior. */
  const writes = useJestPlayerStateWrites({
    platform: {writePlayerData} as unknown as JestPlatformPort,
    gate,
    sessionRef: {current: currentSession},
    setSession: jest.fn(),
    setEngagementProgress,
    trackFailure,
  });
  writes.enable(null);

  writes.savePlayerData({activeGame: null});
  await new Promise<void>((resolve) => setImmediate(resolve));
  epoch = "after-deletion-request";
  await enterShared?.();
  await new Promise<void>((resolve) => setImmediate(resolve));

  expect(writePlayerData).not.toHaveBeenCalled();
  expect(trackFailure).toHaveBeenCalledWith("player_data_save_failed");
  writes.savePlayerData({profile: {level: 9, winStreak: 4, wins: 20}});
  expect(setEngagementProgress).not.toHaveBeenCalled();
  warn.mockRestore();
});

it("serializes rapid checkpoints and eventually flushes the newest snapshot", async () => {
  /** Provides gate behavior. */
  const gate = createNotificationOperationGate({
    crossContextLock: null,
    deletionEpoch: () => null,
    deletionPending: () => false,
    requireCrossContextLock: false,
  });
  /** Provides release first write behavior. */
  let releaseFirstWrite: () => void = () => undefined;
  /** Provides first write pending behavior. */
  const firstWritePending = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve;
  });
  /** Provides write player data behavior. */
  const writePlayerData = jest
    .fn()
    .mockImplementationOnce(() => firstWritePending)
    .mockResolvedValue(undefined);
  /** Provides current session behavior. */
  const currentSession = session();
  /** Provides writes behavior. */
  const writes = useJestPlayerStateWrites({
    platform: {writePlayerData} as unknown as JestPlatformPort,
    gate,
    sessionRef: {current: currentSession},
    setSession: jest.fn(),
    setEngagementProgress: jest.fn(),
    trackFailure: jest.fn(),
  });
  writes.enable(null);

  writes.savePlayerData({activeGame: {savedAt: 1} as never});
  await new Promise<void>((resolve) => setImmediate(resolve));
  writes.savePlayerData({activeGame: {savedAt: 2} as never});

  expect(writePlayerData).toHaveBeenCalledTimes(1);
  expect(writePlayerData.mock.calls[0]?.[0]).toMatchObject({activeGame: {savedAt: 1}});

  releaseFirstWrite();
  await writes.drainAndClear();
  expect(writePlayerData).toHaveBeenCalledTimes(2);
  expect(writePlayerData.mock.calls[1]?.[0]).toMatchObject({activeGame: {savedAt: 2}});
});

/** Pauses a real SDK acknowledgement without changing the hook's queue. */
const heldWrite = () => {
  /** Releases the controlled acknowledgement. */
  let release: () => void = () => undefined;
  /** Acknowledgement supplied by the target adapter. */
  const promise = new Promise<void>(resolve => {release = resolve;});
  return {promise, release};
};
/** Open real ownership gate used by SDK queue contracts. */
const openGate = () => createNotificationOperationGate({crossContextLock: null, deletionEpoch: () => null,
  deletionPending: () => false, requireCrossContextLock: false});
/** Constructs one hook owner with separately controlled SDK methods. */
const owner = (writePlayerData: JestPlatformPort["writePlayerData"], writePreferences: JestPlatformPort["writePreferences"] = async () => undefined) => {
  /** Mutable target session changes independently from old SDK acknowledgements. */
  const sessionRef = {current: session() as JestSession | null};
  /** Failure telemetry must be correlated with the active owner. */
  const trackFailure = jest.fn();
  /** React session updates must not be delivered by a retired drain. */
  const setSession = jest.fn();
  /** Hook interface accepts the same port as the Jest application. */
  const writes = useJestPlayerStateWrites({platform: {writePlayerData, writePreferences} as unknown as JestPlatformPort,
    gate: openGate(), sessionRef, setSession, setEngagementProgress: jest.fn(), trackFailure});
  writes.enable(null);
  return {writes, sessionRef, setSession, trackFailure};
};

it("merges 100 waiting draft edits and retains independent profile changes", async () => {
  /** Initial provider write remains fixed while input continues. */
  const held = heldWrite();
  /** SDK records full client projections. */
  const write = jest.fn<JestPlatformPort["writePlayerData"]>()
    .mockImplementationOnce(() => held.promise).mockResolvedValue(undefined);
  /** One hook instance owns the complete queued workload. */
  const {writes} = owner(write);
  writes.savePlayerData({activeGame: {savedAt: 1} as never});
  await new Promise<void>(resolve => setImmediate(resolve));
  for (let index = 2; index <= 101; index++) writes.savePlayerData({activeGame: {savedAt: index} as never});
  writes.savePlayerData({profile: {username: "Ada", coins: 300, level: 1, xp: 0, winStreak: 0,
    gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
  expect(write).toHaveBeenCalledTimes(1);
  expect(write.mock.calls[0][0]).toMatchObject({activeGame: {savedAt: 1}});
  held.release();
  await writes.drainAndClear();
  expect(write).toHaveBeenCalledTimes(2);
  expect(write.mock.calls[1][0]).toMatchObject({activeGame: {savedAt: 101}, profile: {username: "Ada", coins: 300}});
});

it.each([false, true])("retires waiting drafts on disable/re-enable, same player: %s", async samePlayer => {
  /** One already-entered SDK call precedes the retired waiting group. */
  const held = heldWrite();
  /** SDK records only calls that pass current ownership. */
  const write = jest.fn<JestPlatformPort["writePlayerData"]>()
    .mockImplementationOnce(() => held.promise).mockResolvedValue(undefined);
  /** Mutable current session supports both identity and visit replacement. */
  const {writes, sessionRef, trackFailure} = owner(write);
  writes.savePlayerData({activeGame: {savedAt: 1} as never});
  await new Promise<void>(resolve => setImmediate(resolve));
  writes.savePlayerData({activeGame: {savedAt: 2} as never});
  writes.disable();
  sessionRef.current = {...session(), player: {playerId: samePlayer ? "player-1" : "new-player", registered: false}};
  writes.enable(null);
  writes.savePlayerData({activeGame: {savedAt: 3} as never});
  held.release();
  await writes.drainAndClear();
  expect(write.mock.calls.map(([value]) => value.activeGame?.savedAt)).toEqual([1, 3]);
  expect(trackFailure).not.toHaveBeenCalled();
});

it("does not clear a new session when an earlier session drain finishes", async () => {
  /** Old SDK operation keeps the drain pending. */
  const held = heldWrite();
  /** SDK eventually acknowledges both distinct owners. */
  const write = jest.fn<JestPlatformPort["writePlayerData"]>()
    .mockImplementationOnce(() => held.promise).mockResolvedValue(undefined);
  /** New session data must survive completion of the old drain. */
  const {writes, sessionRef, setSession} = owner(write);
  writes.savePlayerData({activeGame: {savedAt: 1} as never});
  await new Promise<void>(resolve => setImmediate(resolve));
  /** Earlier drain must retain its own generation. */
  const draining = writes.drainAndClear();
  /** New session enables its own restored state while the old provider call is held. */
  const restored = {schemaVersion: 1 as const, updatedAt: 10, profile: {username: "New", coins: 80,
    level: 1, xp: 0, winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}};
  sessionRef.current = {...session(), player: {playerId: "new-player", registered: true}, preferences: {muted: true}, playerData: restored};
  writes.enable(restored);
  held.release();
  await draining;
  expect(sessionRef.current.preferences).toEqual({muted: true});
  expect(sessionRef.current.playerData).toBe(restored);
  expect(setSession).not.toHaveBeenCalled();
  writes.savePlayerData({activeGame: {savedAt: 3} as never});
  await writes.drainAndClear();
  expect(write.mock.calls[1][0]).toMatchObject({profile: {username: "New", coins: 80}, activeGame: {savedAt: 3}});
});

it("does not reuse another player's cached fields after an identity change without enable", async () => {
  /** SDK records the actual projections after target identity changes. */
  const write = jest.fn<JestPlatformPort["writePlayerData"]>().mockResolvedValue(undefined);
  /** Target session can be replaced independently of the startup callback. */
  const {writes, sessionRef} = owner(write);
  writes.savePlayerData({profile: {username: "Old", coins: 90, level: 1, xp: 0, winStreak: 0,
    gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
  await new Promise<void>(resolve => setImmediate(resolve));
  sessionRef.current = {...session(), player: {playerId: "new-player", registered: false}};
  writes.savePlayerData({activeGame: {savedAt: 3} as never});
  await writes.drainAndClear();
  expect(write.mock.calls[1][0]).not.toHaveProperty("profile");
  expect(write.mock.calls[1][0]).toMatchObject({activeGame: {savedAt: 3}});
});

it("reports a failed waiting group once and retains its fields in the next successful save", async () => {
  /** One held SDK call allows a group of edits to accumulate. */
  const held = heldWrite();
  /** Later write fails once, then permits recovery. */
  const write = jest.fn<JestPlatformPort["writePlayerData"]>()
    .mockImplementationOnce(() => held.promise).mockRejectedValueOnce(new Error("SDK-flush-failed")).mockResolvedValue(undefined);
  /** Hook reports storage failure through its existing telemetry seam. */
  const {writes, trackFailure} = owner(write);
  /** Expected failure logging does not obscure the contract assertions. */
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    writes.savePlayerData({activeGame: {savedAt: 1} as never});
    await new Promise<void>(resolve => setImmediate(resolve));
    for (let index = 2; index <= 101; index++) writes.savePlayerData({activeGame: {savedAt: index} as never});
    writes.savePlayerData({profile: {username: "Ada", coins: 300, level: 1, xp: 0, winStreak: 0,
      gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
    held.release();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(trackFailure).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    writes.savePlayerData({activeGame: {savedAt: 102} as never});
    await writes.drainAndClear();
    expect(write.mock.calls[2][0]).toMatchObject({activeGame: {savedAt: 102}, profile: {username: "Ada", coins: 300}});
  } finally {warn.mockRestore();}
});

it("retires waiting preferences and still drains the new owner's preference changes", async () => {
  /** First entered preference write precedes an old queued patch. */
  const held = heldWrite();
  /** SDK records preference patches that pass ownership. */
  const preferences = jest.fn<JestPlatformPort["writePreferences"]>()
    .mockImplementationOnce(() => held.promise).mockResolvedValue(undefined);
  /** New identity uses the same subscription with a distinct generation. */
  const {writes, sessionRef, trackFailure} = owner(async () => undefined, preferences);
  /** Installs real preference subscriptions from the hook's effect. */
  const cleanups = effects.map(effect => effect());
  try {
    setPlayerMuted(true);
    await new Promise<void>(resolve => setImmediate(resolve));
    setPlayerHighContrast(true);
    writes.disable();
    sessionRef.current = {...session(), player: {playerId: "new-player", registered: false}};
    writes.enable(null);
    setPlayerReducedMotion(true);
    held.release();
    await writes.drainAndClear();
    expect(preferences.mock.calls.map(([value]) => value)).toEqual([{muted: true}, {reducedMotion: true}]);
    expect(trackFailure).not.toHaveBeenCalled();
  } finally {for (const cleanup of cleanups) if (typeof cleanup === "function") cleanup();}
});

it("retries a failed latest checkpoint without requiring another answer edit", async () => {
  jest.useFakeTimers();
  /** Controlled provider writes expose retry and acknowledgement ordering. */
  const write = jest.fn<JestPlatformPort["writePlayerData"]>()
    .mockRejectedValueOnce(new Error("flush failed")).mockResolvedValue(undefined);
  /** Hook collaborators expose current session ownership and provider acknowledgements. */
  const {writes, trackFailure} = owner(write);
  /** Every installed effect is retired after the test. */
  const cleanups = effects.map(effect => effect());
  /** Expected provider failures do not obscure the contract assertions. */
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    writes.savePlayerData({activeGame: {savedAt: 7} as never, profile: {coins: 80}});
    await jest.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0]).toMatchObject({activeGame: {savedAt: 7}, profile: {coins: 80}});
    expect(trackFailure).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(60000);
    expect(write).toHaveBeenCalledTimes(2);
  } finally {for (const cleanup of cleanups) if (typeof cleanup === "function") cleanup(); warn.mockRestore();jest.useRealTimers();}
});

it("retries complete merged preferences after several failed patches", async () => {
  jest.useFakeTimers();
  /** Complete preference saves retain earlier failed fields. */
  const preferences = jest.fn<JestPlatformPort["writePreferences"]>()
    .mockRejectedValueOnce(new Error("first flush failed")).mockRejectedValueOnce(new Error("second flush failed"))
    .mockResolvedValue(undefined);
  /** Hook collaborators expose current session ownership and provider acknowledgements. */
  const {trackFailure} = owner(async () => undefined, preferences);
  /** Every installed effect is retired after the test. */
  const cleanups = effects.map(effect => effect());
  /** Expected provider failures do not obscure the contract assertions. */
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    setPlayerMuted(true);
    await jest.advanceTimersByTimeAsync(0);
    setPlayerHighContrast(true);
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1000);
    expect(preferences).toHaveBeenCalledTimes(3);
    expect(preferences.mock.calls[2][0]).toEqual({muted: true, highContrast: true});
    expect(trackFailure).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  } finally {for (const cleanup of cleanups) if (typeof cleanup === "function") cleanup();warn.mockRestore();jest.useRealTimers();}
});

it("cancels retry timers when the owning session disables writes", async () => {
  jest.useFakeTimers();
  /** Controlled provider writes expose retry and acknowledgement ordering. */
  const write = jest.fn<JestPlatformPort["writePlayerData"]>().mockRejectedValue(new Error("flush failed"));
  /** Hook collaborators expose current session ownership and provider acknowledgements. */
  const {writes} = owner(write);
  /** Every installed effect is retired after the test. */
  const cleanups = effects.map(effect => effect());
  /** Expected provider failures do not obscure the contract assertions. */
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    writes.savePlayerData({activeGame: {savedAt: 7} as never});
    await jest.advanceTimersByTimeAsync(0);
    writes.disable();
    await jest.advanceTimersByTimeAsync(60000);
    expect(write).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  } finally {for (const cleanup of cleanups) if (typeof cleanup === "function") cleanup();warn.mockRestore();jest.useRealTimers();}
});

it.each([false, true])("waits for already queued writes before retrying, replacement session: %s", async replacement => {
  jest.useFakeTimers();
  /** Controlled acknowledgement keeps an entered save pending. */
  const held = heldWrite();
  /** Controlled provider writes expose retry and acknowledgement ordering. */
  const write = jest.fn<JestPlatformPort["writePlayerData"]>()
    .mockRejectedValueOnce(new Error("flush failed")).mockImplementationOnce(() => held.promise).mockResolvedValue(undefined);
  /** Hook collaborators expose current session ownership and provider acknowledgements. */
  const {writes, sessionRef} = owner(write);
  /** Every installed effect is retired after the test. */
  const cleanups = effects.map(effect => effect());
  /** Expected provider failures do not obscure the contract assertions. */
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    writes.savePlayerData({activeGame: {savedAt: 1} as never});
    await jest.advanceTimersByTimeAsync(0);
    writes.savePlayerData({activeGame: {savedAt: 2} as never});
    await jest.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(2);
    if (replacement) {
      writes.disable();
      sessionRef.current = {...session(), player: {playerId: "new-player", registered: true}};
      writes.enable(null);
      writes.savePlayerData({profile: {coins: 80}});
    }
    held.release();
    await jest.advanceTimersByTimeAsync(60000);
    expect(write).toHaveBeenCalledTimes(replacement ? 3 : 2);
    if (replacement) expect(write.mock.calls[2][0]).not.toHaveProperty("activeGame");
    expect(jest.getTimerCount()).toBe(0);
  } finally {for (const cleanup of cleanups) if (typeof cleanup === "function") cleanup();warn.mockRestore();jest.useRealTimers();}
});

it("does not overwrite unrelated loaded SDK preferences while retrying pending fields", async () => {
  jest.useFakeTimers();
  /** SDK may update unrelated metadata independently of app preference patches. */
  const preferences = jest.fn<JestPlatformPort["writePreferences"]>()
    .mockRejectedValueOnce(new Error("flush failed")).mockResolvedValue(undefined);
  /** Loaded preferences must remain in React while only changed fields enter SDK storage. */
  const {sessionRef} = owner(async () => undefined, preferences);
  sessionRef.current!.preferences = {locale: "fr", presenceEnabled: true, registrationPromptDismissedAt: 10};
  /** Mounts the real preference subscription and recovery lifetime. */
  const cleanups = effects.map(effect => effect());
  /** Expected SDK failure is asserted through the write contract. */
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    setPlayerMuted(true);
    await jest.advanceTimersByTimeAsync(1000);
    expect(preferences.mock.calls.map(([change]) => change)).toEqual([{muted: true}, {muted: true}]);
    expect(sessionRef.current!.preferences).toEqual({locale: "fr", presenceEnabled: true,
      registrationPromptDismissedAt: 10, muted: true});
  } finally {for (const cleanup of cleanups) if (typeof cleanup === "function") cleanup();warn.mockRestore();jest.useRealTimers();}
});
