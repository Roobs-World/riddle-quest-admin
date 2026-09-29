import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import type {GameSessionState} from "../gameSession";
import {LeaderboardModalPage} from "../modalPages/leaderboard/LeaderboardModalPage";

/** No-op leaderboard request used during server rendering. */
const requestLeaderboard = () => undefined;

/** Creates deterministic leaderboard entries for modal rendering. */
const createEntries = (count: number): GameSessionState["leaderboard"] =>
  Array.from({length: count}, (_, index) => ({
    userId: `player-${index + 1}`,
    username: `Player ${index + 1}`,
    avatarUrl: index === 0 ? "https://example.com/avatar.webp" : undefined,
    level: 1,
    xp: 100 - index,
    totalWins: index,
    bestStreak: index + 1,
  }));

describe("LeaderboardModalPage", () => {
  it("renders loading and empty states", () => {
    expect(
      renderToString(
        <LeaderboardModalPage entries={[]} loading leaderboardType="xp" onRequestLeaderboard={requestLeaderboard} />,
      ),
    ).toContain('aria-busy="true"');
    const loadingHtml = renderToString(
      <LeaderboardModalPage entries={[]} loading leaderboardType="xp" onRequestLeaderboard={requestLeaderboard} />,
    );
    expect(loadingHtml).toContain("leaderboard-loading");
    expect(loadingHtml).toMatch(/disabled=""/g);
    expect(loadingHtml.match(/disabled=""/g)).toHaveLength(3);
    expect(
      renderToString(
        <LeaderboardModalPage
          entries={[]}
          loading={false}
          leaderboardType="xp"
          onRequestLeaderboard={requestLeaderboard}
        />,
      ),
    ).toContain("No scores yet");
  });

  it("renders ranked entries, avatar fallbacks, and pagination", () => {
    /** Rendered leaderboard containing more than one page. */
    const html = renderToString(
      <LeaderboardModalPage
        entries={createEntries(11)}
        loading={false}
        leaderboardType="totalWins"
        onRequestLeaderboard={requestLeaderboard}
      />,
    );
    expect(html).toContain("Player 1");
    expect(html).toContain("leaderboard-avatar");
    expect(html).toContain("leaderboard-avatar-fallback");
    expect(html).toContain("leaderboard-pagination");
  });
});
