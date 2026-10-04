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
    /** Provides loading html behavior. */
    const loadingHtml = renderToString(
      <LeaderboardModalPage entries={[]} loading leaderboardType="xp" onRequestLeaderboard={requestLeaderboard} />,
    );
    expect(loadingHtml).toContain("leaderboard-loading");
    expect(loadingHtml).toMatch(/disabled=""/g);
    expect(loadingHtml.match(/disabled=""/g)).toHaveLength(4);
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

  it("offers Retry after a failed read instead of claiming there are no scores", () => {
    /** Failed ranking renders a recoverable error rather than an empty result. */
    const html = renderToString(<LeaderboardModalPage entries={[]} loading={false} loadError
      leaderboardType="totalWins" onRequestLeaderboard={requestLeaderboard} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Could not load leaderboard");
    expect(html).toContain(">Retry</button>");
    expect(html).not.toContain("No scores yet");
  });

  it("retains confirmed rows while a same-metric refresh is unavailable", () => {
    /** Confirmed entries stay available alongside the failed refresh notice. */
    const html = renderToString(<LeaderboardModalPage entries={createEntries(11)} loading={false} loadError
      leaderboardType="totalWins" onRequestLeaderboard={requestLeaderboard} />);
    expect(html).toContain("Player 1");
    expect(html).toContain("Could not load leaderboard");
    expect(html).toContain("leaderboard-pagination");
  });

  it("renders multiplayer victories separately from solo wins and supports older rows", () => {
    /** Rendered multiplayer measurement with a legacy row. */
    const html = renderToString(
      <LeaderboardModalPage entries={[{...createEntries(1)[0], multiplayerWins: 42}, {...createEntries(2)[1]}]}
        loading={false} leaderboardType="multiplayerWins" onRequestLeaderboard={requestLeaderboard} />,
    );
    expect(html).toContain('aria-pressed="true">Multiplayer wins');
    expect(html).toContain("<strong>42</strong>");
    expect(html).toContain("<strong>0</strong>");
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
