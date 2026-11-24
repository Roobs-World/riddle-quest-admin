import {describe, expect, it} from "@jest/globals";
import {render, screen} from "@testing-library/react-native";
import {AchievementRow, describeAchievement} from "../components/StatusViews";

describe("achievement presentation", () => {
  it("describes mode-specific badges using their actual requirements", () => {
    expect(describeAchievement("classic_perfect", "en")).toBe("Classic Bullseye: Solve a classic riddle on your first guess");
    expect(describeAchievement("challenge_last_chance", "en")).toBe("Daily Comeback: Solve a daily challenge on your final guess");
    expect(describeAchievement("race_debut", "en")).toBe("Race Debut: Complete your first multiplayer race");
    expect(describeAchievement("unknown_badge", "en")).toBe("Achievements");
    expect(describeAchievement("classic_perfect", "fr")).not.toContain("Classic Bullseye");
  });

  it("shows localized names and requirements and deduplicates stored badges", async () => {
    await render(<AchievementRow ids={["first_win", "coin_hoarder", "first_win"]} locale="en" label="Achievements" />);
    expect(screen.getAllByText("First Win")).toHaveLength(1);
    expect(screen.getByText("Hold 1,000 coins")).toBeTruthy();
    expect(screen.getByLabelText("Achievements")).toBeTruthy();
  });
});
