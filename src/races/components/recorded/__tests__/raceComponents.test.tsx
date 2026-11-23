import {describe, expect, it, jest} from "@jest/globals";
import {Children, isValidElement, type ReactElement, type ReactNode} from "react";
import {renderToString} from "react-dom/server";
import type {PublishRaceChallengeResponse, RaceChallengePreview, RaceOutcome} from "../../../contracts/index";
import {RaceTo10Game} from "../RaceTo10Game";
import {RaceCountdown} from "../../gameplay/RaceCountdown";
import {RaceGameplay} from "../../gameplay/RaceGameplay";
import {RaceHubTabs} from "../../lobby/RaceHubTabs";
import {
  RaceCategoriesPanel,
  RaceChallengePanel,
  RaceInboxPanel,
  RaceTournamentPanel,
} from "../../lobby/RaceLobbyPanels";
import {RaceQuitDialog} from "../../gameplay/RaceQuitDialog";
import {RaceResultPanel} from "../../gameplay/RaceResultPanel";
import {RaceScoreboard} from "../../gameplay/RaceScoreboard";
import {createFakeRaceServices} from "../../../testing/browser/fakeRaceServices";

// Direct presentation-callback tests run outside React's hook dispatcher.
// The injected browser suite verifies the real referral provider and SDK flow.
jest.mock("../../../../sharing/components/ReferralSharingCapability", () => ({
  /** Keeps isolated presentation tests independent of the platform provider. */
  useReferralSharing: () => null,
}));

/** No-op callback used by server-rendered presentation components. */
const noop = () => undefined;

/** Describes test element props. */
type TestElementProps = {
  /** Stores children. */
  children?: ReactNode;
  /** Stores class name. */
  className?: string;
  /** Stores on click. */
  onClick?: () => void;
  /** Accessible navigation role exposed by the presented element. */ role?: string;
  /** Keyboard navigation callback exercised through its presentation interface. */
  onKeyDown?: (event: {
    /** Browser keyboard key identifying a navigation action. */ key: string;
    /** Consumes default browser behavior only for supported navigation keys. */ preventDefault: () => void;
  }) => void;
};

/** Finds a server-renderable element so its presentation callback can be verified directly. */
function findElement(
  node: ReactNode,
  predicate: (props: TestElementProps) => boolean,
): ReactElement<TestElementProps> | null {
  if (!isValidElement<TestElementProps>(node)) return null;
  if (predicate(node.props)) return node;
  for (const child of Children.toArray(node.props.children)) {
    /** Provides match behavior. */
    const match = findElement(child, predicate);
    if (match) return match;
  }
  return null;
}

describe("race presentation components", () => {
  it.each([false, true])("supports keyboard wraparound and endpoint navigation with tournament capability %s", tournaments => {
    /** Player navigation effects are observable independently of rendering. */
    const selected: string[] = [];
    /** Focus adapters represent the mounted accessible buttons. */
    const focus = [jest.fn(), jest.fn(), jest.fn()];
    /** Direct callback tests use a ref adapter; injected browser checks retain real React refs. */
    const react = jest.requireActual<typeof import("react")>("react");
    /** Spy on the real module export rather than TypeScript's immutable namespace wrapper. */
    const ref = jest.spyOn(react, "useRef").mockReturnValue({current: focus.map(callback => ({focus: callback}))});
    try {
      /** Optional tournament capability changes the set of reachable tabs. */
      const rendered = RaceHubTabs({active: "play", onPlay: () => selected.push("play"), onActivity: () => selected.push("activity"),
        ...(tournaments ? {onTournaments: () => selected.push("tournaments")} : {})});
      /** First accessible tab receives arrow/home/end events. */
      const play = findElement(rendered, props => props.role === "tab")!;
      for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
        /** Only navigation keys should consume the browser's default behavior. */
        const preventDefault = jest.fn();
        play.props.onKeyDown!({key, preventDefault});
        expect(preventDefault).toHaveBeenCalledTimes(1);
      }
      expect(selected).toEqual([tournaments ? "tournaments" : "activity", "activity", "play", tournaments ? "tournaments" : "activity"]);
      expect(focus[0]).toHaveBeenCalledTimes(1);
      expect(focus[tournaments ? 2 : 1]).toHaveBeenCalledTimes(tournaments ? 2 : 3);
      /** Non-navigation keys retain browser behavior and do not switch tabs. */
      const unchanged = jest.fn();
      play.props.onKeyDown!({key: "Enter", preventDefault: unchanged});
      expect(unchanged).not.toHaveBeenCalled();
      expect(selected).toHaveLength(4);
    } finally {ref.mockRestore();}
  });
  it("retains a keyboard entry point when the selected tournament capability disappears", () => {
    /** A provider update can remove the tab before its parent navigation effect runs. */
    const html = renderToString(<RaceHubTabs active="tournaments" onPlay={noop} onActivity={noop} />);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-selected="true"[^>]*>Play</);
    expect(html).not.toContain("Tournaments");
  });
  it("renders capability-appropriate accessible hub tabs", () => {
    /** Provides jest html behavior. */
    const jestHtml = renderToString(<RaceHubTabs active="play" onPlay={noop} onActivity={noop} />);
    expect(jestHtml).toContain('role="tablist"');
    expect(jestHtml).toContain('aria-selected="true"');
    expect(jestHtml).toContain("Play");
    expect(jestHtml).toContain("Activity");
    expect(jestHtml).not.toContain("Tournaments");

    /** Provides reddit html behavior. */
    const redditHtml = renderToString(<RaceHubTabs active="activity" onPlay={noop} onActivity={noop} />);
    expect(redditHtml).toContain('role="tablist"');
    expect(redditHtml.match(/role="tab"/g)).toHaveLength(2);
    expect(redditHtml).toContain("Play");
    expect(redditHtml).toContain("Activity");
    expect(redditHtml).not.toContain("Tournaments");
    expect(redditHtml).not.toContain("Find opponent");
    expect(redditHtml).not.toContain("Play with friends");

    /** Provides reddit match html behavior. */
    const redditMatchHtml = renderToString(
      <RaceHubTabs active="play" onPlay={noop} onActivity={noop} onMatchPlayer={noop} />,
    );
    expect(redditMatchHtml).toContain("Find opponent");
    expect(redditMatchHtml).not.toContain("Play with friends");

    /** Provides facebook html behavior. */
    const facebookHtml = renderToString(
      <RaceHubTabs
        active="tournaments"
        onPlay={noop}
        onActivity={noop}
        onTournaments={noop}
        onChooseContext={noop}
        onMatchPlayer={noop}
      />,
    );
    expect(facebookHtml).toContain("Tournaments");
    expect(facebookHtml).toContain("Find opponent");
    expect(facebookHtml).toContain("Play with friends");
    /** Only the native social action currently awaiting its provider is announced busy. */
    const socialPendingHtml = renderToString(
      <RaceHubTabs
        active="play"
        onPlay={noop}
        onActivity={noop}
        onChooseContext={noop}
        onMatchPlayer={noop}
        socialPending="match"
      />,
    );
    expect(socialPendingHtml.match(/aria-busy="true"/g)).toHaveLength(1);
  });

  it("renders identity-free, economy-free tournament standings", () => {
    /** Provides html behavior. */
    const html = renderToString(
      <RaceTournamentPanel
        loading={false}
        tournament={{
          tournamentId: "facebook-race10-en-2026-08-19",
          locale: "en",
          startsAtMs: 1,
          endsAtMs: 2,
          sortOrder: "LOWER_IS_BETTER",
          rewardsEnabled: false,
          standings: [{rank: 1, adjustedTimeMs: 45_000, isCurrentPlayer: true}],
          currentPlayer: {rank: 1, adjustedTimeMs: 45_000, isCurrentPlayer: true},
        }}
      />,
    );
    expect(html).toContain("Tournaments");
    expect(html).toContain('data-rewards-enabled="false"');
    expect(html).toContain('aria-current="true"');
    expect(html.replaceAll("<!-- -->", "")).toContain("#1");
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("0:45.0");
    expect(html).not.toContain("facebook_");
    expect(html).not.toContain("Share tournament");
  });

  it("exposes the native tournament share control only for a current-player score and target capability", () => {
    /** An identity-free score is required before offering native publication. */
    const currentPlayer = {rank: 1, adjustedTimeMs: 45000, isCurrentPlayer: true};
    /** A target without share support continues to render the same standings. */
    const tournament = {tournamentId: "facebook-race10-en-2026-08-19", locale: "en" as const, startsAtMs: 1, endsAtMs: 2,
      sortOrder: "LOWER_IS_BETTER" as const, rewardsEnabled: false as const, standings: [currentPlayer], currentPlayer};
    /** Native-dialog occupancy is visible as a disabled, accessible button. */
    const html = renderToString(<RaceTournamentPanel loading={false} tournament={tournament} sharing={true} onShare={noop} />);
    expect(html).toContain("Share tournament");
    expect(html).toContain('disabled=""');
    expect(renderToString(<RaceTournamentPanel loading={false} tournament={{...tournament, standings: [], currentPlayer: undefined}} onShare={noop} />))
      .not.toContain("Share tournament");
  });

  it("renders an identity-free context board inside Activity", () => {
    /** Provides html behavior. */
    const html = renderToString(
      <RaceInboxPanel
        items={[]}
        loading={false}
        safetyPending={null}
        contextBoardLoading={false}
        contextBoard={{
          locale: "en",
          startsAtMs: 1,
          endsAtMs: 2,
          sortOrder: "LOWER_IS_BETTER",
          rewardsEnabled: false,
          standings: [{rank: 2, adjustedTimeMs: 31_000, isCurrentPlayer: true}],
          currentPlayer: {rank: 2, adjustedTimeMs: 31_000, isCurrentPlayer: true},
        }}
        onRematch={noop}
        onBlock={noop}
        onReport={noop}
        onChooseCategory={noop}
      />,
    );
    expect(html).toContain("race-context-board");
    expect(html).toContain('data-rewards-enabled="false"');
    expect(html).toContain("0:31.0");
    expect(html).not.toContain("facebook_");
  });

  it("disables category starts while discovery owns the session and restores them afterward", async () => {
    /** Canonical category fixtures exercise discovery-owned start controls. */
    const categories = (await createFakeRaceServices().listRaceCategories("en")).categories;
    for (const busy of [true, false]) {
      /** Rendered markup exposes the current control and accessibility state. */
      const html = renderToString(<RaceCategoriesPanel categories={categories} loading={false} busy={busy} onSelect={noop} onShowInbox={noop} />);
      /** Category grid isolates start-button disabled assertions. */
      const grid = html.split('class="race-category-grid"')[1].split('</div>')[0];
      expect((grid.match(/disabled=""/g) ?? []).length).toBe(busy ? categories.length : 0);
    }
  });

  it("renders category, inbox, and challenge lobby states", async () => {
    /** Deterministic fake data source for presentation fixtures. */
    const services = createFakeRaceServices();
    /** Category fixtures returned by the same contract as production. */
    const categories = (await services.listRaceCategories("en")).categories;
    /** Rendered category selection panel. */
    const categoriesHtml = renderToString(
      <RaceCategoriesPanel categories={categories} loading onSelect={noop} onShowInbox={noop} />,
    );
    expect(categoriesHtml).toContain("race-category-grid");
    expect(categoriesHtml).toContain("Loading categories");
    expect(categoriesHtml).not.toContain("riddles ready");
    expect(categoriesHtml).not.toContain(String(categories[0]?.availableRiddleCount));

    /** Rendered populated race inbox. */
    const inboxHtml = renderToString(
      <RaceInboxPanel
        items={[
          {
            itemId: "result-1",
            challengeId: "challenge-1",
            opponentUserId: "facebook_1111111111111111111111111111111111111111",
            opponentDisplayName: "Nova",
            categoryId: "history",
            result: "win",
            adjustedDeltaMs: 3_500,
            read: false,
            createdAtMs: 1,
          },
        ]}
        loading={false}
        safetyPending={null}
        onRematch={noop}
        onBlock={noop}
        onReport={noop}
        onChooseCategory={noop}
      />,
    );
    expect(inboxHtml).toContain("Nova");
    expect(inboxHtml).toContain("Safety options");
    expect(inboxHtml).toContain("Block opponent");
    expect(inboxHtml).toContain("Report opponent");
    /** The selected safety mutation provides immediate, action-specific busy feedback. */
    const safetyPendingHtml = renderToString(
      <RaceInboxPanel
        items={[
          {
            itemId: "result-1",
            challengeId: "challenge-1",
            opponentUserId: "facebook_1111111111111111111111111111111111111111",
            opponentDisplayName: "Nova",
            categoryId: "history",
            result: "win",
            adjustedDeltaMs: 3_500,
            read: false,
            createdAtMs: 1,
          },
        ]}
        loading={false}
        safetyPending={{
          operation: "raceBlock",
          targetUserId: "facebook_1111111111111111111111111111111111111111",
        }}
        onRematch={noop}
        onBlock={noop}
        onReport={noop}
        onChooseCategory={noop}
      />,
    );
    expect(safetyPendingHtml).toContain('aria-busy="true"');
    expect(
      renderToString(
        <RaceInboxPanel
          items={[]}
          loading={false}
          safetyPending={null}
          onRematch={noop}
          onBlock={noop}
          onReport={noop}
          onChooseCategory={noop}
        />,
      ),
    ).toContain("No results yet");

    /** Active challenge preview fixture. */
    const challenge: RaceChallengePreview = {
      challengeId: "challenge-1",
      locale: "en",
      creator: {displayName: "Nova"},
      categoryId: "history",
      targetCorrect: 10,
      adjustedTimeToBeatMs: 45_000,
      rulesVersion: "race10_v1",
      expiresAtMs: Date.now() + 10_000,
      status: "active",
    };
    expect(renderToString(<RaceChallengePanel challenge={challenge} onAccept={noop} />)).toContain("Nova");
    expect(renderToString(<RaceChallengePanel challenge={null} onAccept={noop} />)).toContain("Loading challenge");
    expect(
      renderToString(<RaceChallengePanel challenge={{...challenge, status: "expired"}} onAccept={noop} />),
    ).toContain('role="alert"');
  });

  it("does not offer acceptance while recovering an existing recipient attempt", () => {
    /** Canonical preview used to render recipient or creator challenge controls. */
    const challenge: RaceChallengePreview = {challengeId: "played", locale: "en", creator: {displayName: "Nova"},
      categoryId: "history", targetCorrect: 10, adjustedTimeToBeatMs: 45000, rulesVersion: "race10_v1",
      expiresAtMs: 1800000100000, status: "active"};
    /** Negotiated entry facts determine the card's acceptance and results actions. */
    const entry = {status: "ready" as const, challenge, viewerRole: "recipient" as const, existingRunId: "completed-run", serverNowMs: 1800000000000};
    /** Rendered challenge markup verifies the actual translated control selection. */
    const html = renderToString(<RaceChallengePanel challenge={challenge} entryStatus={entry} onAccept={noop} />);
    expect(html).not.toContain("Accept challenge");
    expect(html).toContain("Loading challenge");
  });

  it("does not offer a creator their own public challenge", () => {
    /** Canonical preview used to render recipient or creator challenge controls. */
    const challenge: RaceChallengePreview = {challengeId: "own-public", locale: "en", creator: {displayName: "Nova"},
      categoryId: "history", targetCorrect: 10, adjustedTimeToBeatMs: 45000, rulesVersion: "race10_v1",
      expiresAtMs: 1800000100000, status: "active"};
    /** Negotiated entry facts determine the card's acceptance and results actions. */
    const entry = {status: "ready" as const, challenge, viewerRole: "creator" as const, serverNowMs: 1800000000000};
    /** Rendered challenge markup verifies the actual translated control selection. */
    const html = renderToString(<RaceChallengePanel challenge={challenge} entryStatus={entry} onAccept={noop} />);
    expect(html).not.toContain("Accept challenge");
    expect(html).not.toContain("challenged you");
    expect(html).toContain("Run recorded!");
    expect(html).not.toContain("Cancel invitation");
  });

  it("binds selected category ids to lobby and result actions", async () => {
    /** Provides categories behavior. */
    const categories = (await createFakeRaceServices().listRaceCategories("en")).categories;
    /** Provides on select behavior. */
    const onSelect = jest.fn();
    /** Provides category panel behavior. */
    const categoryPanel = RaceCategoriesPanel({
      categories,
      loading: false,
      onSelect,
      onShowInbox: noop,
    });
    /** Provides category grid behavior. */
    const categoryGrid = findElement(categoryPanel, ({className}) => className === "race-category-grid");
    /** Provides category button behavior. */
    const categoryButton = findElement(categoryGrid, ({onClick}) => Boolean(onClick));
    expect(categoryButton).not.toBeNull();
    categoryButton?.props.onClick?.();
    expect(onSelect).toHaveBeenCalledWith(categories[0]?.categoryId);

    /** Provides {run} behavior. */
    const {run} = await createFakeRaceServices().startRace({
      locale: "en",
      categoryId: "science",
      requestId: "request-presentation-actions",
    });
    /** Provides on rematch behavior. */
    const onRematch = jest.fn();
    /** Provides result panel behavior. */
    const resultPanel = RaceResultPanel({
      outcome: {
        runId: run.runId,
        result: "recorded",
        correctCount: 10,
        wallFinishMs: 40_000,
        hintPenaltyMs: 0,
        skipPenaltyMs: 0,
        totalPenaltyMs: 0,
        adjustedFinishMs: 40_000,
        publishable: false,
        rematchEligible: true,
        newlyUnlockedAchievementIds: [],
        achievementCoinsAwarded: 0,
      },
      run,
      publication: null,
      publishing: false,
      onPublish: noop,
      onShare: noop,
      onRematch,
      onChooseCategory: noop,
      onClose: noop,
    });
    /** Provides rematch actions behavior. */
    const rematchActions = findElement(resultPanel, ({className}) => className === "race-rematch-actions");
    /** Provides rematch button behavior. */
    const rematchButton = findElement(rematchActions, ({className}) => className === "race-primary");
    expect(rematchButton).not.toBeNull();
    rematchButton?.props.onClick?.();
    expect(onRematch).toHaveBeenCalledWith("science");
  });

  it("keeps Jest sharing out of the lobby until a run has completed", async () => {
    /** Categories required before the challenge action can be used. */
    const categories = (await createFakeRaceServices().listRaceCategories("en")).categories;
    /** Challenge-enabled lobby presentation. */
    const panel = RaceCategoriesPanel({
      categories,
      loading: false,
      onSelect: noop,
      onShowInbox: noop,
    });
    expect(renderToString(panel)).not.toContain("Challenge a player");
  });

  it("renders countdown, scoreboard, result, and quit variants", async () => {
    /** Deterministic run fixture used by the scoreboard. */
    const {run} = await createFakeRaceServices().startRace({
      locale: "en",
      categoryId: "science",
      requestId: "request-components",
    });
    /** Captures loading html for this regression check. */
    const loadingHtml = renderToString(<RaceCountdown countdown={3} loading loadingProgress={65} coins={1_250} onClose={noop} />);
    expect(loadingHtml).not.toContain("<span>3</span>");
    expect(loadingHtml).toContain("65%");
    expect(loadingHtml).toContain('role="progressbar"');
    expect(loadingHtml).not.toContain("race-coin-balance");
    expect(renderToString(<RaceCountdown countdown={0} loading={false} loadingProgress={100} coins={0} onClose={noop} />)).toContain("GO!");
    /** Scoreboard copy must explain what the bars and their values represent. */
    const scoreboardHtml = renderToString(
      <RaceScoreboard run={run} adjustedNow={12_500} opponentCorrect={0} feedback="correct" coins={50} onClose={noop} />,
    );
    expect(scoreboardHtml).toContain("Riddles completed: 0 / 10");
    expect(scoreboardHtml).not.toContain("riddles remaining");
    /** Provides gameplay html behavior. */
    const gameplayHtml = renderToString(
      <RaceGameplay
        viewportRef={{current: null}}
        gameplayRef={{current: null}}
        run={run}
        adjustedNow={12_500}
        opponentCorrect={0}
        feedback={null}
        coins={50}
        currentLetters={["", "", "", "", ""]}
        activeSlotIndex={0}
        guesses={[]}
        letterStates={{}}
        pending={false}
        allowTypingWhilePending={false}
        onClose={noop}
        onSelectSlot={noop}
        onLetter={noop}
        onText={noop}
        onBackspace={noop}
        onHint={noop}
        onSubmit={noop}
        onSkip={noop}
      />,
    );
    expect(gameplayHtml).not.toContain('race-coin-balance');
    expect(gameplayHtml).not.toContain('id="race-attempts"');
    expect(gameplayHtml).not.toMatch(/<button disabled=""><svg[^>]*>.*?<span>Skip/);
    expect(gameplayHtml).toContain('class="keyboard"');
    expect(gameplayHtml).toContain("+15 seconds");
    expect(gameplayHtml).toContain("+45 seconds");
    expect(gameplayHtml).not.toContain("+15s");
    expect(gameplayHtml).not.toContain("+45s");
    expect(
      renderToString(
        <RaceGameplay
          viewportRef={{current: null}}
          gameplayRef={{current: null}}
          run={{...run, status: "completed", correctCount: 10, currentRiddle: null}}
          adjustedNow={12_500}
          opponentCorrect={0}
          feedback={null}
          coins={50}
          currentLetters={[]}
          activeSlotIndex={0}
          guesses={[]}
          letterStates={{}}
          pending
          allowTypingWhilePending={false}
          onClose={noop}
          onSelectSlot={noop}
          onLetter={noop}
          onText={noop}
          onBackspace={noop}
          onHint={noop}
          onSubmit={noop}
          onSkip={noop}
        />,
      ),
    ).toContain("Loading results");

    /** Completed outcome fixture used by result variants. */
    const outcome: RaceOutcome = {
      runId: run.runId,
      result: "recorded",
      correctCount: 10,
      wallFinishMs: 40_000,
      hintPenaltyMs: 15_000,
      skipPenaltyMs: 0,
      totalPenaltyMs: 15_000,
      adjustedFinishMs: 55_000,
      publishable: true,
      rematchEligible: true,
      newlyUnlockedAchievementIds: [],
      achievementCoinsAwarded: 0,
    };
    /** Result markup retains both final scores after gameplay disappears. */
    const recordedResultHtml = renderToString(
        <RaceResultPanel
          outcome={outcome}
          run={{...run, status: "completed"}}
          publication={null}
          publishing={false}
          onPublish={noop}
          onShare={noop}
          onRematch={noop}
          onChooseCategory={noop}
          onClose={noop}
        />,
    );
    expect(recordedResultHtml).not.toContain("Send challenge");
    /** Competitive result retains both final scores after gameplay disappears. */
    const competitiveResultHtml = renderToString(
      <RaceResultPanel
        outcome={{...outcome, result: "player_win", publishable: false}}
        run={{
          ...run,
          role: "challenger",
          status: "completed",
          correctCount: 10,
          opponent: {displayName: "Ava", adjustedFinishMs: 55_000, events: []},
        }}
        publication={null}
        publishing={false}
        onPublish={noop}
        onShare={noop}
        onRematch={noop}
        onChooseCategory={noop}
        onClose={noop}
      />,
    );
    expect(competitiveResultHtml).toMatch(/You<\/small><strong>10.*\/.*10/);
    expect(competitiveResultHtml).toMatch(/Ava<\/small><strong>10.*\/.*10/);
    expect(
      renderToString(
        <RaceResultPanel
          outcome={outcome}
          run={{...run, status: "completed"}}
          publication={null}
          publishing={false}
          sharingRewardCoins={100}
          onPublish={noop}
          onShare={noop}
          onRematch={noop}
          onChooseCategory={noop}
          onClose={noop}
        />,
      ),
    ).toContain("Send challenge");
    expect(
      renderToString(
        <RaceResultPanel
          outcome={outcome}
          run={{...run, status: "completed"}}
          publication={null}
          publishing
          sharingRewardCoins={100}
          onPublish={noop}
          onShare={noop}
          onRematch={noop}
          onChooseCategory={noop}
          onClose={noop}
        />,
      ),
    ).toContain('disabled="" aria-busy="true"');
    expect(
      renderToString(
        <RaceResultPanel
          outcome={outcome}
          run={{...run, status: "completed"}}
          publication={null}
          publishing={false}
          sharingRewardCoins={100}
          onPublish={noop}
          onShare={noop}
          onRematch={noop}
          onChooseCategory={noop}
          onClose={noop}
        />,
      ),
    ).toContain("Choose a mobile number or another Jest user in Jest.");

    /** Published challenge fixture used by the share-ready result variant. */
    const publication: PublishRaceChallengeResponse = {
      challengeId: "challenge-1",
      preview: {
        challengeId: "challenge-1",
        creator: {displayName: "Solver"},
        categoryId: "science",
        targetCorrect: 10,
        adjustedTimeToBeatMs: 55_000,
        rulesVersion: "race10_v1",
        expiresAtMs: Date.now() + 10_000,
        status: "active",
      },
      newlyUnlockedAchievementIds: [],
      achievementCoinsAwarded: 0,
    };
    expect(
      renderToString(
        <RaceResultPanel
          outcome={outcome}
          run={null}
          publication={publication}
          publishing={false}
          sharingRewardCoins={100}
          onPublish={noop}
          onShare={noop}
          onRematch={noop}
          onChooseCategory={noop}
          onClose={noop}
        />,
      ),
    ).toContain("Challenge a friend");
    expect(
      renderToString(
        <RaceQuitDialog
          dialogRef={{current: null}}
          error="Network error"
          abandoning
          onCancel={noop}
          onConfirm={noop}
        />,
      ),
    ).toContain('aria-busy="true"');
    /** Provides idle quit dialog behavior. */
    const idleQuitDialog = renderToString(
      <RaceQuitDialog dialogRef={{current: null}} error={null} abandoning={false} onCancel={noop} onConfirm={noop} />,
    );
    expect(idleQuitDialog).toContain("Quit race");
    expect(idleQuitDialog).not.toContain("race-quit-error");
  });

  it("routes retired multiplayer entries to the PvP intro without a ghost fallback", async () => {
    /** Catalog remains available without reading or mutating any recorded race. */
    const categories = (await createFakeRaceServices().listRaceCategories("en")).categories;
    /** Shared intro inputs isolate navigation from historical challenge state. */
    const commonProps = {locale: "en" as const, coins: 10, postToHost: noop, onClose: noop, initialCategories: categories};
    for (const entry of [{}, {openInbox: true}, {tournamentLocale: "en" as const}, {challengeId: "retired-challenge"}]) {
      /** Retired entry renders the same live multiplayer intro. */
      const html = renderToString(<RaceTo10Game {...commonProps} {...entry} />);
      expect(html).toContain("race-category-grid");
      expect(html).toContain("Live PvP");
      expect(html).toContain("Start PvP match");
      expect(html).not.toMatch(/race-inbox|race-tournaments|race-challenge-card|Recorded head-to-head|Check results/);
      expect(html).toContain("Opponent search is unavailable for this account.");
      expect(html).toMatch(/disabled=""[^>]*>Start PvP match/);
    }
    /** Live transport enables entry without starting a server operation during render. */
    const html = renderToString(<RaceTo10Game {...commonProps} matchmaking={{find: async () => ({status: "cancelled"}), live: {
      join: async () => {throw new Error("SSR must not create a live seat");},
      update: async () => {throw new Error("SSR must not mutate a live seat");},
    }}} />);
    expect(html).not.toContain("Opponent search is unavailable for this account.");
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toMatch(/disabled=""[^>]*>Start PvP match/);
  });
});
