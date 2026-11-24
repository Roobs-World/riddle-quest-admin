import {useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import type {AchievementDefinition, AchievementPlayerData} from "../../../../../src/progression/achievements/catalog/achievementTypes";
import {getAchievementProgressViews, orderAchievementDefinitions} from "../../../../../src/progression/achievements/achievementPresentation";
import type {YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {youtubeText} from "../../../../../src/localization/copy/localGameCopy";
import {hostedAchievementText} from "../i18n/achievementCopy";
import {palette, radius, spacing} from "../theme";

/** Expandable collection keeps the profile compact while making every supported goal discoverable. */
export function AchievementCollection({locale, definitions, player, unlockedIds}: {
  locale: YouTubeLocale;
  definitions: readonly AchievementDefinition[];
  player: AchievementPlayerData;
  unlockedIds: readonly string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const unlocked = new Set(unlockedIds);
  const count = definitions.filter(({id}) => unlocked.has(id)).length;
  return <View style={styles.collection} testID="achievement-collection">
    <Pressable accessibilityRole="button" accessibilityState={{expanded}}
      onPress={() => setExpanded(!expanded)} style={styles.summary}>
      <Text style={styles.heading}>{youtubeText(locale, "achievements")} {count} / {definitions.length}</Text>
      <Text style={styles.heading} accessibilityElementsHidden importantForAccessibility="no">{expanded ? "−" : "+"}</Text>
    </Pressable>
    {expanded && orderAchievementDefinitions(definitions, player, unlockedIds).map((definition) => {
      const earned = unlocked.has(definition.id);
      const name = hostedAchievementText(locale, definition.nameKey ?? "", definition.name);
      return <View key={definition.id} style={[styles.card, earned && styles.earned]}>
        <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">{definition.icon}</Text>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.name}>{name}</Text>
          <Text style={styles.body}>{hostedAchievementText(locale, definition.descriptionKey ?? "", definition.description)}</Text>
          {getAchievementProgressViews(definition, player, earned).map((requirement, index) => {
            const label = requirement.labelKey ? `${hostedAchievementText(locale, requirement.labelKey)}: ` : "";
            return <View key={index} accessible accessibilityRole="progressbar"
              accessibilityLabel={`${name}: ${label}${requirement.text}`}
              accessibilityValue={{min: 0, max: 100, now: Math.round(requirement.ratio * 100), text: requirement.text}}>
              <Text style={styles.body}>{label}{requirement.text}</Text>
              <View style={styles.track}><View style={[styles.fill, {width: `${requirement.ratio * 100}%`}]} /></View>
            </View>;
          })}
          {earned && <Text style={styles.status}>✓ {hostedAchievementText(locale, "Achievements.UNLOCKED_LABEL")}</Text>}
        </View>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  collection: {gap: spacing.sm},
  summary: {minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm},
  heading: {color: palette.text, fontSize: 18, fontWeight: "700"},
  card: {flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: palette.control, borderRadius: radius.control},
  earned: {borderColor: palette.accent},
  icon: {fontSize: 26},
  copy: {flex: 1, gap: spacing.xs},
  name: {color: palette.text, fontSize: 16, fontWeight: "700"},
  body: {color: palette.muted, fontSize: 14},
  status: {color: palette.text, fontSize: 14, fontWeight: "600"},
  track: {height: 5, backgroundColor: palette.control, borderRadius: 4, overflow: "hidden", marginTop: spacing.xs},
  fill: {height: "100%", backgroundColor: palette.accent},
});
