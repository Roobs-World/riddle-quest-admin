import {describe, expect, it, jest} from "@jest/globals";
import {Children, isValidElement, type ReactElement, type ReactNode} from "react";
import {renderToString} from "react-dom/server";
import type {PublishRaceChallengeResponse, RaceChallengePreview, RaceOutcome} from "@qwordly/core/race";
import {RaceTo10Game} from "../RaceTo10Game";
import {RaceCountdown} from "../components/RaceCountdown";
import {RaceGameplay} from "../components/RaceGameplay";
import {RaceHubTabs} from "../components/RaceHubTabs";
import {
  RaceCategoriesPanel,
  RaceChallengePanel,
  RaceInboxPanel,
  RaceTournamentPanel,
} from "../components/RaceLobbyPanels";
import {RaceQuitDialog} from "../components/RaceQuitDialog";
import {RaceResultPanel} from "../components/RaceResultPanel";
import {RaceScoreboard} from "../components/RaceScoreboard";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

// Direct presentation-callback tests run outside React's hook dispatcher.
// The injected browser suite verifies the real referral provider and SDK flow.
jest.mock("../../sharing/ReferralSharingCapability", () => ({
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
    expect(html).toContain("<strong>#");
    expect(html).toContain("0:45.0");
    expect(html).not.toContain("facebook_");
  });

  it("renders an identity-free context board inside Activity", () => {
    /** Provides html behavior. */
    const html = renderToString(
      <RaceInboxPanel
        items={[]}
        loading={false}
        safetyPending={false}
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
        safetyPending={false}
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
    expect(
      renderToString(
        <RaceInboxPanel
          items={[]}
          loading={false}
          safetyPending={false}
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

  it("renders countdown, scoreboard, result, and quit variants", async () => {
    /** Deterministic run fixture used by the scoreboard. */
    const {run} = await createFakeRaceServices().startRace({
      locale: "en",
      categoryId: "science",
      requestId: "request-components",
    });
    /** Captures loading html for this regression check. */
    const loadingHtml = renderToString(<RaceCountdown countdown={3} loading coins={1_250} onClose={noop} />);
    expect(loadingHtml).not.toContain("<span>3</span>");
    expect(loadingHtml).not.toContain("race-coin-balance");
    expect(renderToString(<RaceCountdown countdown={0} loading={false} coins={0} onClose={noop} />)).toContain("GO!");
    expect(
      renderToString(
        <RaceScoreboard run={run} adjustedNow={12_500} ghostCorrect={0} feedback="correct" coins={50} onClose={noop} />,
      ),
    ).not.toContain("riddles remaining");
    /** Provides gameplay html behavior. */
    const gameplayHtml = renderToString(
      <RaceGameplay
        viewportRef={{current: null}}
        gameplayRef={{current: null}}
        run={run}
        adjustedNow={12_500}
        ghostCorrect={0}
        feedback={null}
        coins={50}
        currentLetters={["", "", "", "", ""]}
        activeSlotIndex={0}
        guesses={[]}
        letterStates={{}}
        pending={false}
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
          ghostCorrect={0}
          feedback={null}
          coins={50}
          currentLetters={[]}
          activeSlotIndex={0}
          guesses={[]}
          letterStates={{}}
          pending
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
    expect(
      renderToString(
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
      ),
    ).not.toContain("Send challenge");
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
    ).toContain("Quitting");
    /** Provides idle quit dialog behavior. */
    const idleQuitDialog = renderToString(
      <RaceQuitDialog dialogRef={{current: null}} error={null} abandoning={false} onCancel={noop} onConfirm={noop} />,
    );
    expect(idleQuitDialog).toContain("Quit race");
    expect(idleQuitDialog).not.toContain("race-quit-error");
  });

  it("server-renders each initial controller route", async () => {
    /** Initial categories supplied synchronously to the controller. */
    const categories = (await createFakeRaceServices().listRaceCategories("en")).categories;
    /** Shared controller properties for isolated server rendering. */
    const commonProps = {locale: "en" as const, coins: 10, postToHost: noop, onClose: noop};
    expect(renderToString(<RaceTo10Game {...commonProps} initialCategories={categories} />)).toContain(
      "race-category-grid",
    );
    expect(renderToString(<RaceTo10Game {...commonProps} openInbox />)).toContain("race-inbox");
    expect(renderToString(<RaceTo10Game {...commonProps} challengeId="challenge-1" />)).toContain(
      "race-challenge-card",
    );
  });
});
