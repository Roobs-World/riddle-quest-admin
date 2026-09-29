import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {createInitialGameSession} from "../gameSession";
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
    expect(renderToString(<VictoryFanfareContent {...sharedProps} activeStep={{kind: "level"}} />)).toContain("3");
    expect(renderToString(<VictoryFanfareContent {...sharedProps} activeStep={{kind: "rank"}} />)).toContain(
      "rank-emblem",
    );
    /** Provides victory without sharing behavior. */
    const victoryWithoutSharing = renderToString(
      <VictoryFanfareContent {...sharedProps} activeStep={{kind: "victory"}} />,
    );
    expect(victoryWithoutSharing).toContain("reward-details");
    expect(victoryWithoutSharing).not.toContain("Invite a friend");
    expect(renderToString(
      <VictoryFanfareContent {...sharedProps} state={{...state, completionAcknowledged: false}} activeStep={{kind: "victory"}} />,
    )).toContain('disabled=""');
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
    const state = createInitialGameSession();
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

    const progress = html.match(/sequence-progress[^>]*>(.*?)<\/small>/)?.[1].replaceAll("<!-- -->", "");
    expect(progress).toBe("6/6");
    expect(progress).not.toBe("6/1");
  });
});
