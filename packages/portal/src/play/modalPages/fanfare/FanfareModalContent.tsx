import {ACHIEVEMENT_DEFINITIONS} from "../../achievements";
import type {GameSessionState} from "../../gameSession";
import {tr} from "../../i18n";
import {getRankForLevel} from "../../ranks";
import {RankIcon} from "../../RankIcon";
import {CoinAwardSequence} from "./CoinAwardSequence";
import type {FanfareCoinAward, FanfareStep} from "./fanfareSequence";
import {useReferralSharing} from "../../sharing/ReferralSharingCapability";

/** Props shared by the two fanfare modal content variants. */
type SharedFanfareProps = {
  /** Stores active coin award. */
  activeCoinAward: FanfareCoinAward | null;
  /** Stores coin collection pending. */
  coinCollectionPending: boolean;
  /** Stores on balance preview. */
  onBalancePreview: (balance: number | null) => void;
  /** Stores on coin collected. */
  onCoinCollected: () => void;
  /** Stores on advance. */
  onAdvance: () => void;
};

/** Props for the victory fanfare content. */
export type VictoryFanfareContentProps = SharedFanfareProps & {
  /** Stores active step. */
  activeStep: FanfareStep | undefined;
  /** Stores state. */
  state: GameSessionState;
  /** Stores step index. */
  stepIndex: number;
  /** Stores step count. */
  stepCount: number;
};

/** Props for an auxiliary purchase or achievement fanfare. */
export type RewardFanfareContentProps = SharedFanfareProps & {
  /** Stores active step. */
  activeStep: FanfareStep | undefined;
  /** Stores step index. */
  stepIndex: number;
  /** Stores step count. */
  stepCount: number;
};

/** Renders an achievement unlocked during a fanfare sequence. */
export function AchievementFanfare({
  achievementId,
}: {
  /** Stores achievement id. */ /** Stores achievement id. */
  achievementId: string;
}) {
  /** Provides achievement behavior. */
  const achievement = ACHIEVEMENT_DEFINITIONS.find((item) => item.id === achievementId);
  return (
    <div className="achievement-unlock">
      <span className="achievement-icon large" aria-hidden="true">
        {achievement?.icon ?? "🏆"}
      </span>
      <strong>
        {achievement ? (achievement.nameKey ? tr(achievement.nameKey) : achievement.name) : achievementId}
      </strong>
      {achievement && <p>{achievement.descriptionKey ? tr(achievement.descriptionKey) : achievement.description}</p>}
    </div>
  );
}

/** Renders the active server-authoritative victory reward step. */
export function VictoryFanfareContent({
  activeCoinAward,
  activeStep,
  coinCollectionPending,
  onAdvance,
  onBalancePreview,
  onCoinCollected,
  state,
  stepCount,
  stepIndex,
}: VictoryFanfareContentProps) {
  /** Optional outbound sharing supplied by the active release target. */
  const referralSharing = useReferralSharing();
  /** Provides victory level behavior. */
  const victoryLevel = state.lastRewards?.newLevel;
  /** Provides victory rank behavior. */
  const victoryRank = getRankForLevel(victoryLevel ?? 1);

  return (
    <div className="fanfare-content">
      <div className="fanfare-burst" aria-hidden="true">
        ✦
      </div>
      {!activeStep ? (
        <p aria-live="polite">{tr("Accessibility.LOADING")}</p>
      ) : activeStep.kind === "achievement" ? (
        <AchievementFanfare achievementId={activeStep.achievementId} />
      ) : activeStep.kind === "level" ? (
        <div className="reward-summary">
          <span className="fanfare-emblem">✦</span>
          <strong>
            {tr("LevelUpFanfare.LEVEL_PREFIX")}
            {victoryLevel}
          </strong>
          <span>{tr("LevelUpFanfare.PROFILE_GUIDANCE")}</span>
        </div>
      ) : activeStep.kind === "rank" ? (
        <div className="reward-summary">
          <span className="rank-emblem large" style={{background: victoryRank.color}}>
            <RankIcon name={victoryRank.icon} />
          </span>
          <strong>{tr(victoryRank.nameKey)}</strong>
          <span>{tr("RankUpFanfare.SUBTITLE")}</span>
        </div>
      ) : (
        <>
          <strong className="fanfare-title">{tr("VictoryModal.YOU_WON_TITLE")}</strong>
          {activeCoinAward && activeCoinAward.amount > 0 ? (
            <CoinAwardSequence
              key={activeCoinAward.id}
              amount={activeCoinAward.amount}
              total={activeCoinAward.total}
              onBalancePreview={onBalancePreview}
              onCollected={onCoinCollected}
            />
          ) : null}
          <div className="reward-summary reward-details">
            {state.lastRewards?.newXp !== undefined && (
              <span>
                {state.lastRewards.newXp} {tr("StatsModal.XP")}
              </span>
            )}
            {state.lastRewards?.newWinStreak !== undefined && <span>🔥 {state.lastRewards.newWinStreak}</span>}
          </div>
          {referralSharing ? (
            <button
              className="play-secondary"
              onClick={() =>
                referralSharing.shareResult({
                  gameMode: state.riddle?.gameMode,
                  riddleId: state.riddle?.riddleId,
                  attempts: state.guesses.length,
                  emojiGrid: state.guesses
                    .map((guess) =>
                      guess.feedback
                        .map((feedback) => (feedback === "green" ? "🟩" : feedback === "yellow" ? "🟨" : "⬛"))
                        .join(""),
                    )
                    .join("\n"),
                })
              }
            >
              {tr("VictoryModal.SHARE_TEXT", {coins: referralSharing.rewardCoins})}
            </button>
          ) : null}
        </>
      )}
      {activeStep ? (
        <>
          <small className="sequence-progress">
            {stepIndex + 1}/{stepCount}
          </small>
          <button className="play-primary reward-continue" disabled={coinCollectionPending} onClick={onAdvance}>
            {stepIndex + 1 < stepCount ? tr("GameScreenAlerts.NEXT_BUTTON") : tr("VictoryModal.NEXT_LEVEL_BUTTON")}
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Renders the active purchase or achievement reward step. */
export function RewardFanfareContent({
  activeCoinAward,
  activeStep,
  coinCollectionPending,
  onAdvance,
  onBalancePreview,
  onCoinCollected,
  stepCount,
  stepIndex,
}: RewardFanfareContentProps) {
  return (
    <div className="fanfare-content">
      <div className="fanfare-burst" aria-hidden="true">
        ✦
      </div>
      {activeStep?.kind === "purchase" || activeStep?.kind === "referral" || activeStep?.kind === "coins" ? (
        activeCoinAward && activeCoinAward.amount > 0 ? (
          <CoinAwardSequence
            key={activeCoinAward.id}
            amount={activeCoinAward.amount}
            total={activeCoinAward.total}
            onBalancePreview={onBalancePreview}
            onCollected={onCoinCollected}
          />
        ) : null
      ) : activeStep?.kind === "achievement" ? (
        <AchievementFanfare achievementId={activeStep.achievementId} />
      ) : null}
      <small className="sequence-progress">
        {stepIndex + 1}/{Math.max(1, stepCount)}
      </small>
      <button className="play-primary reward-continue" disabled={coinCollectionPending} onClick={onAdvance}>
        {stepIndex + 1 < stepCount ? tr("GameScreenAlerts.NEXT_BUTTON") : tr("CoinPurchase.AWESOME_BUTTON")}
      </button>
    </div>
  );
}
