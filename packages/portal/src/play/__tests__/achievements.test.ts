import {describe, expect, it} from "@jest/globals";
import {RACE_ACHIEVEMENT_IDS} from "@qwordly/core/race";
import {ACHIEVEMENT_DEFINITIONS} from "../achievements";

describe("multiplayer achievement presentation", () => {
  it("defines every authoritative multiplayer achievement with localized copy", () => {
    const definitions = new Map(ACHIEVEMENT_DEFINITIONS.map((achievement) => [achievement.id, achievement]));

    for (const achievementId of RACE_ACHIEVEMENT_IDS) {
      const achievement = definitions.get(achievementId);
      expect(achievement).toBeDefined();
      expect(achievement?.nameKey).toMatch(/^RaceTo10\.ACHIEVEMENT_/);
      expect(achievement?.descriptionKey).toMatch(/^RaceTo10\.ACHIEVEMENT_/);
    }
  });

  it("calculates multiplayer progress from authoritative profile statistics", () => {
    const wins = ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "race_wins_25");
    const hosts = ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "race_hosts_5");

    expect(wins?.getProgress({stats: {multiplayerWins: 12} as never})).toBe(12);
    expect(hosts?.getProgress({stats: {multiplayerChallengesCreated: 3} as never})).toBe(3);
  });
});
