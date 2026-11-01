import {youtubeText, type YouTubeCopyKey, type YouTubeLocale} from "@qwordly/solo";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {ActionButton, Heading, Notice, Screen} from "../components/Primitives";
import {palette, spacing} from "../theme";
/** Props for {@link LoadingScreen}. */
export type LoadingScreenProps = Readonly<{
  /** Whether host lifecycle paused interaction. */
  paused: boolean;
}>;
/** Startup surface shown before the save and content are ready. */
export function LoadingScreen({paused}: LoadingScreenProps) {
  return (
    <Screen centered paused={paused} testID="screen-loading">
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} size="large" />
        <Text style={styles.loadingText}>{youtubeText("en", "loading")}</Text>
      </View>
    </Screen>
  );
}
/** Props for {@link FailureScreen}. */
export type FailureScreenProps = Readonly<{
  /** Active locale, or English before the save could be read. */
  locale: YouTubeLocale;
  /** Localized failure copy key. */
  message: Extract<YouTubeCopyKey, "loadFailed" | "saveFailed">;
  /** Retries the failed operation. */
  onRetry: () => void;
  /** Whether host lifecycle paused interaction. */
  paused: boolean;
}>;
/** Recoverable load or save failure with a retry action. */
export function FailureScreen({locale, message, onRetry, paused}: FailureScreenProps) {
  return (
    <Screen centered paused={paused} testID="screen-failure">
      <Heading>{youtubeText(locale, "title")}</Heading>
      <Notice error testID="failure-message">
        {youtubeText(locale, message)}
      </Notice>
      <ActionButton tone="primary" label={youtubeText(locale, "retry")} onPress={onRetry} testID="retry" />
    </Screen>
  );
}
/** Props for {@link ResetScreen}. */
export type ResetScreenProps = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Why the saved data cannot be used. */
  reason: "invalid" | "future-version";
  /** Whether the destructive confirmation is showing. */
  confirming: boolean;
  /** Changes confirmation visibility. */
  setConfirming: (confirming: boolean) => void;
  /** Replaces the saved data after confirmation. */
  onReset: () => void;
  /** Whether host lifecycle paused interaction. */
  paused: boolean;
}>;
/** Explicit, confirmed reset for unreadable or newer saved data. */
export function ResetScreen({locale, reason, confirming, setConfirming, onReset, paused}: ResetScreenProps) {
  return (
    <Screen centered paused={paused} testID="screen-reset">
      <Heading>{youtubeText(locale, confirming ? "confirmReset" : "title")}</Heading>
      <Notice error testID="reset-message">
        {youtubeText(locale, confirming ? "confirmResetBody" : reason === "future-version" ? "futureSave" : "incompatibleSave")}
      </Notice>
      {confirming ? (
        <View style={styles.actions}>
          <ActionButton tone="danger" label={youtubeText(locale, "resetSave")} onPress={onReset} testID="reset-confirm" />
          <ActionButton label={youtubeText(locale, "cancel")} onPress={() => setConfirming(false)} testID="reset-cancel" />
        </View>
      ) : (
        <ActionButton tone="danger" label={youtubeText(locale, "resetSave")} onPress={() => setConfirming(true)} testID="reset-start" />
      )}
    </Screen>
  );
}
/** Styles for boot screens. */
const styles = StyleSheet.create({
  center: {alignItems: "center", gap: spacing.md},
  loadingText: {color: palette.subtle, fontSize: 16},
  actions: {gap: spacing.sm},
});
