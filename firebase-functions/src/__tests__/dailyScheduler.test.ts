import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {ScheduledEvent} from "firebase-functions/v2/scheduler";

/** Provides mock generate for date behavior. */
const mockGenerateForDate = jest.fn();
/** Records only explicit error-reporting context. */
const mockCaptureException = jest.fn();
/** Provides mock logger behavior. */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock("../daily/dailyRiddleGeneration", () => ({
  ...jest.requireActual<typeof import("../daily/dailyRiddleGeneration")>("../daily/dailyRiddleGeneration"),
  generateLocalizedDailyChallengeForDate: (...args: unknown[]) => mockGenerateForDate(...args),
}));

jest.mock("../shared/sentry", () => ({
  ...jest.requireActual<typeof import("../shared/sentry")>("../shared/sentry"),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock("firebase-functions", () => ({logger: mockLogger}));

import {scheduledTaskHandler} from "../daily/dailyScheduler";
import {DailyGenerationIncompleteError} from "../daily/dailyRiddleGeneration";

/** Provides scheduled event behavior. */
const scheduledEvent = {} as ScheduledEvent;

describe("dailyChallengeScheduler", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-11T21:00:00.000Z"));
    jest.clearAllMocks();
    mockGenerateForDate.mockResolvedValue(undefined);
  });

  it("starts London and Lisbon at midnight while repairing locales still in their early hours", async () => {
    jest.setSystemTime(new Date("2026-08-11T23:00:00Z"));
    await scheduledTaskHandler(scheduledEvent);
    expect(mockGenerateForDate).toHaveBeenCalledWith("2026-08-12", false, ["en", "es", "pt", "fr", "de", "ru", "tr", "ar", "it", "nl", "pl"]);
  });

  it("generates the regional date only for locales in their midnight window", async () => {
    await scheduledTaskHandler(scheduledEvent);

    expect(mockGenerateForDate).toHaveBeenCalledWith("2026-08-12", false, ["hi", "ru", "tr", "ar"]);
    expect(mockLogger.info).toHaveBeenCalledWith("Daily scheduler finished successfully (localized daily set ready).", {
      challengeDate: "2026-08-12",
    });
  });

  it("self-heals London and Lisbon before their regional repair window closes", async () => {
    jest.setSystemTime(new Date("2026-08-12T01:00:00.000Z"));

    await scheduledTaskHandler(scheduledEvent);

    expect(mockGenerateForDate).toHaveBeenCalledWith("2026-08-12", false, ["en", "pt"]);
  });

  it("uses the scheduled instant for delayed dispatch at Tokyo midnight", async () => {
    jest.setSystemTime(new Date("2026-08-12T01:00:00Z"));
    await scheduledTaskHandler({...scheduledEvent, scheduleTime: "2026-08-11T15:00:00Z"});
    expect(mockGenerateForDate).toHaveBeenCalledWith("2026-08-12", false, ["ja", "ko"]);
  });

  it("does not generate Shanghai content early when a manual dispatch carries a future schedule", async () => {
    jest.setSystemTime(new Date("2026-10-02T15:33:00Z"));
    await scheduledTaskHandler({...scheduledEvent, scheduleTime: "2026-10-02T16:00:00Z"});
    expect(mockGenerateForDate).toHaveBeenCalledTimes(1);
    expect(mockGenerateForDate).toHaveBeenCalledWith("2026-10-03", false, ["ja", "ko"]);
  });

  it("rethrows generation failures with bounded Cloud-log metadata", async () => {
    /** Provides failure behavior. */
    const failure = Object.assign(new Error("candidate content must stay private"), {code: "rate_limit"});
    mockGenerateForDate.mockRejectedValue(failure);

    await expect(scheduledTaskHandler(scheduledEvent)).rejects.toBe(failure);
    expect(mockLogger.error).toHaveBeenCalledWith("Daily scheduler failed while preparing immutable daily riddles.", {
      challengeDate: "2026-08-12",
      errorClass: "Error",
      code: "rate_limit",
    });
    expect(mockLogger.error).not.toHaveBeenCalledWith(expect.anything(), failure);
  });

  it("reports locale and attempt diagnostics without including generated content", async () => {
    /** Replays the aggregate failure produced by an exhausted generation budget. */
    const failure = new DailyGenerationIncompleteError(["en", "ja"], 6);
    mockGenerateForDate.mockRejectedValue(failure);

    await expect(scheduledTaskHandler(scheduledEvent)).rejects.toBe(failure);
    expect(mockCaptureException).toHaveBeenCalledWith(failure, {
      functionName: "dailyChallengeScheduler",
      phase: "scheduled_generation",
      challengeDate: "2026-08-12",
      failedLocales: ["en", "ja"],
      attemptCount: 6,
    });
  });
});
