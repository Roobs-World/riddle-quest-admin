import {youtubeText} from "../../../../../src/localization/copy/localGameCopy";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {StyleSheet, Text, View} from "react-native";
import {ActionButton, Eyebrow, Heading, Notice, Panel, Screen} from "../components/Primitives";
import type {HostedFirebaseClient} from "../hosted/firebaseClient";
import type {HostedAccountController} from "../hosted/useHostedAccount";
import {hostedText} from "../i18n/hostedCopy";
import {GoogleAccountLink} from "../components/GoogleAccountLink";
import {palette, spacing} from "../theme";
import {AnalyticsPreference} from "../components/AnalyticsPreference";
/** Props for {@link AccountScreen}. */
export type AccountScreenProps = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Hosted Firebase client, for the environment caption. */
  client: HostedFirebaseClient;
  /** Account controller owned by the root so the confirmed state survives navigation. */
  account: HostedAccountController;
  /** Returns to the previous screen. */
  onBack: () => void;
  /** Latest confirmed balance for this same account; provisioning is the startup fallback. */
  confirmedCoins?: number;
}>;
/** Shows the server-confirmed Global Game Account, or lets the player connect and retry. */
export function AccountScreen({locale, client, account, onBack, confirmedCoins}: AccountScreenProps) {
  /** Account state. */
  const {state, connect} = account;
  return (
    <Screen testID="screen-account">
      <Panel>
        <ActionButton label={`← ${youtubeText(locale, "back")}`} onPress={onBack} style={styles.back} testID="back" />
        <Eyebrow>{client.usingEmulators ? `Firebase emulators · ${client.projectId}` : client.projectId}</Eyebrow>
        <Heading testID="account-heading">{hostedText(locale, "account")}</Heading>
        <Text style={styles.body}>{hostedText(locale, "accountIntro")}</Text>
        {state.kind === "idle" && <ActionButton tone="primary" label={hostedText(locale, "playOnline")} onPress={connect} testID="account-connect" />}
        {state.kind === "connecting" && <Notice testID="account-status">{hostedText(locale, "connecting")}</Notice>}
        {state.kind === "failed" && (
          <View style={styles.stack}>
            <Notice error testID="account-status">
              {hostedText(locale, state.code === "sign-in" ? "signInFailed" : "provisionFailed")}
            </Notice>
            <ActionButton tone="primary" label={youtubeText(locale, "retry")} onPress={connect} testID="account-connect" />
          </View>
        )}
        {state.kind === "ready" && (
          <View style={styles.stack} testID="account-ready">
            <Notice testID="account-status">{hostedText(locale, state.account.created ? "accountCreated" : "accountConfirmed")}</Notice>
            <View accessibilityLabel={`${hostedText(locale, "serverCoins")}: ${confirmedCoins ?? state.account.coins}`} style={styles.cell} testID="account-coins">
              <Text style={styles.cellLabel}>{hostedText(locale, "serverCoins")}</Text>
              <Text style={styles.cellValue}>{confirmedCoins ?? state.account.coins}</Text>
            </View>
            <View accessibilityLabel={`${hostedText(locale, "playerId")}: ${state.account.uid}`} style={styles.cell}>
              <Text style={styles.cellLabel}>{hostedText(locale, "playerId")}</Text>
              <Text style={styles.cellMono}>{state.account.uid}</Text>
            </View>
          </View>
        )}
      </Panel>
      {state.kind === "ready" && <GoogleAccountLink locale={locale} client={client} ownerId={state.account.uid} onChanged={connect} />}
      <AnalyticsPreference locale={locale} />
    </Screen>
  );
}
/** Styles for the account screen. */
const styles = StyleSheet.create({
  back: {alignSelf: "flex-start", minHeight: 40},
  body: {color: palette.subtle, fontSize: 15, lineHeight: 22},
  stack: {gap: spacing.sm},
  cell: {padding: spacing.sm + spacing.xs, borderRadius: 12, backgroundColor: palette.banner, gap: spacing.xs},
  cellLabel: {color: palette.muted, fontSize: 13},
  cellValue: {color: palette.text, fontSize: 20, fontWeight: "700"},
  cellMono: {color: palette.text, fontSize: 13},
});
