import {describe, expect, jest, test} from "@jest/globals";
import {MockJestPlatform} from "../MockJestPlatform";
import {recordAuthoritativeCompletion, REGISTRATION_PROMPT_COOLDOWN_MS} from "../milestone";
import type {JestSession} from "../types";

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
    const platform = new MockJestPlatform();
    const mark = jest.spyOn(platform, "markFirstMilestone");
    const result = await recordAuthoritativeCompletion(
      platform,
      session(),
      {gameMode: "classic", isCorrect: true},
      REGISTRATION_PROMPT_COOLDOWN_MS,
    );

    expect(result).toEqual(expect.objectContaining({
      status: "success",
      value: expect.objectContaining({milestoneMarked: true, shouldPromptRegistration: true}),
    }));
    expect(mark).toHaveBeenCalledTimes(1);
  });

  test("does not mark a loss and respects the dismissal cooldown", async () => {
    const platform = new MockJestPlatform();
    const mark = jest.spyOn(platform, "markFirstMilestone");
    const lost = await recordAuthoritativeCompletion(
      platform,
      session(),
      {gameMode: "challenge", isCorrect: false},
      REGISTRATION_PROMPT_COOLDOWN_MS,
    );
    const coolingDown = await recordAuthoritativeCompletion(
      platform,
      session({preferences: {firstMilestoneMarked: true, registrationPromptDismissedAt: 100}}),
      {gameMode: "classic", isCorrect: true},
      100 + REGISTRATION_PROMPT_COOLDOWN_MS - 1,
    );

    expect(lost).toEqual(expect.objectContaining({
      status: "success",
      value: expect.objectContaining({milestoneMarked: false, shouldPromptRegistration: false}),
    }));
    expect(coolingDown).toEqual(expect.objectContaining({
      status: "success",
      value: expect.objectContaining({milestoneMarked: false, shouldPromptRegistration: false}),
    }));
    expect(mark).not.toHaveBeenCalled();
  });
});
