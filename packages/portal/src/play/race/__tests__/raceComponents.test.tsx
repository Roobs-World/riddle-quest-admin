import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import type {PublishRaceChallengeResponse, RaceChallengePreview, RaceOutcome} from "@qwordly/core/race";
import {RaceTo10Game} from "../RaceTo10Game";
import {RaceCountdown} from "../components/RaceCountdown";
import {RaceGameplay} from "../components/RaceGameplay";
import {RaceCategoriesPanel, RaceChallengePanel, RaceInboxPanel} from "../components/RaceLobbyPanels";
import {RaceQuitDialog} from "../components/RaceQuitDialog";
import {RaceResultPanel} from "../components/RaceResultPanel";
import {RaceScoreboard} from "../components/RaceScoreboard";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

/** No-op callback used by server-rendered presentation components. */
const noop = () => undefined;

describe("race presentation components", () => {
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
        items={[{
          itemId: "result-1",
          challengeId: "challenge-1",
          opponentDisplayName: "Nova",
          categoryId: "history",
          result: "win",
          adjustedDeltaMs: 3_500,
          read: false,
          createdAtMs: 1,
        }]}
        loading={false}
        onRematch={noop}
        onChooseCategory={noop}
      />,
    );
    expect(inboxHtml).toContain("Nova");
    expect(renderToString(
      <RaceInboxPanel items={[]} loading={false} onRematch={noop} onChooseCategory={noop} />,
    )).toContain("No results yet");

    /** Active challenge preview fixture. */
    const challenge: RaceChallengePreview = {
      challengeId: "challenge-1",
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
    expect(renderToString(
      <RaceChallengePanel challenge={{...challenge, status: "expired"}} onAccept={noop} />,
    )).toContain('role="alert"');
  });

  it("renders countdown, scoreboard, result, and quit variants", async () => {
    /** Deterministic run fixture used by the scoreboard. */
    const {run} = await createFakeRaceServices().startRace({
      locale: "en",
      categoryId: "science",
      requestId: "request-components",
    });
    expect(renderToString(<RaceCountdown countdown={3} loading coins={1_250} onClose={noop} />)).toContain("1,250");
    expect(renderToString(<RaceCountdown countdown={0} loading={false} coins={0} onClose={noop} />)).toContain("GO!");
    expect(renderToString(
      <RaceScoreboard run={run} adjustedNow={12_500} ghostCorrect={0} feedback="correct" coins={50} onClose={noop} />,
    )).toContain("race-rail-status");
    expect(renderToString(
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
        onBackspace={noop}
        onHint={noop}
        onSubmit={noop}
        onSkip={noop}
      />,
    )).toContain('class="keyboard"');

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
    expect(renderToString(
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
    )).toContain("Create challenge");

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
    expect(renderToString(
      <RaceResultPanel
        outcome={outcome}
        run={null}
        publication={publication}
        publishing={false}
        onPublish={noop}
        onShare={noop}
        onRematch={noop}
        onChooseCategory={noop}
        onClose={noop}
      />,
    )).toContain("Challenge a friend");
    expect(renderToString(
      <RaceQuitDialog
        dialogRef={{current: null}}
        error="Network error"
        abandoning
        onCancel={noop}
        onConfirm={noop}
      />,
    )).toContain("Quitting");
  });

  it("server-renders each initial controller route", async () => {
    /** Initial categories supplied synchronously to the controller. */
    const categories = (await createFakeRaceServices().listRaceCategories("en")).categories;
    /** Shared controller properties for isolated server rendering. */
    const commonProps = {locale: "en" as const, coins: 10, postToHost: noop, onClose: noop};
    expect(renderToString(<RaceTo10Game {...commonProps} initialCategories={categories} />)).toContain("race-category-grid");
    expect(renderToString(<RaceTo10Game {...commonProps} openInbox />)).toContain("race-inbox");
    expect(renderToString(<RaceTo10Game {...commonProps} challengeId="challenge-1" />)).toContain("race-challenge-card");
  });
});
