import {beforeEach, expect, it, jest} from "@jest/globals";
import type {JestPlatformPort, JestSession} from "../types";
import {MockJestPlatform} from "../MockJestPlatform";
import {PLAYER_NOTIFICATION_IDS} from "../notifications/engagement";

type Effect = () => void | (() => void);
const mockEffects: Effect[] = [];
const mockLayoutEffects: Effect[] = [];
jest.mock("react", () => ({
  useCallback: <Value,>(value: Value) => value,
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({current}),
  useLayoutEffect: (effect: Effect) => mockLayoutEffects.push(effect),
  useEffect: (effect: Effect) => mockEffects.push(effect),
}));
jest.mock("../../../../../src/observability/browserErrorReporter", () => ({captureBrowserException: jest.fn()}));
import {useJestNotifications} from "../notifications/useJestNotifications";

const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve));

function createHarness({registered = true, withPlatformActivity = async <Result,>(operation: () => Promise<Result>) => operation()}: {
  registered?: boolean;
  withPlatformActivity?: Parameters<typeof useJestNotifications>[0]["withPlatformActivity"];
} = {}) {
  let active = true;
  const session: JestSession = {
    player: {playerId: "player-1", registered}, profile: null, entryIntent: {}, preferences: {},
    playerData: null, firebaseAuthenticated: true,
  };
  const platform: JestPlatformPort = new MockJestPlatform(registered);
  const remove = jest.fn<JestPlatformPort["removeNotification"]>().mockResolvedValue({status: "success", value: undefined});
  const schedule = jest.fn<JestPlatformPort["scheduleNotification"]>();
  platform.removeNotification = remove;
  platform.scheduleNotification = schedule;
  const notifications = useJestNotifications({session, platform, isActive: () => active, withPlatformActivity});
  const unmount = mockLayoutEffects[0]();
  return {remove, schedule, notifications, unmount, retire: () => {active = false;}};
}

beforeEach(() => {
  mockEffects.length = 0;
  mockLayoutEffects.length = 0;
});

it("retires all legacy schedules at registered startup without authoring new notifications", async () => {
  const harness = createHarness();
  mockEffects.forEach(effect => effect());
  await flushPromises();
  expect(harness.remove.mock.calls.map(([identifier]) => identifier)).toEqual([...PLAYER_NOTIFICATION_IDS]);
  expect(harness.schedule).not.toHaveBeenCalled();
});

it("does not contact notification APIs for a guest", async () => {
  const harness = createHarness({registered: false});
  mockEffects.forEach(effect => effect());
  await flushPromises();
  expect(harness.remove).not.toHaveBeenCalled();
  expect(harness.schedule).not.toHaveBeenCalled();
});

it("does not start queued SDK cleanup after account retirement", async () => {
  const harness = createHarness();
  const pending = harness.notifications.cancelAllNotifications();
  harness.retire();
  await pending;
  expect(harness.remove).not.toHaveBeenCalled();
});

it("rechecks the session after waiting for platform access", async () => {
  let release: () => void = () => undefined;
  const waiting = new Promise<void>(resolve => {release = resolve;});
  const harness = createHarness({withPlatformActivity: async operation => {await waiting; return operation();}});
  const pending = harness.notifications.cancelAllNotifications();
  await flushPromises();
  if (typeof harness.unmount === "function") harness.unmount();
  release();
  await pending;
  expect(harness.remove).not.toHaveBeenCalled();
});

it("reports cancellation failure while attempting every legacy identifier", async () => {
  const harness = createHarness();
  harness.remove.mockResolvedValueOnce({status: "unavailable", message: "Provider unavailable"});
  expect(await harness.notifications.cancelAllNotifications()).toBe(false);
  expect(harness.remove).toHaveBeenCalledTimes(PLAYER_NOTIFICATION_IDS.length);
});
