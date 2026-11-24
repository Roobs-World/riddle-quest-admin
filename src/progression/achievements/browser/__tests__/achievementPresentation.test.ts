import {ACHIEVEMENT_DEFINITIONS} from "../../catalog/achievements";
import {createLocalAchievementPlayer, getAchievementProgressViews, orderAchievementDefinitions} from "../../achievementPresentation";
import {LOCAL_ACHIEVEMENT_DEFINITIONS, YOUTUBE_ACHIEVEMENTS} from "../../localAchievements";
import {createEmptyYouTubeSave} from "../../../../gameplay/persistence/localSave";
import {achievementText} from "../../../../localization/copy/achievementCopy";
import {SUPPORTED_LOCALES} from "../../../../localization/locales";

describe("achievement requirements", () => {
  it("shows the minimum sample and win rate as separate conditions", () => {
    const definition = ACHIEVEMENT_DEFINITIONS.find(({id}) => id === "win_rate_80");
    expect(definition).toBeDefined();
    if (!definition) return;
    const views = getAchievementProgressViews(definition, {stats: {gamesPlayed: 1, winRate: 100}}, false);
    expect(views.map(({ratio}) => ratio)).toEqual([0.1, 1]);
    expect(views.map(({text}) => text)).toEqual(["1 / 10", "100% / 80%"]);
  });

  it("shows an unmet guessing average even after ten wins", () => {
    const definition = ACHIEVEMENT_DEFINITIONS.find(({id}) => id === "efficient_10");
    expect(definition).toBeDefined();
    if (!definition) return;
    expect(getAchievementProgressViews(definition, {stats: {totalWins: 10, averageGuesses: 4}}, false)
      .map(({text, ratio}) => ({text, ratio}))).toEqual([{text: "10 / 10", ratio: 1}, {text: "4 ≤ 3", ratio: 0.75}]);
    expect(getAchievementProgressViews(definition, {stats: {totalWins: 10}}, false)[1].value).toBeNull();
  });

  it("keeps earned badges complete after consumable balances fall and rejects nonfinite progress", () => {
    const definition = ACHIEVEMENT_DEFINITIONS.find(({id}) => id === "coin_hoarder");
    expect(definition).toBeDefined();
    if (!definition) return;
    expect(getAchievementProgressViews(definition, {coins: 0}, true)[0].ratio).toBe(1);
    for (const coins of [NaN, Infinity, -10]) {
      expect(getAchievementProgressViews(definition, {coins}, false)[0]).toMatchObject({value: 0, ratio: 0});
    }
  });

  it("orders earned goals first and then remaining goals by completion without changing the catalog", () => {
    const definitions = ACHIEVEMENT_DEFINITIONS.filter(({id}) => ["first_win", "wins_5", "wins_25"].includes(id));
    const player = {stats: {totalWins: 2}};
    expect(orderAchievementDefinitions(definitions, player, ["wins_25"]).map(({id}) => id))
      .toEqual(["wins_25", "first_win", "wins_5"]);
    expect(definitions.map(({id}) => id)).toEqual(["first_win", "wins_5", "wins_25"]);
  });
});

describe("offline achievement collection", () => {
  it("offers exactly the goals the local authority supports", () => {
    expect(new Set(LOCAL_ACHIEVEMENT_DEFINITIONS.map(({id}) => id)))
      .toEqual(new Set(YOUTUBE_ACHIEVEMENTS.map(({id}) => id)));
    expect(LOCAL_ACHIEVEMENT_DEFINITIONS.some(({id}) => id === "first_purchase" || id.startsWith("race_"))).toBe(false);
    const progress = createEmptyYouTubeSave("test").progression;
    progress.highestClassicLevel = 10;
    progress.bestDailyStreak = 7;
    expect(createLocalAchievementPlayer(progress).stats).toMatchObject({highestLevelClassic: 10, bestStreak: 7});
  });

  it("provides existing names and requirements in every supported locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const definition of LOCAL_ACHIEVEMENT_DEFINITIONS) {
        expect(achievementText(locale, definition.nameKey ?? "", "missing")).not.toBe("missing");
        expect(achievementText(locale, definition.descriptionKey ?? "", "missing")).not.toBe("missing");
      }
      expect(achievementText(locale, "StatsModal.AVG_GUESSES", "missing")).not.toBe("missing");
    }
  });
});
