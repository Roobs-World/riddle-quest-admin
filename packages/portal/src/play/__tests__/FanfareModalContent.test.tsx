import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {createInitialGameSession, gameSessionReducer} from "../gameSession";
import {CoinAwardSequence} from "../modalPages/fanfare/CoinAwardSequence";
import {
  AchievementFanfare,
  RewardFanfareContent,
  VictoryFanfareContent,
} from "../modalPages/fanfare/FanfareModalContent";
import {ReferralSharingProvider, type ReferralSharingCapability} from "../sharing/ReferralSharingCapability";

/** No-op callback shared by server-rendering tests. */
const noop = () => undefined;

/** Fake target capability used to expose referral UI in server-rendered tests. */
const referralSharing: ReferralSharingCapability = {
  rewardCoins: 100,
  shareInvite: noop,
  shareRace: noop,
  shareResult: noop,
};

describe("fanfare modal content", () => {
  it.each([undefined, {kind: "victory" as const}])("waits for a recovered win's completion before its final Next action: %j", activeStep => {
    /** Loaded host history independently establishes the winning session. */
    const state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
      riddleId: "recovered-win", sessionToken: "00000000-0000-4000-8000-000000000001", gameMode: "classic",
      text: "Clue", answerLength: 5, attemptsUsed: 1, hasUsedContinue: false, awaitingContinue: false,
      acceptedGuesses: [{attempt: 1, feedback: [..."PIANO"].map(letter => ({letter, status: "green"}))}],
    }});
    /** Content uses the same reducer-derived recovered state as the real modal shell. */
    const props = {activeStep, state, activeCoinAward: null, coinCollectionPending: false,
      onAdvance: noop, onBalancePreview: noop, onCoinCollected: noop, stepCount: 1, stepIndex: 0};
    expect(renderToString(<VictoryFanfareContent {...props} />)).toContain('disabled=""');
    expect(renderToString(<VictoryFanfareContent {...props}
      state={gameSessionReducer(state, {type: "completionAcknowledged"})} />)).not.toContain('disabled=""');
    expect(renderToString(<VictoryFanfareContent {...props} activeStep={{kind: "achievement", achievementId: "first_win"}}
      stepCount={2} />)).not.toContain('disabled=""');
  });

  it("renders known and fallback achievements", () => {
    expect(renderToString(<AchievementFanfare achievementId="first_win" />)).toContain("achievement-unlock");
    expect(renderToString(<AchievementFanfare achievementId="unknown-achievement" />)).toContain("unknown-achievement");
  });

  it("renders each victory presentation without owning sequence state", () => {
    /** Provides state behavior. */
    const state = {
      ...createInitialGameSession(),
      completionAcknowledged: true,
      lastRewards: {
        coinsEarned: 0,
        newXp: 25,
        newLevel: 3,
        newWinStreak: 2,
        newlyUnlockedAchievementIds: [],
      },
    };
    /** Provides shared props behavior. */
    const sharedProps = {
      activeCoinAward: null,
      coinCollectionPending: false,
      onAdvance: noop,
      onBalancePreview: noop,
      onCoinCollected: noop,
      state,
      stepCount: 1,
      stepIndex: 0,
    };

    expect(renderToString(<VictoryFanfareContent {...sharedProps} activeStep={undefined} />)).toContain(
      'aria-live="polite"',
    );
    expect(
      renderToString(
        <VictoryFanfareContent {...sharedProps} activeStep={{kind: "achievement", achievementId: "first_win"}} />,
      ),
    ).toContain("achievement-unlock");
    /** Raw server-rendered level-up step markup. */
    const levelUpMarkup = renderToString(<VictoryFanfareContent {...sharedProps} activeStep={{kind: "level"}} />);
    /** Level-up step markup as plain text runs. */
    const levelUp = levelUpMarkup.replaceAll("<!-- -->", "");
    expect(levelUp).toMatch(/<strong class="level-up-number">Level 3<\/strong>/);
    expect(levelUp).toContain("level-up-guidance");
    expect(levelUp.match(/✦/g)).toHaveLength(1);
    expect(levelUp).not.toContain("fanfare-emblem");
    expect(renderToString(<VictoryFanfareContent {...sharedProps} activeStep={{kind: "rank"}} />)).not.toContain(
      "rank-emblem",
    );
    /** Provides victory without sharing behavior. */
    const victoryWithoutSharing = renderToString(
      <VictoryFanfareContent {...sharedProps} activeStep={{kind: "victory"}} />,
    );
    expect(victoryWithoutSharing).toContain("reward-details");
    expect(victoryWithoutSharing).not.toContain("Invite a friend");
    /** Provides pending victory behavior. */
    const pendingVictory = renderToString(
      <VictoryFanfareContent {...sharedProps} state={{...state, completionAcknowledged: false}} activeStep={{kind: "victory"}} />,
    );
    expect(pendingVictory).toContain("Next Level");
    expect(pendingVictory).not.toContain('disabled=""');
    expect(
      renderToString(
        <ReferralSharingProvider capability={referralSharing}>
          <VictoryFanfareContent {...sharedProps} activeStep={{kind: "victory"}} />
        </ReferralSharingProvider>,
      ),
    ).toContain("Invite a friend");
  });

  it("renders reward steps and normalized coin amounts", () => {
    /** Provides shared props behavior. */
    const sharedProps = {
      activeCoinAward: null,
      coinCollectionPending: false,
      onAdvance: noop,
      onBalancePreview: noop,
      onCoinCollected: noop,
      stepCount: 2,
      stepIndex: 0,
    };
    expect(
      renderToString(
        <RewardFanfareContent {...sharedProps} activeStep={{kind: "achievement", achievementId: "first_win"}} />,
      ),
    ).toContain("achievement-unlock");
    expect(renderToString(<RewardFanfareContent {...sharedProps} activeStep={undefined} />)).toContain(
      "sequence-progress",
    );
    expect(
      renderToString(
        <CoinAwardSequence amount={10.6} total={30.4} onBalancePreview={noop} onCollected={noop} />,
      ).replaceAll("<!-- -->", ""),
    ).toContain("+11 Coins");
  });

  it("keeps victory progress valid when reward details refresh mid-sequence", () => {
    /** Provides state behavior. */
    const state = createInitialGameSession();
    /** Provides html behavior. */
    const html = renderToString(
      <VictoryFanfareContent
        activeCoinAward={null}
        activeStep={{kind: "victory"}}
        coinCollectionPending={false}
        onAdvance={noop}
        onBalancePreview={noop}
        onCoinCollected={noop}
        state={state}
        stepCount={1}
        stepIndex={5}
      />,
    );

    /** Provides progress behavior. */
    const progress = html.match(/sequence-progress[^>]*>(.*?)<\/small>/)?.[1].replaceAll("<!-- -->", "");
    expect(progress).toBe("6/6");
    expect(progress).not.toBe("6/1");
  });
});
