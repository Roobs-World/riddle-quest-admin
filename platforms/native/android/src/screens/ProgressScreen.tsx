import {AchievementCollection} from "../components/AchievementCollection";
import {LOCAL_ACHIEVEMENT_DEFINITIONS} from "../../../../../src/progression/achievements/localAchievements";
import {createLocalAchievementPlayer} from "../../../../../src/progression/achievements/achievementPresentation";
import {trackEvent} from "../../../../../src/observability/analytics/eventsRuntime";
import {type LocalSoloAuthority} from "../../../../../src/gameplay/local/LocalSoloAuthority";
import {type YouTubeAuthoritySnapshot} from "../../../../../src/gameplay/local/LocalSoloAuthority.contract.ts";
import {type YouTubeContent, type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {type YouTubeCopyKey} from "../../../../../src/localization/copy/localGameCopy";
import {StyleSheet, Switch, Text, View} from "react-native";
import {ActionButton, Heading, Panel, Screen} from "../components/Primitives";
import {SaveBanner, StatusHeader} from "../components/StatusViews";
import {palette, spacing} from "../theme";
/** Level thresholds that advance the displayed rank. */
const RANK_THRESHOLDS = [1, 3, 6, 10, 15, 21, 28, 36] as const;
/** Props for {@link ProgressCell}. */
type ProgressCellProps = Readonly<{
  /** Stat label. */
  label: string;
  /** Formatted stat value. */
  value: string;
}>;
/** One labelled progression value. */
function ProgressCell({label, value}: ProgressCellProps) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}
/** Props for {@link PreferenceRow}. */
type PreferenceRowProps = Readonly<{
  /** Preference label. */
  label: string;
  /** Current value. */
  value: boolean;
  /** Whether changes are unavailable. */
  disabled: boolean;
  /** Applies a new value. */
  onChange: (value: boolean) => void;
  /** Stable automation identifier. */
  testID: string;
}>;
/** Labelled accessibility switch. */
function PreferenceRow({label, value, disabled, onChange, testID}: PreferenceRowProps) {
  return (
    <View style={styles.preference}>
      <Text style={styles.preferenceLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        onValueChange={onChange}
        testID={testID}
        thumbColor={value ? palette.accent : palette.subtle}
        trackColor={{false: palette.control, true: palette.tileHinted}}
        value={value}
      />
    </View>
  );
}
/** Props for {@link ProgressScreen}. */
export type ProgressScreenProps = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Locale-aligned bundled content. */
  content: YouTubeContent;
  /** Local gameplay authority. */
  authority: LocalSoloAuthority;
  /** Latest authority projection. */
  snapshot: YouTubeAuthoritySnapshot;
  /** Runs one authority transition. */
  run: (action: () => Promise<unknown>) => Promise<void>;
  /** Localized copy lookup. */
  text: (key: YouTubeCopyKey) => string;
  /** Returns to the menu. */
  onBack: () => void;
}>;
/** Progression, achievements, and accessibility preferences. */
export function ProgressScreen({locale, content, authority, snapshot, run, text, onBack}: ProgressScreenProps) {
  /** Durable progression. */
  const progression = snapshot.save.progression;
  /** Whether material transitions are unavailable. */
  const materialDisabled = snapshot.busy || snapshot.paused || snapshot.saveBlocked;
  /** Rank derived from the level thresholds. */
  const rank = Math.max(1, RANK_THRESHOLDS.filter((threshold) => progression.level >= threshold).length);
  return (
    <Screen paused={snapshot.paused} testID="screen-progress">
      <StatusHeader snapshot={snapshot} locale={locale} />
      {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
      <Panel>
        <ActionButton label={`← ${text("back")}`} onPress={onBack} disabled={materialDisabled} style={styles.back} testID="back" />
        <Heading testID="progress-heading">{text("progress")}</Heading>
        <View style={styles.grid}>
          <ProgressCell label={text("level")} value={String(progression.level)} />
          <ProgressCell label={text("rank")} value={String(rank)} />
          <ProgressCell label={text("xp")} value={String(progression.xp)} />
          <ProgressCell label={text("coins")} value={String(progression.coins)} />
          <ProgressCell label={text("games")} value={String(progression.gamesPlayed)} />
          <ProgressCell label={text("wins")} value={String(progression.totalWins)} />
          <ProgressCell label={text("streak")} value={String(progression.currentDailyStreak)} />
          <ProgressCell
            label={text("classicProgress")}
            value={`${Math.min(progression.classicIndex, content.classicOrder.length)}/${content.classicOrder.length}`}
          />
        </View>
        <AchievementCollection locale={locale} definitions={LOCAL_ACHIEVEMENT_DEFINITIONS}
          player={createLocalAchievementPlayer(progression)} unlockedIds={progression.unlockedAchievementIds} />
        <View style={styles.preferences}>
          <PreferenceRow
            label={text("reducedMotion")}
            value={snapshot.save.preferences.reducedMotion}
            disabled={materialDisabled}
            onChange={(value) => {
              void run(async () => {await authority.setReducedMotion(value); trackEvent("setting_changed", {setting: "reducedMotion", value});});
            }}
            testID="preference-reduced-motion"
          />
        </View>
      </Panel>
    </Screen>
  );
}
/** Styles for the progress screen. */
const styles = StyleSheet.create({
  back: {alignSelf: "flex-start", minHeight: 40},
  grid: {flexDirection: "row", flexWrap: "wrap", gap: spacing.sm},
  cell: {
    width: "47%",
    flexGrow: 1,
    padding: spacing.sm + spacing.xs,
    borderRadius: 12,
    backgroundColor: palette.banner,
    gap: spacing.xs,
  },
  cellLabel: {color: palette.muted, fontSize: 13},
  cellValue: {color: palette.text, fontSize: 20, fontWeight: "700"},
  empty: {color: palette.subtle, fontSize: 15},
  preferences: {gap: spacing.sm},
  preference: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md},
  preferenceLabel: {flex: 1, color: palette.text, fontSize: 16},
});
