import React from "react";
import {Text, TouchableOpacity, View} from "react-native";
import {MaterialCommunityIcons} from "@expo/vector-icons";
import {PlayerRank} from "../../constants/ranks";
import {TYPOGRAPHY} from "../../styles";
import {t} from "../../i18n";

interface RankBadgeProps {
  rank: PlayerRank;
  size?: number;
  showLabel?: boolean;
  labelColor?: string;
  onPress?: () => void;
  testID?: string;
}

const RankBadge: React.FC<RankBadgeProps> = ({
  rank,
  size = 72,
  showLabel = false,
  labelColor = "#FFFFFF",
  onPress,
  testID,
}) => {
  const iconSize = Math.round(size * 0.46);
  const badge = (
    <View style={{alignItems: "center", gap: 6}}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: rank.color,
          borderWidth: Math.max(2, Math.round(size * 0.055)),
          borderColor: "#FFF1B8",
          shadowColor: rank.glowColor,
          shadowOpacity: 0.9,
          shadowRadius: 12,
          shadowOffset: {width: 0, height: 4},
          elevation: 8,
        }}
      >
        <MaterialCommunityIcons name={rank.icon} size={iconSize} color="#FFF8DA" />
      </View>
      {showLabel ? (
        <Text
          style={{
            fontFamily: TYPOGRAPHY.fontSecondaryBold,
            fontSize: TYPOGRAPHY.fontSize.sm,
            color: labelColor,
            textAlign: "center",
          }}
        >
          {t(rank.nameKey)}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) {
    return <View testID={testID}>{badge}</View>;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`${t("Ranks.VIEW_ALL_BUTTON")}: ${t(rank.nameKey)}`}
      testID={testID}
    >
      {badge}
    </TouchableOpacity>
  );
};

export default RankBadge;
