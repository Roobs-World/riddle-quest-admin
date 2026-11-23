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
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T08:00:00.000Z"));
    jest.clearAllMocks();
    mockGenerateForDate.mockResolvedValue(undefined);
  });

  it.each([
    ["2026-08-12T08:00:00Z", ["en", "pt"]],
    ["2026-08-12T07:00:00Z", ["es", "fr", "de", "it", "nl", "pl"]],
    ["2026-08-12T06:00:00Z", ["ru", "tr", "ar"]],
    ["2026-08-12T03:30:00Z", ["hi"]],
    ["2026-08-12T02:00:00Z", ["id", "vi"]],
    ["2026-08-12T00:00:00Z", ["ja", "ko"]],
    ["2026-01-12T09:00:00Z", ["en", "pt"]],
    ["2026-01-12T08:00:00Z", ["es", "fr", "de", "it", "nl", "pl"]],
  ])("generates only the languages reaching 09:00 at %s", async (instant, locales) => {
    jest.setSystemTime(new Date(instant));
    await scheduledTaskHandler(scheduledEvent);
    expect(mockGenerateForDate).toHaveBeenCalledTimes(1);
    expect(mockGenerateForDate).toHaveBeenCalledWith(instant.slice(0, 10), false, locales);
  });

  it("does no work between regional generation slots", async () => {
    jest.setSystemTime(new Date("2026-08-12T08:30:00Z"));
    await scheduledTaskHandler(scheduledEvent);
    expect(mockGenerateForDate).not.toHaveBeenCalled();
  });

  it("uses the original scheduled instant for delayed dispatch and retries", async () => {
    await scheduledTaskHandler({...scheduledEvent, scheduleTime: "2026-08-12T00:00:00Z"});
    expect(mockGenerateForDate).toHaveBeenCalledWith("2026-08-12", false, ["ja", "ko"]);
  });

  it("does not advance a regional date for a future manual schedule", async () => {
    jest.setSystemTime(new Date("2026-08-11T23:33:00Z"));
    await scheduledTaskHandler({...scheduledEvent, scheduleTime: "2026-08-12T00:00:00Z"});
    expect(mockGenerateForDate).not.toHaveBeenCalled();
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
