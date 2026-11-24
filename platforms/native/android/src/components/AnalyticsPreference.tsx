import {StyleSheet, Switch, Text, View} from "react-native";
import type {YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {retryAndroidAnalyticsPreference, setAndroidAnalyticsEnabled, useAndroidAnalyticsPreference} from "../analytics/androidAnalytics";
import {analyticsCopy} from "../i18n/analyticsCopy";
import {palette, spacing} from "../theme";
import {youtubeText} from "../../../../../src/localization/copy/localGameCopy";
import {ActionButton, Heading, Notice, Panel} from "./Primitives";

export function AnalyticsPreference({locale}: {locale: YouTubeLocale}) {
  const state = useAndroidAnalyticsPreference();
  const copy = analyticsCopy(locale);
  if (!state.available) return null;
  return <Panel>
    <Heading level={2}>{copy.title}</Heading>
    <Text style={styles.description}>{copy.description}</Text>
    <View style={styles.row}>
      <Text style={styles.label}>{state.enabled ? copy.enabled : copy.disabled}</Text>
      <Switch accessibilityLabel={copy.title} accessibilityHint={copy.description} value={state.enabled}
        disabled={state.busy} onValueChange={enabled => {void setAndroidAnalyticsEnabled(enabled);}} testID="analytics-consent" />
    </View>
    {state.failed && <>
      <Notice error>{copy.failed}</Notice>
      <ActionButton label={youtubeText(locale, "retry")} disabled={state.busy} onPress={() => {void retryAndroidAnalyticsPreference();}} testID="analytics-consent-retry" />
    </>}
  </Panel>;
}
const styles = StyleSheet.create({
  description: {color: palette.subtle, fontSize: 15, lineHeight: 22},
  label: {color: palette.text, fontSize: 16, flexShrink: 1},
  row: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm},
});
