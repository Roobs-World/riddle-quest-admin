import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {JestPlatformPort, JestSession} from "../types";
import {MOCK_NOTIFICATION_COPY, type NotificationCopy} from "../notifications/copy";

type Effect = () => void | (() => void);

const mockEffects: Effect[] = [];
const mockSetCopy = jest.fn();
const mockLoadNotificationCopy = jest.fn<() => Promise<NotificationCopy>>();
const mockReplaceEngagementReminders = jest.fn();
const mockNotificationRotationSeed = jest.fn(() => 4);
let mockCopyState: NotificationCopy | null = null;

jest.mock("react", () => ({
  useEffect: (effect: Effect) => mockEffects.push(effect),
  useState: () => [mockCopyState, mockSetCopy],
}));

jest.mock("../../firebase", () => ({
  loadNotificationCopy: mockLoadNotificationCopy,
}));

jest.mock("../notifications/engagement", () => ({
  notificationRotationSeed: mockNotificationRotationSeed,
  replaceEngagementReminders: mockReplaceEngagementReminders,
}));

import {useJestNotifications} from "../notifications/useJestNotifications";

const session = ({
  registered = true,
  username = "Ada",
  customName,
  challengeDestination,
}: {
  registered?: boolean;
  username?: string | null;
  customName?: string;
  challengeDestination?: string;
} = {}): JestSession => ({
  player: {playerId: "player-1", registered},
  profile: username === null ? null : {username},
  entryIntent: {customName, challengeDestination},
  preferences: {},
  playerData: null,
  firebaseAuthenticated: true,
});

const flushPromises = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

const createHarness = ({
  currentSession = session(),
  mockRuntime = true,
  assetReference,
}: {
  currentSession?: JestSession | null;
  mockRuntime?: boolean;
  assetReference?: string;
} = {}) => {
  const removeNotification = jest.fn<JestPlatformPort["removeNotification"]>();
  const scheduleNotification = jest.fn<JestPlatformPort["scheduleNotification"]>();
  const trackFunnel = jest.fn();
  const withPlatformActivity = jest.fn(async (operation: () => Promise<unknown>) => operation());
  const platform = {removeNotification, scheduleNotification} as unknown as JestPlatformPort;
  useJestNotifications({
    locale: "en-GB",
    mockRuntime,
    session: currentSession,
    engagementProgress: {level: 8, winStreak: 3, wins: 12},
    playerFallback: "Player",
    assetReference,
    platform,
    withPlatformActivity: withPlatformActivity as never,
    trackFunnel,
  });
  expect(mockEffects).toHaveLength(4);
  return {platform, removeNotification, scheduleNotification, trackFunnel, withPlatformActivity};
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEffects.length = 0;
  mockCopyState = null;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: new EventTarget(),
  });
});

describe("useJestNotifications", () => {
  it("clears notification copy and performs no platform work for guests", async () => {
    const {withPlatformActivity} = createHarness({currentSession: session({registered: false})});

    mockEffects.forEach((effect) => effect());
    await flushPromises();

    expect(mockSetCopy).toHaveBeenCalledWith(null);
    expect(withPlatformActivity).not.toHaveBeenCalled();
  });

  it("loads bundled copy in the mock runtime", async () => {
    createHarness();

    const cleanup = mockEffects[0]();
    await flushPromises();

    expect(mockSetCopy).toHaveBeenCalledWith(MOCK_NOTIFICATION_COPY);
    expect(mockLoadNotificationCopy).not.toHaveBeenCalled();
    expect(cleanup).toEqual(expect.any(Function));
  });

  it("loads localized remote copy outside the mock runtime", async () => {
    mockLoadNotificationCopy.mockResolvedValue(MOCK_NOTIFICATION_COPY);
    createHarness({mockRuntime: false});

    mockEffects[0]();
    await flushPromises();

    expect(mockLoadNotificationCopy).toHaveBeenCalledWith("en-GB");
    expect(mockSetCopy).toHaveBeenCalledWith(MOCK_NOTIFICATION_COPY);
  });

  it("reports active copy-load failures and ignores results after cleanup", async () => {
    mockLoadNotificationCopy.mockRejectedValueOnce(new Error("offline"));
    const failed = createHarness({mockRuntime: false});
    mockEffects[0]();
    await flushPromises();
    expect(mockSetCopy).toHaveBeenCalledWith(null);
    expect(failed.trackFunnel).toHaveBeenCalledWith("notification_copy_load_failed", {locale: "en-GB"});

    jest.clearAllMocks();
    mockEffects.length = 0;
    let resolveCopy: (copy: NotificationCopy) => void = () => undefined;
    mockLoadNotificationCopy.mockImplementation(() => new Promise((resolve) => {
      resolveCopy = resolve;
    }));
    createHarness({mockRuntime: false});
    const cleanup = mockEffects[0]() as () => void;
    await flushPromises();
    cleanup();
    resolveCopy(MOCK_NOTIFICATION_COPY);
    await flushPromises();
    await flushPromises();
    expect(mockSetCopy).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockEffects.length = 0;
    let rejectCopy: (error: Error) => void = () => undefined;
    mockLoadNotificationCopy.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectCopy = reject;
    }));
    const cleanedUp = createHarness({mockRuntime: false});
    const cleanupRejectedLoad = mockEffects[0]() as () => void;
    await flushPromises();
    cleanupRejectedLoad();
    rejectCopy(new Error("late failure"));
    await flushPromises();
    await flushPromises();
    expect(mockSetCopy).not.toHaveBeenCalled();
    expect(cleanedUp.trackFunnel).not.toHaveBeenCalled();
  });

  it("replaces engagement reminders and reports individual platform failures", async () => {
    mockCopyState = MOCK_NOTIFICATION_COPY;
    mockReplaceEngagementReminders.mockResolvedValue({
      removed: [{status: "success"}, {status: "retryable-failure"}],
      scheduled: [{status: "success"}, {status: "terminal-failure"}],
    });
    const {platform, trackFunnel} = createHarness({assetReference: "notification-hero"});

    mockEffects[1]();
    await flushPromises();

    expect(mockNotificationRotationSeed).toHaveBeenCalledWith("player-1");
    expect(mockReplaceEngagementReminders).toHaveBeenCalledWith(
      platform,
      expect.objectContaining({
        assetReference: "notification-hero",
        dailyBody: expect.stringContaining("Ada"),
        streakBody: expect.any(String),
        weeklyBody: expect.any(String),
      }),
      4,
    );
    expect(trackFunnel).toHaveBeenCalledWith("notification_unschedule_failed", {
      index: 1,
      status: "retryable-failure",
    });
    expect(trackFunnel).toHaveBeenCalledWith("notification_schedule_failed", {
      index: 1,
      status: "terminal-failure",
    });
  });

  it("uses entry attribution as the name fallback and reports invalid reminder copy", async () => {
    mockCopyState = MOCK_NOTIFICATION_COPY;
    mockReplaceEngagementReminders.mockRejectedValue(new Error("invalid copy"));
    const {trackFunnel} = createHarness({
      currentSession: session({username: null, customName: "Grace"}),
    });

    mockEffects[1]();
    await flushPromises();

    expect(mockReplaceEngagementReminders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({dailyBody: expect.stringContaining("Grace")}),
      4,
    );
    expect(trackFunnel).toHaveBeenCalledWith("notification_schedule_failed", {
      index: -1,
      status: "invalid-copy",
    });
  });

  it("schedules a race-results reminder only for a valid published challenge", async () => {
    mockCopyState = MOCK_NOTIFICATION_COPY;
    const {removeNotification, scheduleNotification, trackFunnel} = createHarness();
    removeNotification.mockResolvedValue({status: "success", value: undefined});
    scheduleNotification.mockResolvedValue({status: "success", value: undefined});

    const cleanup = mockEffects[2]() as () => void;
    window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {detail: {}}));
    window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {
      detail: {challengeId: "challenge-1"},
    }));
    await flushPromises();

    expect(removeNotification).toHaveBeenCalledWith("race_to_10_return_v1");
    expect(scheduleNotification).toHaveBeenCalledWith(expect.objectContaining({
      identifier: "race_to_10_results_v1",
      scheduledInDays: 1,
      priority: "high",
      entryPayload: expect.objectContaining({challengeId: "challenge-1"}),
    }));
    expect(trackFunnel).toHaveBeenCalledWith("race_results_reminder_scheduled", {status: "success"});
    cleanup();
    window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {
      detail: {challengeId: "challenge-2"},
    }));
    expect(scheduleNotification).toHaveBeenCalledTimes(1);
  });

  it("removes the race reminder when a registered player opens the inbox", async () => {
    mockCopyState = MOCK_NOTIFICATION_COPY;
    const {removeNotification, trackFunnel} = createHarness({
      currentSession: session({challengeDestination: "inbox"}),
    });
    removeNotification.mockResolvedValue({status: "success", value: undefined});

    mockEffects[3]();
    await flushPromises();

    expect(removeNotification).toHaveBeenCalledWith("race_to_10_results_v1");
    expect(trackFunnel).toHaveBeenCalledWith("race_results_reminder_opened", {status: "success"});
  });
});
