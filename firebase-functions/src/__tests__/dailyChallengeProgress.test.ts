import {afterEach, describe, expect, it, jest} from "@jest/globals";
import type {Player} from "../validation/firestoreSchemas";
import {resolveDailyChallengeProgress} from "../daily/dailyChallengeProgress";

const NOW = new Date("2026-08-09T12:00:00.000Z");

function player(overrides: Partial<Player> = {}): Player {
  return {
    userId: "player-1",
    email: "player@example.com",
    username: "player",
    coins: 0,
    hasPurchasedApp: false,
    stats: {},
    progress: {classicIndex: 0, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
    registeredAt: NOW.getTime(),
    lastLogin: NOW.getTime(),
    ...overrides,
  } as Player;
}

describe("daily challenge progress rollover", () => {
  afterEach(() => jest.useRealTimers());

  it("returns empty progress for a missing player", () => {
    expect(resolveDailyChallengeProgress(undefined, 1)).toEqual({
      currentQuestion: 0,
      hasCompletedToday: false,
      questionsCompleted: 0,
    });
  });

  it("lazily resets stale stored progress", () => {
    jest.useFakeTimers().setSystemTime(NOW);
    expect(
      resolveDailyChallengeProgress(
        player({
          lastDailyChallengeCompletedAt: new Date("2026-08-08T23:59:59.000Z").getTime(),
          progress: {classicIndex: 0, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 1},
        }),
        1,
      ),
    ).toEqual({currentQuestion: 0, hasCompletedToday: false, questionsCompleted: 0});
  });

  it("treats a missing completion time as incomplete", () => {
    jest.useFakeTimers().setSystemTime(NOW);
    expect(resolveDailyChallengeProgress(player({lastDailyChallengeCompletedAt: undefined}), 1)).toEqual({
      currentQuestion: 0,
      hasCompletedToday: false,
      questionsCompleted: 0,
    });
  });

  it("caps completed stored progress at the challenge size", () => {
    jest.useFakeTimers().setSystemTime(NOW);
    expect(
      resolveDailyChallengeProgress(
        player({
          lastDailyChallengeCompletedAt: NOW.getTime(),
          progress: {classicIndex: 0, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 4},
        }),
        1,
      ),
    ).toEqual({currentQuestion: 1, hasCompletedToday: true, questionsCompleted: 1});
  });

  it("defaults missing stored progress after a same-day completion", () => {
    jest.useFakeTimers().setSystemTime(NOW);
    expect(
      resolveDailyChallengeProgress(player({lastDailyChallengeCompletedAt: NOW.getTime(), progress: undefined}), 1),
    ).toEqual({currentQuestion: 0, hasCompletedToday: true, questionsCompleted: 1});
  });
});
