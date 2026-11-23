import {type LocalSoloAuthority} from "../../../../../src/gameplay/local/LocalSoloAuthority";
import {type YouTubeAuthoritySnapshot} from "../../../../../src/gameplay/local/LocalSoloAuthority.contract.ts";
import {type YouTubeCopyKey} from "../../../../../src/localization/copy/localGameCopy";
import {type YouTubeLocale, type YouTubeResult} from "../../../../../src/gameplay/local/types";
import {StyleSheet, Text, View} from "react-native";
import {ActionButton, Heading, Panel, Screen} from "../components/Primitives";
import {AchievementRow, SaveBanner, StatusHeader} from "../components/StatusViews";
import {palette, spacing} from "../theme";
/** Props for {@link Stat}. */
type StatProps = Readonly<{
  /** Stat label. */
  label: string;
  /** Stat value. */
  value: number;
  /** Stable automation identifier. */
  testID: string;
}>;
/** One labelled result number. */
function Stat({label, value, testID}: StatProps) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.stat} testID={testID}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}
/** Props for {@link ResultScreen}. */
export type ResultScreenProps = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Local gameplay authority. */
  authority: LocalSoloAuthority;
  /** Latest authority projection. */
  snapshot: YouTubeAuthoritySnapshot;
  /** Completed puzzle outcome. */
  result: YouTubeResult;
  /** Runs one authority transition. */
  run: (action: () => Promise<unknown>) => Promise<void>;
  /** Localized copy lookup. */
  text: (key: YouTubeCopyKey) => string;
}>;
/** Outcome summary shown after a win, loss, or skip. */
export function ResultScreen({locale, authority, snapshot, result, run, text}: ResultScreenProps) {
  /** Whether material transitions are unavailable. */
  const materialDisabled = snapshot.busy || snapshot.paused || snapshot.saveBlocked;
  return (
    <Screen centered paused={snapshot.paused} testID="screen-result">
      <StatusHeader snapshot={snapshot} locale={locale} />
      {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
      <Panel style={styles.panel}>
        <Text style={styles.icon}>{result.kind === "win" ? "✨" : result.kind === "skip" ? "⏭" : "🌙"}</Text>
        <Heading testID="result-heading">{text(result.kind === "win" ? "victory" : result.kind === "skip" ? "skipped" : "loss")}</Heading>
        <View style={styles.stats}>
          <Stat label={text("attempts")} value={result.attempts} testID="result-attempts" />
          <Stat label={text("coinsEarned")} value={result.coinsEarned} testID="result-coins" />
          <Stat label={text("xpEarned")} value={result.xpEarned} testID="result-xp" />
        </View>
        {result.newlyUnlockedAchievementIds.length > 0 && (
          <View style={styles.achievements}>
            <Heading level={2}>{text("newAchievements")}</Heading>
            <AchievementRow ids={result.newlyUnlockedAchievementIds} text={text} label={text("newAchievements")} />
          </View>
        )}
        <ActionButton
          tone="primary"
          label={text("continueToMenu")}
          disabled={materialDisabled}
          onPress={() => authority.clearResult()}
          testID="continue-to-menu"
        />
      </Panel>
    </Screen>
  );
}
/** Styles for the result screen. */
const styles = StyleSheet.create({
  panel: {alignItems: "center"},
  icon: {fontSize: 56},
  stats: {flexDirection: "row", gap: spacing.md, alignSelf: "stretch"},
  stat: {flex: 1, alignItems: "center", gap: spacing.xs},
  statLabel: {color: palette.muted, fontSize: 13, textAlign: "center"},
  statValue: {color: palette.text, fontSize: 22, fontWeight: "700"},
  achievements: {alignSelf: "stretch", gap: spacing.sm},
});
