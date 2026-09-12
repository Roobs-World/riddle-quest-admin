import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {JestPlatformPort, JestSession} from "../types";
import {MOCK_NOTIFICATION_COPY, type NotificationCopy} from "../notifications/copy";

/** Describes effect. */
type Effect = () => void | (() => void);

/** Provides mock effects behavior. */
const mockEffects: Effect[] = [];
/** Provides mock set copy behavior. */
const mockSetCopy = jest.fn();
/** Provides mock load notification copy behavior. */
const mockLoadNotificationCopy = jest.fn<() => Promise<NotificationCopy>>();
/** Provides mock replace engagement reminders behavior. */
const mockReplaceEngagementReminders = jest.fn();
/** Provides mock notification rotation seed behavior. */
const mockNotificationRotationSeed = jest.fn(() => 4);
/** Provides mock copy state behavior. */
let mockCopyState: NotificationCopy | null = null;

jest.mock("react", () => ({
  useEffect: (effect: Effect) => mockEffects.push(effect),
  useState: () => [mockCopyState, mockSetCopy],
}));

jest.mock("../notifications/firebaseCopy", () => ({
  loadNotificationCopy: mockLoadNotificationCopy,
}));

jest.mock("../notifications/engagement", () => ({
  LEGACY_RACE_REMINDER_ID: "race_to_10_return_v1",
  notificationRotationSeed: mockNotificationRotationSeed,
  RACE_RESULTS_REMINDER_ID: "race_to_10_results_v1",
  replaceEngagementReminders: mockReplaceEngagementReminders,
}));

import {useJestNotifications} from "../notifications/useJestNotifications";

/** Provides session behavior. */
const session = ({
  registered = true,
  username = "Ada",
  customName,
  challengeDestination,
}: {
  /** Stores registered. */
  registered?: boolean;
  /** Stores username. */
  username?: string | null;
  /** Stores custom name. */
  customName?: string;
  /** Stores challenge destination. */
  challengeDestination?: string;
} = {}): JestSession => ({
  player: {playerId: "player-1", registered},
  profile: username === null ? null : {username},
  entryIntent: {customName, challengeDestination},
  preferences: {},
  playerData: null,
  firebaseAuthenticated: true,
});

/** Provides flush promises behavior. */
const flushPromises = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

/** Creates harness. */
const createHarness = ({
  currentSession = session(),
  mockRuntime = true,
  notificationsActive = true,
  assetReference,
}: {
  /** Stores current session. */
  currentSession?: JestSession | null;
  /** Stores mock runtime. */
  mockRuntime?: boolean;
  /** Stores notifications active. */
  notificationsActive?: boolean;
  /** Stores asset reference. */
  assetReference?: string;
} = {}) => {
  /** Provides notifications enabled state behavior. */
  let notificationsEnabledState = notificationsActive;
  /** Removes notification. */
  const removeNotification = jest.fn<JestPlatformPort["removeNotification"]>();
  /** Provides schedule notification behavior. */
  const scheduleNotification = jest.fn<JestPlatformPort["scheduleNotification"]>();
  /** Tracks funnel. */
  const trackFunnel = jest.fn();
  /** Runs platform activity. */
  const withPlatformActivity = jest.fn(async (operation: () => Promise<unknown>) => operation());
  /** Provides platform behavior. */
  const platform = {removeNotification, scheduleNotification} as unknown as JestPlatformPort;
  useJestNotifications({
    locale: "en-GB",
    mockRuntime,
    session: currentSession,
    engagementProgress: {level: 8, winStreak: 3, wins: 12},
    playerFallback: "Player",
    assetReference,
    platform,
    notificationsEnabled: () => notificationsEnabledState,
    withPlatformActivity: withPlatformActivity as never,
    trackFunnel,
  });
  expect(mockEffects).toHaveLength(4);
  return {
    platform,
    removeNotification,
    scheduleNotification,
    setNotificationsActive: (active: boolean) => {
      notificationsEnabledState = active;
    },
    trackFunnel,
    withPlatformActivity,
  };
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
    /** Provides {with platform activity} behavior. */
    const {withPlatformActivity} = createHarness({currentSession: session({registered: false})});

    mockEffects.forEach((effect) => effect());
    await flushPromises();

    expect(mockSetCopy).toHaveBeenCalledWith(null);
    expect(withPlatformActivity).not.toHaveBeenCalled();
  });

  it("performs no new platform work after notification cleanup starts", async () => {
    mockCopyState = MOCK_NOTIFICATION_COPY;
    /** Provides {schedule notification, with platform activity} behavior. */
    const {scheduleNotification, withPlatformActivity} = createHarness({notificationsActive: false});

    mockEffects.forEach((effect) => effect());
    window.dispatchEvent(
      new CustomEvent("riddle-quest:race-challenge-published", {
        detail: {challengeId: "challenge-after-deletion"},
      }),
    );
    await flushPromises();

    expect(withPlatformActivity).not.toHaveBeenCalled();
    expect(scheduleNotification).not.toHaveBeenCalled();
  });

  it("stops a registered race listener when deletion quiescence begins", async () => {
    mockCopyState = MOCK_NOTIFICATION_COPY;
    /** Provides {schedule notification, set notifications active, with platform activity} behavior. */
    const {scheduleNotification, setNotificationsActive, withPlatformActivity} = createHarness();
    /** Provides cleanup behavior. */
    const cleanup = mockEffects[2]() as () => void;
    setNotificationsActive(false);

    window.dispatchEvent(
      new CustomEvent("riddle-quest:race-challenge-published", {
        detail: {challengeId: "challenge-after-deletion"},
      }),
    );
    await flushPromises();

    expect(withPlatformActivity).not.toHaveBeenCalled();
    expect(scheduleNotification).not.toHaveBeenCalled();
    cleanup();
  });

  it("loads bundled copy in the mock runtime", async () => {
    createHarness();

    /** Provides cleanup behavior. */
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
    /** Provides failed behavior. */
    const failed = createHarness({mockRuntime: false});
    mockEffects[0]();
    await flushPromises();
    expect(mockSetCopy).toHaveBeenCalledWith(null);
    expect(failed.trackFunnel).toHaveBeenCalledWith("notification_copy_load_failed", {locale: "en-GB"});

    jest.clearAllMocks();
    mockEffects.length = 0;
    /** Resolves copy. */
    let resolveCopy: (copy: NotificationCopy) => void = () => undefined;
    mockLoadNotificationCopy.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCopy = resolve;
        }),
    );
    createHarness({mockRuntime: false});
    /** Provides cleanup behavior. */
    const cleanup = mockEffects[0]() as () => void;
    await flushPromises();
    cleanup();
    resolveCopy(MOCK_NOTIFICATION_COPY);
    await flushPromises();
    await flushPromises();
    expect(mockSetCopy).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockEffects.length = 0;
    /** Provides reject copy behavior. */
    let rejectCopy: (error: Error) => void = () => undefined;
    mockLoadNotificationCopy.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCopy = reject;
        }),
    );
    /** Provides cleaned up behavior. */
    const cleanedUp = createHarness({mockRuntime: false});
    /** Provides cleanup rejected load behavior. */
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
    /** Provides {platform, track funnel} behavior. */
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

  it("does not place untrusted entry attribution in notifications and reports invalid reminder copy", async () => {
    mockCopyState = MOCK_NOTIFICATION_COPY;
    mockReplaceEngagementReminders.mockRejectedValue(new Error("invalid copy"));
    /** Provides {track funnel} behavior. */
    const {trackFunnel} = createHarness({
      currentSession: session({username: null, customName: "Grace"}),
    });

    mockEffects[1]();
    await flushPromises();

    expect(mockReplaceEngagementReminders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({dailyBody: expect.stringContaining("Player")}),
      4,
    );
    expect(mockReplaceEngagementReminders).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({dailyBody: expect.stringContaining("Grace")}),
      expect.anything(),
    );
    expect(trackFunnel).toHaveBeenCalledWith("notification_schedule_failed", {
      index: -1,
      status: "invalid-copy",
    });
  });

  it("schedules a race-results reminder only for a valid published challenge", async () => {
    mockCopyState = MOCK_NOTIFICATION_COPY;
    /** Provides {remove notification, schedule notification, track funnel} behavior. */
    const {removeNotification, scheduleNotification, trackFunnel} = createHarness();
    removeNotification.mockResolvedValue({status: "success", value: undefined});
    scheduleNotification.mockResolvedValue({status: "success", value: undefined});

    /** Provides cleanup behavior. */
    const cleanup = mockEffects[2]() as () => void;
    window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {detail: {}}));
    window.dispatchEvent(
      new CustomEvent("riddle-quest:race-challenge-published", {
        detail: {challengeId: "challenge-1"},
      }),
    );
    await flushPromises();

    expect(removeNotification).toHaveBeenCalledWith("race_to_10_return_v1");
    expect(scheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "race_to_10_results_v1",
        scheduledInDays: 1,
        priority: "high",
        entryPayload: expect.objectContaining({challengeId: "challenge-1"}),
      }),
    );
    expect(trackFunnel).toHaveBeenCalledWith("race_results_reminder_scheduled", {status: "success"});
    cleanup();
    window.dispatchEvent(
      new CustomEvent("riddle-quest:race-challenge-published", {
        detail: {challengeId: "challenge-2"},
      }),
    );
    expect(scheduleNotification).toHaveBeenCalledTimes(1);
  });

  it("removes the race reminder when a registered player opens the inbox", async () => {
    mockCopyState = MOCK_NOTIFICATION_COPY;
    /** Provides {remove notification, track funnel} behavior. */
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
