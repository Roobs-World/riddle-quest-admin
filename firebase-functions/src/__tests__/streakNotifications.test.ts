/**
 * Unit tests for firebase-functions/src/streakNotifications.ts
 *
 * Covers:
 *  - buildStreakReminderCopy: all streak tiers
 *  - sendStreakReminders: user filtering (no token, already completed, already reminded),
 *    FCM send, batch writes, error handling, result counts
 *  - streakReminderHandler: wires date and delegates to sendStreakReminders
 */

const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("firebase-functions", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: jest.fn(),
  },
}));

// ── firebase-admin mock ──────────────────────────────────────────────────────

const mockSend = jest.fn();
const mockMessaging = jest.fn(() => ({send: mockSend}));

const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatch = jest.fn(() => ({
  set: mockBatchSet,
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));

const mockGet = jest.fn();
const mockWhere = jest.fn();
const mockDocRef = {id: "hist-doc"};
const mockDoc = jest.fn().mockReturnValue(mockDocRef);

mockWhere.mockReturnValue({get: mockGet});

const mockUsersCollection = {
  where: mockWhere,
  doc: mockDoc,
};

const mockHistoryCollection = {
  doc: mockDoc,
};

const mockCollection = jest.fn((name: string) => {
  if (name === "users") return mockUsersCollection;
  if (name === "notificationHistory") return mockHistoryCollection;
  return {doc: mockDoc};
});

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  increment: jest.fn(),
};

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [],
  firestore: jest.fn(() => ({
    collection: mockCollection,
    batch: mockBatch,
  })),
  messaging: mockMessaging,
}));

(require("firebase-admin").firestore as unknown as {FieldValue: typeof mockFieldValue}).FieldValue =
  mockFieldValue;

// ── firebase-functions/v2/scheduler mock ────────────────────────────────────

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_opts: unknown, handler: unknown) => handler),
}));

// ── Import under test (after mocks) ─────────────────────────────────────────

import {
  buildStreakReminderCopy,
  sendStreakReminders,
  streakReminderHandler,
} from "../streakNotifications";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const TODAY = "2026-03-24";
const TODAY_MIDNIGHT = new Date("2026-03-24T00:00:00.000Z").getTime();
const YESTERDAY = TODAY_MIDNIGHT - 1; // one ms before midnight = yesterday
const TOMORROW = TODAY_MIDNIGHT + 24 * 60 * 60 * 1000;

function makeUserDoc(overrides: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = {
    fcmToken: "token-abc",
    lastDailyChallengeCompletedAt: YESTERDAY, // not yet done today
    stats: {winStreak: 0},
    ...overrides,
  };
  return {
    id: "user-1",
    ref: {id: "user-1"},
    data: () => data,
  };
}

function makeSnapshot(docs: ReturnType<typeof makeUserDoc>[]) {
  return {docs};
}

// ────────────────────────────────────────────────────────────────────────────
// buildStreakReminderCopy
// ────────────────────────────────────────────────────────────────────────────

describe("buildStreakReminderCopy", () => {
  it("returns no-streak copy for streak=0", () => {
    const {title, body} = buildStreakReminderCopy(0);
    expect(title).toContain("Today's challenge");
    expect(body).toContain("5");
  });

  it("returns low-streak copy for streak=1", () => {
    const {title, body} = buildStreakReminderCopy(1);
    expect(title).toContain("Daily Challenge");
    expect(body).toContain("1-day streak");
  });

  it("returns low-streak copy for streak=2", () => {
    const {body} = buildStreakReminderCopy(2);
    expect(body).toContain("2-day streak");
  });

  it("returns building-streak copy for streak=3", () => {
    const {title, body} = buildStreakReminderCopy(3);
    expect(title).toContain("building");
    expect(body).toContain("3 days");
  });

  it("returns building-streak copy for streak=6", () => {
    const {title} = buildStreakReminderCopy(6);
    expect(title).toContain("building");
  });

  it("returns high-streak copy for streak=7", () => {
    const {title, body} = buildStreakReminderCopy(7);
    expect(title).toContain("Don't break");
    expect(body).toContain("7-day streak");
  });

  it("returns high-streak copy for streak=13", () => {
    const {title, body} = buildStreakReminderCopy(13);
    expect(title).toContain("Don't break");
    expect(body).toContain("13-day streak");
  });

  it("returns legendary copy for streak=14", () => {
    const {title} = buildStreakReminderCopy(14);
    expect(title).toContain("legendary");
  });

  it("returns legendary copy for streak=100", () => {
    const {title, body} = buildStreakReminderCopy(100);
    expect(title).toContain("legendary");
    expect(body).toContain("100");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// sendStreakReminders
// ────────────────────────────────────────────────────────────────────────────

describe("sendStreakReminders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatch.mockReturnValue({
      set: mockBatchSet,
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    });
    mockDoc.mockReturnValue(mockDocRef);
    mockWhere.mockReturnValue({get: mockGet});
    mockSend.mockResolvedValue("msg-id");
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it("queries users with fcmToken >= 'a'", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([]));

    await sendStreakReminders(TODAY);

    expect(mockWhere).toHaveBeenCalledWith("fcmToken", ">=", "a");
  });

  it("sends to eligible user and returns sent=1", async () => {
    const user = makeUserDoc();
    mockGet.mockResolvedValueOnce(makeSnapshot([user]));

    const result = await sendStreakReminders(TODAY);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("skips user with no fcmToken", async () => {
    const user = makeUserDoc({fcmToken: undefined});
    mockGet.mockResolvedValueOnce(makeSnapshot([user]));

    const result = await sendStreakReminders(TODAY);

    expect(mockSend).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("skips user who already completed today's challenge", async () => {
    const user = makeUserDoc({lastDailyChallengeCompletedAt: TODAY_MIDNIGHT + 1000});
    mockGet.mockResolvedValueOnce(makeSnapshot([user]));

    const result = await sendStreakReminders(TODAY);

    expect(mockSend).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("skips user who already received a reminder today", async () => {
    const user = makeUserDoc({lastStreakReminderSentAt: TODAY_MIDNIGHT + 500});
    mockGet.mockResolvedValueOnce(makeSnapshot([user]));

    const result = await sendStreakReminders(TODAY);

    expect(mockSend).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("does not skip user whose lastDailyChallengeCompletedAt is yesterday", async () => {
    const user = makeUserDoc({lastDailyChallengeCompletedAt: YESTERDAY});
    mockGet.mockResolvedValueOnce(makeSnapshot([user]));

    const result = await sendStreakReminders(TODAY);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
  });

  it("does not skip user with no lastDailyChallengeCompletedAt", async () => {
    const user = makeUserDoc({lastDailyChallengeCompletedAt: undefined});
    mockGet.mockResolvedValueOnce(makeSnapshot([user]));

    const result = await sendStreakReminders(TODAY);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
  });

  it("writes notification history and updates lastStreakReminderSentAt on send", async () => {
    const user = makeUserDoc();
    mockGet.mockResolvedValueOnce(makeSnapshot([user]));

    await sendStreakReminders(TODAY);

    expect(mockBatchSet).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({
        type: "streak_reminder",
        userId: "user-1",
        status: "sent",
        date: TODAY,
      }),
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      user.ref,
      expect.objectContaining({lastStreakReminderSentAt: expect.any(Number)}),
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("does not commit batch when no sends occurred", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([]));

    await sendStreakReminders(TODAY);

    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("increments failed count and does not write history when FCM send fails", async () => {
    const user = makeUserDoc();
    mockGet.mockResolvedValueOnce(makeSnapshot([user]));
    mockSend.mockRejectedValueOnce(new Error("FCM error"));

    const result = await sendStreakReminders(TODAY);

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    // batch should not have been committed (no successful sends)
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("handles mixed eligible and ineligible users", async () => {
    const eligible = makeUserDoc({lastDailyChallengeCompletedAt: YESTERDAY});
    const alreadyDone = makeUserDoc({
      userId: "user-2",
      lastDailyChallengeCompletedAt: TOMORROW,
    });
    const noToken = makeUserDoc({userId: "user-3", fcmToken: undefined});
    mockGet.mockResolvedValueOnce(makeSnapshot([eligible, alreadyDone, noToken]));

    const result = await sendStreakReminders(TODAY);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(2);
  });

  it("includes correct streak data in FCM notification for streak=5", async () => {
    const user = makeUserDoc({stats: {winStreak: 5}});
    mockGet.mockResolvedValueOnce(makeSnapshot([user]));

    await sendStreakReminders(TODAY);

    const sendCall = mockSend.mock.calls[0][0] as {notification: {title: string; body: string}};
    expect(sendCall.notification.body).toContain("5 days");
  });

  it("includes streak_reminder in FCM data payload", async () => {
    const user = makeUserDoc();
    mockGet.mockResolvedValueOnce(makeSnapshot([user]));

    await sendStreakReminders(TODAY);

    const sendCall = mockSend.mock.calls[0][0] as {data: {type: string; date: string}};
    expect(sendCall.data.type).toBe("streak_reminder");
    expect(sendCall.data.date).toBe(TODAY);
  });

  it("logs summary info after completion", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([]));

    await sendStreakReminders(TODAY);

    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining(TODAY));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// streakReminderHandler
// ────────────────────────────────────────────────────────────────────────────

describe("streakReminderHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatch.mockReturnValue({
      set: mockBatchSet,
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    });
    mockDoc.mockReturnValue(mockDocRef);
    mockWhere.mockReturnValue({get: mockGet});
  });

  it("runs without error when no users are eligible", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([]));

    await expect(
      streakReminderHandler({scheduleTime: TODAY} as unknown as import("firebase-functions/v2/scheduler").ScheduledEvent),
    ).resolves.toBeUndefined();
  });

  it("propagates errors from sendStreakReminders", async () => {
    mockGet.mockRejectedValueOnce(new Error("Firestore error"));

    await expect(
      streakReminderHandler({scheduleTime: TODAY} as unknown as import("firebase-functions/v2/scheduler").ScheduledEvent),
    ).rejects.toThrow("Firestore error");

    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("logs start and finish messages", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([]));

    await streakReminderHandler(
      {scheduleTime: TODAY} as unknown as import("firebase-functions/v2/scheduler").ScheduledEvent,
    );

    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("Starting"));
    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("Finished"));
  });
});
