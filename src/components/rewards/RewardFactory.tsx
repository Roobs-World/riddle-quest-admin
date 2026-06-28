import React from "react";
import {Text, View} from "react-native";
import CoinSvg from "../../../assets/images/coin.svg";
import ChestOpenSvg from "../../../assets/images/chest-open.svg";
import {COIN_ICON_SIZE_LARGE, MODAL_CONTENT_PADDING, MODAL_WIDTH} from "../../constants/layout";
import {t} from "../../i18n";
import {TYPOGRAPHY} from "../../styles";
import {StreakCounter} from "../shared/StreakCounter";
import RewardChestView, {RewardChestHandle, RewardChestPreset, REWARD_CHEST_COIN_COUNT} from "./RewardChest";

export type RewardVariant = "summary" | "achievement";

export interface RewardProps {
  amount: number;
  totalCoins?: number;
  streakValue?: number;
  testID?: string;
  onOpened?: () => void;
}

export interface RewardAnimationHandle {
  play: () => Promise<void>;
}

const CHEST_PRESETS: Record<RewardVariant, RewardChestPreset> = {
  summary: {
    width: 150,
    height: 126,
    baseHeight: 58,
    lidHeight: 28,
    coinSize: 24,
    particleCount: REWARD_CHEST_COIN_COUNT,
    showAmount: false,
    staggerMs: 55,
    flightDurationMs: 720,
  },
  achievement: {
    width: 58,
    height: 58,
    baseHeight: 27,
    lidHeight: 14,
    coinSize: 15,
    particleCount: REWARD_CHEST_COIN_COUNT,
    showAmount: false,
    staggerMs: 35,
    flightDurationMs: 540,
  },
};

const RewardSummaryView = React.forwardRef<RewardAnimationHandle, RewardProps>(
  ({amount, totalCoins, streakValue, testID, onOpened}, ref) => {
  const width = MODAL_WIDTH - MODAL_CONTENT_PADDING * 2;
  const displayTotalCoins = Number.isFinite(totalCoins) ? (totalCoins as number) : amount;
  const rewardTestID = testID ?? "reward-summary";
  const chestTestID = testID ? `${testID}-chest` : "modal-reward-chest";
  const chestRef = React.useRef<RewardChestHandle>(null);

  React.useImperativeHandle(ref, () => ({
    play: () => chestRef.current?.play() ?? Promise.resolve(),
  }));

  return (
    <View style={{width}} testID={rewardTestID}>
      {amount > 0 ? (
        <View style={{alignItems: "center", marginTop: 5}}>
          <RewardChestView
            ref={chestRef}
            rewardAmount={amount}
            preset={CHEST_PRESETS.summary}
            variant="modal"
            testID={chestTestID}
            onOpened={onOpened}
          />
          <Text
            style={{
              fontFamily: TYPOGRAPHY.fontSecondaryBold,
              fontSize: TYPOGRAPHY.fontSize["2xl"],
              color: "#FB9A2B",
              marginTop: 2,
            }}
          >
            +{amount}
            {t("VictoryModal.COINS_SUFFIX")}
          </Text>
        </View>
      ) : null}

      {amount < 0 ? (
        <View style={{alignItems: "center", marginTop: 5}}>
          <CoinSvg width={COIN_ICON_SIZE_LARGE} height={COIN_ICON_SIZE_LARGE} />
          <Text
            style={{
              fontFamily: TYPOGRAPHY.fontSecondaryBold,
              fontSize: TYPOGRAPHY.fontSize["4xl"],
              color: "#FB9A2B",
              marginTop: 10,
            }}
          >
            {t("GameScreenAlerts.COST_COINS_PREFIX")}
            {Math.abs(amount)}
            {t("VictoryModal.COINS_SUFFIX")}
          </Text>
        </View>
      ) : null}

      <View style={{alignItems: "center", marginTop: 4}}>
        <Text style={{fontFamily: TYPOGRAPHY.fontPrimary, fontSize: TYPOGRAPHY.fontSize.base, color: "black"}}>
          {t("Profile.TOTAL_COINS_LABEL")}
        </Text>
        <Text
          testID={`${rewardTestID}-total`}
          style={{fontFamily: TYPOGRAPHY.fontPrimary, fontSize: TYPOGRAPHY.fontSize.xl, color: "black"}}
        >
          {displayTotalCoins}
        </Text>
      </View>
      {streakValue !== undefined && streakValue > 0 ? <StreakCounter streakValue={streakValue} /> : null}
    </View>
  );
});

RewardSummaryView.displayName = "RewardSummaryView";

const AchievementRewardView = React.forwardRef<RewardAnimationHandle, RewardProps>(({testID}, ref) => {
  React.useImperativeHandle(ref, () => ({
    play: () => Promise.resolve(),
  }));

  return (
    <View
      testID={testID ?? "reward-chest-achievement"}
      accessibilityRole="image"
      accessibilityLabel={t("Profile.TREASURE_CHEST_TITLE")}
      style={{
        width: CHEST_PRESETS.achievement.width,
        height: CHEST_PRESETS.achievement.height,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ChestOpenSvg width={CHEST_PRESETS.achievement.width} height={CHEST_PRESETS.achievement.height} />
    </View>
  );
});

AchievementRewardView.displayName = "AchievementRewardView";

type RewardComponent = React.ForwardRefExoticComponent<RewardProps & React.RefAttributes<RewardAnimationHandle>>;

const createReward = (variant: RewardVariant): RewardComponent => {
  const RewardView = variant === "summary" ? RewardSummaryView : AchievementRewardView;
  const RewardComponent = React.forwardRef<RewardAnimationHandle, RewardProps>((props, ref) => (
    <RewardView {...props} ref={ref} />
  ));
  RewardComponent.displayName = `${variant[0].toUpperCase()}${variant.slice(1)}Reward`;
  return RewardComponent;
};

export const ModalReward = createReward("summary");
export const AchievementReward = createReward("achievement");

export const RewardFactory = {
  create: createReward,
};
