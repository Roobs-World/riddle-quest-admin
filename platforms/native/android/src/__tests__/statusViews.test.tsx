import {describe, expect, it} from "@jest/globals";
import {youtubeText, type YouTubeCopyKey} from "../../../../../src/localization/copy/localGameCopy";
import {render, screen} from "@testing-library/react-native";
import {AchievementRow, describeAchievement} from "../components/StatusViews";

/** English copy lookup. */
const text = (key: YouTubeCopyKey): string => youtubeText("en", key);

describe("describeAchievement", () => {
  it.each([
    ["first_win", "Wins: 1"],
    ["wins_10", "Wins: 10"],
    ["games_25", "Games: 25"],
    ["streak_7", "Streak: 7"],
    ["classic_first", "Classic: 1"],
    ["classic_50", "Classic: 50"],
    ["daily_first", "Daily: 1"],
    ["challenge_5", "Daily: 5"],
    ["hint_user", "Hint: 1"],
    ["hints_20", "Hint: 20"],
    ["level_10", "Level: 10"],
    ["xp_1000", "XP: 1000"],
    ["coin_hoarder", "Coins: 1000"],
    ["treasure_vault", "Coins: 2500"],
    ["win_rate_80", "Wins: 80%"],
    ["efficient_10", "Wins: 10 · Attempts: 3"],
    ["lesson_learned", "Not solved"],
    ["last_chance_hero", "Achievements: Attempts 5"],
    ["unknown_badge", "Achievements: Attempts 1"],
  ])("labels %s as %s", (id, expected) => {
    expect(describeAchievement(id, text)).toBe(expected);
  });
});

describe("AchievementRow", () => {
  it("renders one labelled icon per achievement", async () => {
    await render(<AchievementRow ids={["first_win", "coin_hoarder"]} text={text} label="Achievements" />);
    expect(screen.getByLabelText("Wins: 1")).toBeTruthy();
    expect(screen.getByLabelText("Coins: 1000")).toBeTruthy();
    expect(screen.getByLabelText("Achievements")).toBeTruthy();
  });
});
