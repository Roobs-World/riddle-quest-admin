import {describe, expect, jest, test} from "@jest/globals";
import {MockJestPlatform} from "../MockJestPlatform";
import {recordAuthoritativeCompletion, shouldPromptGuestRegistration} from "../milestone";
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
  test("offers registration after guest wins 3, 6, and 9", () => {
    /** Provides returning guest behavior. */
    const returningGuest = session({preferences: {jestGuestCompletedRiddles: 2}});
    expect(Array.from({length: 9}, (_, index) => shouldPromptGuestRegistration(returningGuest, index + 1)))
      .toEqual([false, false, true, false, false, true, false, false, true]);
    expect(shouldPromptGuestRegistration(session(), 0)).toBe(false);
    expect(shouldPromptGuestRegistration(session())).toBe(false);
    expect(shouldPromptGuestRegistration(returningGuest)).toBe(true);
    expect(shouldPromptGuestRegistration(session({player: {playerId: "stable-player", registered: true}}), 3))
      .toBe(false);
  });
  test.each([
    {completedRiddles: 2, shouldPrompt: true},
    {completedRiddles: 3, shouldPrompt: false},
  ])("counts a Daily win after $completedRiddles prior guest wins", async ({completedRiddles, shouldPrompt}) => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Provides mark behavior. */
    const mark = jest.spyOn(platform, "markFirstMilestone");
    /** Provides result behavior. */
    const result = await recordAuthoritativeCompletion(
      platform,
      session({preferences: {firstMilestoneMarked: true, jestGuestCompletedRiddles: completedRiddles}}),
      {gameMode: "challenge", isCorrect: true},
    );
    expect(mark).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      status: "success",
      value: expect.objectContaining({shouldPromptRegistration: shouldPrompt}),
    }));
    if (result.status === "success") expect(result.value.preferences.jestGuestCompletedRiddles).toBe(completedRiddles + 1);
  });
  test("marks the first authoritative Classic win without opening registration", async () => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Provides mark behavior. */
    const mark = jest.spyOn(platform, "markFirstMilestone");
    /** Provides result behavior. */
    const result = await recordAuthoritativeCompletion(
      platform,
      session(),
      {gameMode: "classic", isCorrect: true},
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "success",
        value: expect.objectContaining({milestoneMarked: true, shouldPromptRegistration: false}),
      }),
    );
    expect(mark).toHaveBeenCalledTimes(1);
  });

  test("does not mark a loss or prompt a guest's first win with legacy preferences", async () => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Provides mark behavior. */
    const mark = jest.spyOn(platform, "markFirstMilestone");
    /** Provides lost behavior. */
    const lost = await recordAuthoritativeCompletion(
      platform,
      session(),
      {gameMode: "challenge", isCorrect: false},
    );
    expect(mark).not.toHaveBeenCalled();
    /** Provides next win behavior. */
    const nextWin = await recordAuthoritativeCompletion(
      platform,
      session({preferences: {firstMilestoneMarked: true, registrationPromptDismissedAt: 100}}),
      {gameMode: "classic", isCorrect: true},
    );

    expect(lost).toEqual(
      expect.objectContaining({
        status: "success",
        value: expect.objectContaining({milestoneMarked: false, shouldPromptRegistration: false}),
      }),
    );
    expect(nextWin).toEqual(
      expect.objectContaining({
        status: "success",
        value: expect.objectContaining({milestoneMarked: false, shouldPromptRegistration: false}),
      }),
    );
    expect(nextWin.status === "success" && nextWin.value.preferences.jestGuestCompletedRiddles).toBe(1);
    expect(mark).toHaveBeenCalledTimes(1);
  });

  test("prompts on mixed Daily and Classic guest wins 3, 6, and 9 across saved preferences", async () => {
    /** Provides platform behavior. */
    const platform = new MockJestPlatform();
    /** Provides preferences behavior. */
    let preferences: JestSession["preferences"] = {};
    /** Provides prompts behavior. */
    const prompts: number[] = [];
    for (let win = 1; win <= 9; win += 1) {
      /** Provides result behavior. */
      const result = await recordAuthoritativeCompletion(platform, session({preferences}), {
        gameMode: win % 2 === 0 ? "classic" : "challenge", isCorrect: true,
      });
      expect(result.status).toBe("success");
      if (result.status !== "success") continue;
      preferences = result.value.preferences;
      if (result.value.shouldPromptRegistration) prompts.push(win);
    }
    expect(prompts).toEqual([3, 6, 9]);
    expect(preferences.jestGuestCompletedRiddles).toBe(9);
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
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "success",
        value: expect.objectContaining({milestoneMarked: false, shouldPromptRegistration: false}),
      }),
    );
  });
});

test("reports a returning player's solved riddle even when the saved milestone flag is set", async () => {
  /** Represents a player returning to a new Simulator session. */
  const platform = new MockJestPlatform();
  /** Observes the SDK event required by the checklist. */
  const mark = jest.spyOn(platform, "markFirstMilestone");
  await recordAuthoritativeCompletion(platform, session({preferences: {firstMilestoneMarked: true}}), {
    gameMode: "classic", isCorrect: true,
  });
  expect(mark).toHaveBeenCalledTimes(1);
});
