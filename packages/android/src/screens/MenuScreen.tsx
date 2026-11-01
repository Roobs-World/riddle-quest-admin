import type {LocalSoloAuthority, YouTubeAuthoritySnapshot, YouTubeContent, YouTubeCopyKey, YouTubeLocale} from "@qwordly/solo";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {ActionButton, Banner, Eyebrow, Heading, Notice, Screen} from "../components/Primitives";
import {SaveBanner, StatusHeader} from "../components/StatusViews";
import {palette, radius, spacing} from "../theme";
/** Props for {@link ModeCard}. */
type ModeCardProps = Readonly<{
  /** Decorative glyph. */
  glyph: string;
  /** Mode name. */
  title: string;
  /** Progress or availability caption. */
  caption: string;
  /** Whether the mode cannot start. */
  disabled: boolean;
  /** Starts the mode. */
  onPress: () => void;
  /** Stable automation identifier. */
  testID: string;
}>;
/** Large tappable card for one game mode. */
function ModeCard({glyph, title, caption, disabled, onPress, testID}: ModeCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${caption}`}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [styles.modeCard, disabled && styles.modeCardDisabled, pressed && !disabled && styles.modeCardPressed]}
    >
      <Text style={styles.modeGlyph}>{glyph}</Text>
      <Text style={styles.modeTitle}>{title}</Text>
      <Text style={styles.modeCaption}>{caption}</Text>
    </Pressable>
  );
}
/** Props for {@link MenuScreen}. */
export type MenuScreenProps = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Locale-aligned bundled content. */
  content: YouTubeContent;
  /** Local gameplay authority. */
  authority: LocalSoloAuthority;
  /** Latest authority projection. */
  snapshot: YouTubeAuthoritySnapshot;
  /** Current UTC day. */
  today: string;
  /** Latest localized operation failure. */
  notice: YouTubeCopyKey | null;
  /** Runs one authority transition. */
  run: (action: () => Promise<unknown>) => Promise<void>;
  /** Localized copy lookup. */
  text: (key: YouTubeCopyKey) => string;
  /** Opens the progress screen. */
  onShowProgress: () => void;
}>;
/** Mode selection with recovery, guidance, and save-status banners. */
export function MenuScreen({locale, content, authority, snapshot, today, notice, run, text, onShowProgress}: MenuScreenProps) {
  /** Durable progression. */
  const progression = snapshot.save.progression;
  /** Whether material transitions are unavailable. */
  const materialDisabled = snapshot.busy || snapshot.paused || snapshot.saveBlocked;
  /** Whether every classic riddle is solved. */
  const classicComplete = progression.classicIndex >= content.classicOrder.length;
  /** Whether today's daily is already complete. */
  const dailyComplete = Boolean(progression.lastDailyCompletedDate && progression.lastDailyCompletedDate >= today);
  return (
    <Screen paused={snapshot.paused} testID="screen-menu">
      <StatusHeader snapshot={snapshot} locale={locale} />
      {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
      {snapshot.recoveryNotice && (
        <Banner
          message={text("recovered")}
          actionLabel={text("dismiss")}
          onAction={() => authority.dismissRecoveryNotice()}
          testID="recovery-banner"
        />
      )}
      {!snapshot.save.preferences.guidanceComplete && (
        <Banner
          message={`${text("chooseMode")}: ${text("classic")} · ${text("daily")}`}
          actionLabel={text("dismiss")}
          onAction={() => {
            void run(() => authority.completeGuidance());
          }}
          disabled={materialDisabled}
          testID="guidance-banner"
        />
      )}
      {notice && (
        <Notice error testID="notice">
          {text(notice)}
        </Notice>
      )}
      <View style={styles.intro}>
        <Eyebrow>{text("title")}</Eyebrow>
        <Heading testID="menu-heading">{text("chooseMode")}</Heading>
      </View>
      <View style={styles.modes}>
        <ModeCard
          glyph="🪐"
          title={text("classic")}
          caption={classicComplete ? text("classicComplete") : `${progression.classicIndex + 1}/${content.classicOrder.length}`}
          disabled={materialDisabled || classicComplete}
          onPress={() => {
            void run(() => authority.start("classic"));
          }}
          testID="start-classic"
        />
        <ModeCard
          glyph="☀️"
          title={text("daily")}
          caption={dailyComplete ? text("dailyComplete") : today}
          disabled={materialDisabled || dailyComplete}
          onPress={() => {
            void run(() => authority.start("daily"));
          }}
          testID="start-daily"
        />
      </View>
      <ActionButton label={text("progress")} onPress={onShowProgress} disabled={materialDisabled} testID="show-progress" />
    </Screen>
  );
}
/** Styles for the menu. */
const styles = StyleSheet.create({
  intro: {gap: spacing.xs},
  modes: {flexDirection: "row", gap: spacing.md},
  modeCard: {
    flex: 1,
    minHeight: 150,
    padding: spacing.md,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.panel,
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  modeCardDisabled: {opacity: 0.45},
  modeCardPressed: {borderColor: palette.accent},
  modeGlyph: {fontSize: 36},
  modeTitle: {color: palette.text, fontSize: 20, fontWeight: "700"},
  modeCaption: {color: palette.subtle, fontSize: 14},
});
