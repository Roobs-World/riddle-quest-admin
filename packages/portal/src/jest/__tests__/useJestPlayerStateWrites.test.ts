import {beforeEach, expect, it, jest} from "@jest/globals";
import type {JestPlatformPort, JestSession} from "../types";
import type {NotificationCrossContextLock} from "../notifications/operationGate";

type Effect = () => void | (() => void);
const effects: Effect[] = [];

jest.mock("react", () => ({
  useCallback: <Callback>(callback: Callback) => callback,
  useEffect: (effect: Effect) => effects.push(effect),
  useMemo: <Value>(factory: () => Value) => factory(),
  useRef: <Value>(value: Value) => ({current: value}),
}));

import {createNotificationOperationGate} from "../notifications/operationGate";
import {useJestPlayerStateWrites} from "../useJestPlayerStateWrites";

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
  let epoch = "before";
  let enterShared: (() => Promise<unknown>) | undefined;
  const crossContextLock: NotificationCrossContextLock = {
    runShared: (operation) => new Promise((resolve, reject) => {
      enterShared = () => operation().then(resolve, reject);
    }),
    runExclusive: (operation) => operation(),
  };
  const gate = createNotificationOperationGate({
    crossContextLock,
    deletionEpoch: () => epoch,
    deletionPending: () => false,
  });
  const writePlayerData = jest.fn(async () => undefined);
  const setEngagementProgress = jest.fn();
  const trackFailure = jest.fn();
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  const currentSession = session();
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
  const gate = createNotificationOperationGate({
    crossContextLock: null,
    deletionEpoch: () => null,
    deletionPending: () => false,
    requireCrossContextLock: false,
  });
  let releaseFirstWrite: () => void = () => undefined;
  const firstWritePending = new Promise<void>((resolve) => { releaseFirstWrite = resolve; });
  const writePlayerData = jest.fn()
    .mockImplementationOnce(() => firstWritePending)
    .mockResolvedValue(undefined);
  const currentSession = session();
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
