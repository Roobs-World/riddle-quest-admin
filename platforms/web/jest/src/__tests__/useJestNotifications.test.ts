import {afterEach, beforeEach, expect, it, jest} from "@jest/globals";
import type {JestPlatformPort, JestSession, PlatformResult} from "../types";
import {MockJestPlatform} from "../MockJestPlatform";
import {LEGACY_REMINDER_IDS, PLAYER_NOTIFICATION_IDS, RACE_REMINDER_IDS} from "../notifications/engagement";

type Effect = () => void | (() => void);
const mockEffects: Effect[] = [];
const mockLayoutEffects: Effect[] = [];
const mockPreferenceSubscribers = new Set<() => void>();
let mockNotificationsEnabled = true;
jest.mock("react", () => ({
  useCallback: <Value,>(value: Value) => value,
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({current}),
  useLayoutEffect: (effect: Effect) => mockLayoutEffects.push(effect),
  useEffect: (effect: Effect) => mockEffects.push(effect),
}));
jest.mock("../../../../../src/observability/browserErrorReporter", () => ({captureBrowserException: jest.fn()}));
jest.mock("../../../../../src/settings/browser/playerPreferences", () => ({
  isPlayerNotificationsEnabled: () => mockNotificationsEnabled,
  subscribeToPlayerNotifications: (listener: () => void) => {
    mockPreferenceSubscribers.add(listener);
    return () => {mockPreferenceSubscribers.delete(listener);};
  },
}));
import {useJestNotifications} from "../notifications/useJestNotifications";

const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve));
const cleanups = new Set<() => void>();
let originalWindow: PropertyDescriptor | undefined;
let originalDocument: PropertyDescriptor | undefined;

function createHarness({registered = true, enabled = true,
  withPlatformActivity = async <Result,>(operation: () => Promise<Result>) => operation()}: {
  registered?: boolean;
  enabled?: boolean;
  withPlatformActivity?: Parameters<typeof useJestNotifications>[0]["withPlatformActivity"];
} = {}) {
  let active = true;
  mockNotificationsEnabled = enabled;
  const session: JestSession = {
    player: {playerId: "player-1", registered}, profile: null, entryIntent: {}, preferences: {},
    playerData: null, firebaseAuthenticated: true,
  };
  const platform: JestPlatformPort = new MockJestPlatform(registered);
  const remove = jest.fn<JestPlatformPort["removeNotification"]>().mockResolvedValue({status: "success", value: undefined});
  const schedule = jest.fn<JestPlatformPort["scheduleNotification"]>().mockResolvedValue({status: "success", value: undefined});
  platform.removeNotification = remove;
  platform.scheduleNotification = schedule;
  const notifications = useJestNotifications({session, platform, isActive: () => active, withPlatformActivity});
  const effectCleanups: Array<() => void> = [];
  const runEffects = (effects: Effect[]) => {
    effects.splice(0).forEach(effect => {
      const cleanup = effect();
      if (cleanup) effectCleanups.push(cleanup);
    });
  };
  runEffects(mockLayoutEffects);
  const unmount = () => {
    effectCleanups.splice(0).reverse().forEach(cleanup => cleanup());
  };
  cleanups.add(unmount);
  return {
    remove, schedule, notifications, unmount,
    start: () => runEffects(mockEffects),
    retire: () => {active = false;},
  };
}

beforeEach(() => {
  mockEffects.length = 0;
  mockLayoutEffects.length = 0;
  mockPreferenceSubscribers.clear();
  mockNotificationsEnabled = true;
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", {configurable: true, value: new EventTarget()});
  Object.defineProperty(globalThis, "document", {
    configurable: true, value: Object.assign(new EventTarget(), {visibilityState: "visible"}),
  });
});

afterEach(() => {
  cleanups.forEach(cleanup => cleanup());
  cleanups.clear();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

it("schedules D1-D7 with approved artwork at registered startup and retires superseded reminders", async () => {
  const harness = createHarness();
  harness.start();
  await flushPromises();
  const schedules = harness.schedule.mock.calls.map(([input]) => input);
  expect(schedules.map(input => input.scheduledInDays)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(schedules.every(input => input.assetReference === "riddle-q-notification")).toBe(true);
  expect(schedules.every(input => input.entryPayload?.gameMode === "challenge")).toBe(true);
  expect(harness.remove.mock.calls.map(([identifier]) => identifier))
    .toEqual([...LEGACY_REMINDER_IDS, ...RACE_REMINDER_IDS]);
});

it("does not contact notification APIs for a guest", async () => {
  const harness = createHarness({registered: false});
  harness.start();
  await flushPromises();
  await harness.notifications.synchronizeNotifications();
  expect(harness.remove).not.toHaveBeenCalled();
  expect(harness.schedule).not.toHaveBeenCalled();
});

it("removes every owned schedule for a saved opt-out without scheduling new reminders", async () => {
  const harness = createHarness({enabled: false});
  harness.start();
  await flushPromises();
  expect(harness.remove.mock.calls.map(([identifier]) => identifier)).toEqual([...PLAYER_NOTIFICATION_IDS]);
  expect(harness.schedule).not.toHaveBeenCalled();
});

it("observes a live preference change and cancels all reminders", async () => {
  const harness = createHarness();
  harness.start();
  await flushPromises();
  harness.remove.mockClear();
  mockNotificationsEnabled = false;
  mockPreferenceSubscribers.forEach(listener => listener());
  await flushPromises();
  expect(harness.remove.mock.calls.map(([identifier]) => identifier)).toEqual([...PLAYER_NOTIFICATION_IDS]);
  expect(harness.schedule).toHaveBeenCalledTimes(7);
});

it("does not reschedule completed days when synchronization requests overlap", async () => {
  const harness = createHarness();
  await Promise.all([
    harness.notifications.synchronizeNotifications(),
    harness.notifications.synchronizeNotifications(),
    harness.notifications.synchronizeNotifications(),
  ]);
  expect(harness.schedule).toHaveBeenCalledTimes(7);
  expect(harness.remove).toHaveBeenCalledTimes(LEGACY_REMINDER_IDS.length + RACE_REMINDER_IDS.length);
});

it("retries only the failed day after a partial scheduling failure", async () => {
  const harness = createHarness();
  harness.schedule.mockResolvedValueOnce({status: "retryable-failure", message: "offline"});
  expect(await harness.notifications.synchronizeNotifications()).toBe(false);
  expect(await harness.notifications.synchronizeNotifications()).toBe(true);
  expect(harness.schedule.mock.calls.map(([input]) => input.scheduledInDays)).toEqual([1, 2, 3, 4, 5, 6, 7, 1]);
  expect(harness.remove).toHaveBeenCalledTimes(LEGACY_REMINDER_IDS.length + RACE_REMINDER_IDS.length);
});

it("drains admitted scheduling before applying an opt-out", async () => {
  let finishSchedule: (result: PlatformResult<void>) => void = () => undefined;
  const waiting = new Promise<PlatformResult<void>>(resolve => {finishSchedule = resolve;});
  const harness = createHarness();
  harness.schedule.mockImplementationOnce(() => waiting);
  const scheduling = harness.notifications.synchronizeNotifications();
  await flushPromises();
  expect(harness.schedule).toHaveBeenCalledTimes(7);
  harness.remove.mockClear();
  mockNotificationsEnabled = false;
  const cancelling = harness.notifications.synchronizeNotifications();
  await flushPromises();
  expect(harness.remove).not.toHaveBeenCalled();
  finishSchedule({status: "success", value: undefined});
  expect(await scheduling).toBe(false);
  expect(await cancelling).toBe(true);
  expect(harness.remove.mock.calls.map(([identifier]) => identifier)).toEqual([...PLAYER_NOTIFICATION_IDS]);
  expect(harness.schedule).toHaveBeenCalledTimes(7);
});

it("does not start queued SDK calls after account retirement", async () => {
  const harness = createHarness();
  const pending = harness.notifications.synchronizeNotifications();
  harness.retire();
  await pending;
  expect(harness.remove).not.toHaveBeenCalled();
  expect(harness.schedule).not.toHaveBeenCalled();
});

it("rechecks session ownership after waiting for platform access", async () => {
  let release: () => void = () => undefined;
  const waiting = new Promise<void>(resolve => {release = resolve;});
  const harness = createHarness({withPlatformActivity: async operation => {await waiting; return operation();}});
  const pending = harness.notifications.synchronizeNotifications();
  await flushPromises();
  harness.unmount();
  release();
  await pending;
  expect(harness.remove).not.toHaveBeenCalled();
  expect(harness.schedule).not.toHaveBeenCalled();
});

it("attempts every cancellation and reports a provider failure without claiming success", async () => {
  const harness = createHarness({enabled: false});
  harness.remove.mockResolvedValueOnce({status: "unavailable", message: "Provider unavailable"});
  expect(await harness.notifications.synchronizeNotifications()).toBe(false);
  expect(harness.remove).toHaveBeenCalledTimes(PLAYER_NOTIFICATION_IDS.length);
  expect(harness.schedule).not.toHaveBeenCalled();
});
