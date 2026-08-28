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
  writes.savePlayerData({activeGame: {savedAt: 2} as never});
  await new Promise<void>((resolve) => setImmediate(resolve));

  expect(writePlayerData).toHaveBeenCalledTimes(1);
  expect(writePlayerData.mock.calls[0]?.[0]).toMatchObject({activeGame: {savedAt: 1}});

  releaseFirstWrite();
  await writes.drainAndClear();
  expect(writePlayerData).toHaveBeenCalledTimes(2);
  expect(writePlayerData.mock.calls[1]?.[0]).toMatchObject({activeGame: {savedAt: 2}});
});
