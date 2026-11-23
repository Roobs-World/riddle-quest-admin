import {getYouTubeAchievementIcon} from "../../../../../src/progression/achievements/localAchievements";
import {youtubeText, type YouTubeCopyKey} from "../../../../../src/localization/copy/localGameCopy";
import {type YouTubeAuthoritySnapshot} from "../../../../../src/gameplay/local/LocalSoloAuthority.contract.ts";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {StyleSheet, Text, View} from "react-native";
import {palette, radius, spacing} from "../theme";
import {Banner} from "./Primitives";
/** Props for {@link AchievementIcon}. */
export type AchievementIconProps = Readonly<{
  /** Achievement identifier. */
  id: string;
  /** Localized copy lookup. */
  text: (key: YouTubeCopyKey) => string;
}>;
/** Builds the same meaningful label the web Playable announces for an achievement. */
export function describeAchievement(id: string, text: (key: YouTubeCopyKey) => string): string {
  /** Numeric threshold embedded in the identifier. */
  const numeric = Number(id.match(/\d+/u)?.[0]);
  if (id === "first_win") return `${text("wins")}: 1`;
  if (id.startsWith("wins_")) return `${text("wins")}: ${numeric}`;
  if (id.startsWith("games_")) return `${text("games")}: ${numeric}`;
  if (id.startsWith("streak_")) return `${text("streak")}: ${numeric}`;
  if (id.startsWith("classic_")) return `${text("classic")}: ${numeric || 1}`;
  if (id.startsWith("daily_") || id.startsWith("challenge_")) return `${text("daily")}: ${numeric || 1}`;
  if (id.startsWith("hints_") || id === "hint_user") return `${text("hint")}: ${numeric || 1}`;
  if (id.startsWith("level_")) return `${text("level")}: ${numeric}`;
  if (id.startsWith("xp_")) return `${text("xp")}: ${numeric}`;
  if (id === "coin_hoarder") return `${text("coins")}: 1000`;
  if (id === "treasure_vault") return `${text("coins")}: 2500`;
  if (id === "win_rate_80") return `${text("wins")}: 80%`;
  if (id === "efficient_10") return `${text("wins")}: 10 · ${text("attempts")}: 3`;
  if (id === "lesson_learned") return text("loss");
  return `${text("achievements")}: ${text("attempts")} ${id.includes("last_chance") ? 5 : 1}`;
}
/** Renders one locally bundled achievement icon with a meaningful label. */
export function AchievementIcon({id, text}: AchievementIconProps) {
  return (
    <View accessibilityRole="image" accessibilityLabel={describeAchievement(id, text)} style={styles.achievement}>
      <Text style={styles.achievementIcon}>{getYouTubeAchievementIcon(id)}</Text>
    </View>
  );
}
/** Props for {@link AchievementRow}. */
export type AchievementRowProps = Readonly<{
  /** Achievement identifiers in display order. */
  ids: readonly string[];
  /** Localized copy lookup. */
  text: (key: YouTubeCopyKey) => string;
  /** Group label. */
  label: string;
}>;
/** Wrapping row of achievement icons. */
export function AchievementRow({ids, text, label}: AchievementRowProps) {
  return (
    <View accessibilityLabel={label} style={styles.achievementRow}>
      {ids.map((id) => (
        <AchievementIcon key={id} id={id} text={text} />
      ))}
    </View>
  );
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
  achievementRow: {flexDirection: "row", flexWrap: "wrap", gap: spacing.sm},
  achievement: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: palette.control,
    alignItems: "center",
    justifyContent: "center",
  },
  achievementIcon: {fontSize: 22},
});
