import {describe, expect, jest, test} from "@jest/globals";
import {MockJestPlatform} from "../MockJestPlatform";
import {recordAuthoritativeCompletion, REGISTRATION_PROMPT_COOLDOWN_MS} from "../milestone";
import type {JestSession} from "../types";

/** Provides session behavior. */
const session = (overrides: Partial<JestSession> = {}): JestSession => ({
  player: {playerId: "stable-player", registered: false},
  profile: null,
  entryIntent: {},
  preferences: {},
  playerData: null,
  firebaseAuthenticated: true,
  ...overrides,
});

describe("authoritative first milestone", () => {
  test("marks only after an authoritative win and opens contextual registration", async () => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Provides mark behavior. */
    const mark = jest.spyOn(platform, "markFirstMilestone");
    /** Provides result behavior. */
    const result = await recordAuthoritativeCompletion(
      platform,
      session(),
      {gameMode: "classic", isCorrect: true},
      REGISTRATION_PROMPT_COOLDOWN_MS,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "success",
        value: expect.objectContaining({milestoneMarked: true, shouldPromptRegistration: true}),
      }),
    );
    expect(mark).toHaveBeenCalledTimes(1);
  });

  test("does not mark a loss and respects the dismissal cooldown", async () => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Provides mark behavior. */
    const mark = jest.spyOn(platform, "markFirstMilestone");
    /** Provides lost behavior. */
    const lost = await recordAuthoritativeCompletion(
      platform,
      session(),
      {gameMode: "challenge", isCorrect: false},
      REGISTRATION_PROMPT_COOLDOWN_MS,
    );
    /** Provides cooling down behavior. */
    const coolingDown = await recordAuthoritativeCompletion(
      platform,
      session({preferences: {firstMilestoneMarked: true, registrationPromptDismissedAt: 100}}),
      {gameMode: "classic", isCorrect: true},
      100 + REGISTRATION_PROMPT_COOLDOWN_MS - 1,
    );

    expect(lost).toEqual(
      expect.objectContaining({
        status: "success",
        value: expect.objectContaining({milestoneMarked: false, shouldPromptRegistration: false}),
      }),
    );
    expect(coolingDown).toEqual(
      expect.objectContaining({
        status: "success",
        value: expect.objectContaining({milestoneMarked: false, shouldPromptRegistration: false}),
      }),
    );
    expect(mark).not.toHaveBeenCalled();
  });

  test("propagates a platform milestone failure without writing preferences", async () => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    jest.spyOn(platform, "markFirstMilestone").mockResolvedValue({status: "error", error: new Error("offline")});
    /** Provides write behavior. */
    const write = jest.spyOn(platform, "writePreferences");

    await expect(
      recordAuthoritativeCompletion(platform, session(), {gameMode: "classic", isCorrect: true}),
    ).resolves.toEqual({status: "error", error: expect.any(Error)});
    expect(write).not.toHaveBeenCalled();
  });

  test("does not prompt an already registered player after a prior milestone", async () => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Provides result behavior. */
    const result = await recordAuthoritativeCompletion(
      platform,
      session({player: {playerId: "stable-player", registered: true}, preferences: {firstMilestoneMarked: true}}),
      {gameMode: "challenge", isCorrect: true},
      REGISTRATION_PROMPT_COOLDOWN_MS,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "success",
        value: expect.objectContaining({milestoneMarked: false, shouldPromptRegistration: false}),
      }),
    );
  });
});
