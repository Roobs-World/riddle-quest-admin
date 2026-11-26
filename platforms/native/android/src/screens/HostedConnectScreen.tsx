import {youtubeText} from "../../../../../src/localization/copy/localGameCopy";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {ActionButton, Eyebrow, Heading, Notice, Panel, Screen} from "../components/Primitives";
import type {HostedFirebaseClient} from "../hosted/firebaseClient";
import type {HostedAccountState} from "../hosted/useHostedAccount";
import {hostedText} from "../i18n/hostedCopy";
import {palette, spacing} from "../theme";
/** Props for {@link HostedConnectScreen}. */
export type HostedConnectScreenProps = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Hosted Firebase client, for the environment caption. */
  client: HostedFirebaseClient;
  /** Account state while the Global Game Account is not yet confirmed. */
  state: Exclude<HostedAccountState, ReadyState>;
  /** Retries sign-in and provisioning. */
  onRetry: () => void;
  /** Switches to the self-contained offline game. */
  onPlayOffline: () => void;
}>;
/** The confirmed-account variant, which this screen never shows. */
type ReadyState = {
  /** Variant tag. */
  kind: "ready";
};
/**
 * First screen of a hosted-first launch: the device signs in anonymously and
 * provisions its account while the player can fall back to offline play.
 */
export function HostedConnectScreen({locale, client, state, onRetry, onPlayOffline}: HostedConnectScreenProps) {
  /** Whether a connection attempt is running (idle is treated as about to connect). */
  const connecting = state.kind !== "failed";
  return (
    <Screen centered testID="screen-hosted-connect">
      <Panel style={styles.panel}>
        <Eyebrow>{client.usingEmulators ? `Firebase emulators · ${client.projectId}` : client.projectId}</Eyebrow>
        <Heading testID="connect-heading">{youtubeText(locale, "title")}</Heading>
        {connecting ? (
          <View style={styles.progress}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Notice testID="account-status">{hostedText(locale, "connecting")}</Notice>
          </View>
        ) : (
          <View style={styles.stack}>
            <Notice error testID="account-status">
              {hostedText(locale, state.code === "sign-in" ? "signInFailed" : "provisionFailed")}
            </Notice>
            <ActionButton tone="primary" label={youtubeText(locale, "retry")} onPress={onRetry} testID="account-connect" />
          </View>
        )}
        <View style={styles.stack}>
          <ActionButton label={hostedText(locale, "playOffline")} onPress={onPlayOffline} testID="play-offline" />
          <Text style={styles.note}>{hostedText(locale, "offlineNote")}</Text>
        </View>
      </Panel>
    </Screen>
  );
}
/** Styles for the connect screen. */
const styles = StyleSheet.create({
  panel: {alignSelf: "stretch"},
  progress: {alignItems: "center", gap: spacing.sm},
  stack: {gap: spacing.sm},
  note: {color: palette.muted, fontSize: 13, textAlign: "center"},
});
