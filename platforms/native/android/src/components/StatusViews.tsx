import {ACHIEVEMENT_DEFINITIONS} from "../../../../../src/progression/achievements/catalog/achievements";
import {hostedAchievementText} from "../i18n/achievementCopy";
import {youtubeText, type YouTubeCopyKey} from "../../../../../src/localization/copy/localGameCopy";
import {type YouTubeAuthoritySnapshot} from "../../../../../src/gameplay/local/LocalSoloAuthority.contract.ts";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {StyleSheet, Text, View} from "react-native";
import {palette, radius, spacing} from "../theme";
import {Banner} from "./Primitives";

/** Resolves actual badge copy instead of guessing its meaning from an identifier. */
export function describeAchievement(id: string, locale: YouTubeLocale): string {
  const definition = ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === id);
  return definition ? `${hostedAchievementText(locale, definition.nameKey ?? "", definition.name)}: ${hostedAchievementText(locale, definition.descriptionKey ?? "", definition.description)}`
    : youtubeText(locale, "achievements");
}

export type AchievementIconProps = Readonly<{id: string; locale: YouTubeLocale}>;
/** Earned badge with visible localized name and unlock requirement. */
export function AchievementIcon({id, locale}: AchievementIconProps) {
  const definition = ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === id);
  return <View accessible accessibilityLabel={describeAchievement(id, locale)} style={styles.achievement}>
    <Text style={styles.achievementIcon}>{definition?.icon ?? "🏅"}</Text>
    <View style={styles.achievementCopy}>
      <Text style={styles.achievementName}>{definition ? hostedAchievementText(locale, definition.nameKey ?? "", definition.name) : youtubeText(locale, "achievements")}</Text>
      {definition && <Text style={styles.achievementDescription}>{hostedAchievementText(locale, definition.descriptionKey ?? "", definition.description)}</Text>}
    </View>
  </View>;
}
export type AchievementRowProps = Readonly<{ids: readonly string[]; locale: YouTubeLocale; label: string}>;
/** Duplicate stored IDs never produce duplicate badge cards. */
export function AchievementRow({ids, locale, label}: AchievementRowProps) {
  return <View accessibilityLabel={label} style={styles.achievementRow}>
    {[...new Set(ids)].map((id) => <AchievementIcon key={id} id={id} locale={locale} />)}
  </View>;
}
/** Props for {@link StatusHeader}. */
export type StatusHeaderProps = Readonly<{
  /** Latest authority projection. */
  snapshot: YouTubeAuthoritySnapshot;
  /** Active locale. */
  locale: YouTubeLocale;
}>;
/** Renders the persistent player economy and save status. */
export function StatusHeader({snapshot, locale}: StatusHeaderProps) {
  return (
    <View style={styles.status} testID="status-header">
      <Text style={styles.statusTitle}>{youtubeText(locale, "title")}</Text>
      <Text style={styles.statusCoins} accessibilityLabel={`${youtubeText(locale, "coins")}: ${snapshot.save.progression.coins}`} testID="status-coins">
        🪙 {snapshot.save.progression.coins}
      </Text>
      {snapshot.busy && (
        <Text accessibilityLiveRegion="polite" style={styles.statusSaving}>
          {youtubeText(locale, "saving")}
        </Text>
      )}
    </View>
  );
}
/** Props for {@link SaveBanner}. */
export type SaveBannerProps = Readonly<{
  /** Localized copy lookup. */
  text: (key: YouTubeCopyKey) => string;
  /** Retries the blocked save. */
  retry: () => void;
}>;
/** Renders the recoverable save failure action. */
export function SaveBanner({text, retry}: SaveBannerProps) {
  return <Banner error message={text("saveFailed")} actionLabel={text("retry")} onAction={retry} testID="save-banner" />;
}
/** Styles for status views. */
const styles = StyleSheet.create({
  status: {flexDirection: "row", alignItems: "center", gap: spacing.md},
  statusTitle: {flex: 1, color: palette.text, fontSize: 18, fontWeight: "700"},
  statusCoins: {color: palette.text, fontSize: 16, fontWeight: "600"},
  statusSaving: {color: palette.muted, fontSize: 13},
  achievementRow: {gap: spacing.sm},
  achievement: {flexDirection: "row", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.control, backgroundColor: palette.control},
  achievementCopy: {flex: 1, gap: spacing.xs},
  achievementName: {color: palette.text, fontWeight: "700", fontSize: 15},
  achievementDescription: {color: palette.muted, fontSize: 14},
  achievementIcon: {fontSize: 22},
});
