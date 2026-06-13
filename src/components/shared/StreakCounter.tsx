import React from "react";
import {Text, View} from "react-native";
import {TYPOGRAPHY} from "../../styles";
import {t} from "../../i18n";
import {STREAK_REWARD_INTERVAL_DAYS} from "../../constants/game";

export {STREAK_REWARD_INTERVAL_DAYS};

export function getStreakRewardProgress(streakValue: number): number {
  const normalizedStreak = Math.max(0, Math.floor(streakValue));
  if (normalizedStreak === 0) return 0;
  return ((normalizedStreak - 1) % STREAK_REWARD_INTERVAL_DAYS) + 1;
}

interface StreakCounterProps {
  streakValue: number;
}

/**
 * Compact weekly streak progress display for reward surfaces.
 */
export const StreakCounter = ({streakValue}: StreakCounterProps): React.JSX.Element => {
  const normalizedStreak = Math.max(0, Math.floor(streakValue));
  const progress = getStreakRewardProgress(normalizedStreak);
  const streakLabel = `${normalizedStreak}${t("StreakFanfare.STREAK_SUFFIX")}`;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={streakLabel}
      accessibilityValue={{min: 0, max: STREAK_REWARD_INTERVAL_DAYS, now: progress}}
      testID="streak-counter"
      style={{alignItems: "center", marginTop: 12}}
    >
      <Text
        style={{
          color: "black",
          fontFamily: TYPOGRAPHY.fontSecondaryBold,
          fontSize: TYPOGRAPHY.fontSize.lg,
        }}
      >
        {streakLabel}
      </Text>
      <View style={{flexDirection: "row", gap: 6, marginTop: 8}}>
        {Array.from({length: STREAK_REWARD_INTERVAL_DAYS}, (_, index) => (
          <View
            key={index}
            testID={`streak-counter-day-${index + 1}`}
            style={{
              width: 18,
              height: 8,
              borderRadius: 4,
              backgroundColor: index < progress ? "#FB9A2B" : "#B8B09A",
            }}
          />
        ))}
      </View>
      <Text
        style={{
          color: "black",
          fontFamily: TYPOGRAPHY.fontSecondaryBold,
          fontSize: TYPOGRAPHY.fontSize.sm,
          marginTop: 5,
        }}
      >
        {progress}/{STREAK_REWARD_INTERVAL_DAYS}
      </Text>
    </View>
  );
};
