import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import type {BridgeProfile} from "@qwordly/core/bridge";
import {AchievementsModalPage, RanksModalPage, StatisticsModalPage} from "../modalPages/profile/ProfileStatsModalPages";

/** Profile fixture shared by profile-detail rendering tests. */
const profile: BridgeProfile = {
  userId: "profile-pages",
  username: "Nova",
  coins: 50,
  xp: 420,
  level: 3,
  achievements: ["first_win"],
  stats: {},
  gamesPlayed: 4,
  wins: 3,
  totalWins: 3,
  bestStreak: 2,
  winRate: 75,
  averageGuesses: 3.5,
};

describe("profile detail modal pages", () => {
  it("renders achievement progress for profiles and guests", () => {
    expect(renderToString(<AchievementsModalPage profile={profile} />)).toContain("achievement-grid");
    expect(renderToString(<AchievementsModalPage profile={null} />)).toContain("achievement-progress");
  });

  it("renders the complete statistics grid", () => {
    /** Statistics markup for a populated trusted profile. */
    const html = renderToString(<StatisticsModalPage profile={profile} />);
    expect(html).toContain("Games Played");
    expect(html).toContain("75%");
    expect(html).toContain("3.5");
  });

  it("highlights the current rank with a guest fallback", () => {
    expect(renderToString(<RanksModalPage profile={profile} />)).toContain('class="current"');
    expect(renderToString(<RanksModalPage profile={null} />)).toContain("Stargazer");
  });
});
