import {StyleSheet, Text, View} from "react-native";
import {ActionButton, Eyebrow, Heading, Notice, Panel, Screen} from "../components/Primitives";
import type {HostedFirebaseClient} from "../hosted/firebaseClient";
import {useHostedAccount} from "../hosted/useHostedAccount";
import {palette, spacing} from "../theme";
/** Props for {@link AccountScreen}. */
export type AccountScreenProps = Readonly<{
  /** Hosted Firebase client. */
  client: HostedFirebaseClient;
  /** Returns to the menu. */
  onBack: () => void;
}>;
/**
 * Phase 1 account surface: signs the device in anonymously and shows the
 * server-confirmed Global Game Account. Copy is English-only until the hosted
 * screens adopt the shared locale tables in Phase 1.5.
 */
export function AccountScreen({client, onBack}: AccountScreenProps) {
  /** Account controller. */
  const {state, connect} = useHostedAccount(client);
  return (
    <Screen testID="screen-account">
      <Panel>
        <ActionButton label="← Back" onPress={onBack} style={styles.back} testID="back" />
        <Eyebrow>{client.usingEmulators ? `Firebase emulators · ${client.projectId}` : client.projectId}</Eyebrow>
        <Heading testID="account-heading">Account</Heading>
        <Text style={styles.body}>
          Your progress, coins and races are kept on the Riddle Quest servers. This device is signed in anonymously; a Google
          sign-in can be linked later to recover the account on another phone.
        </Text>
        {state.kind === "idle" && <ActionButton tone="primary" label="Connect" onPress={connect} testID="account-connect" />}
        {state.kind === "connecting" && <Notice testID="account-status">Connecting…</Notice>}
        {state.kind === "failed" && (
          <View style={styles.stack}>
            <Notice error testID="account-status">
              {state.code === "sign-in" ? "Sign-in failed. Check your connection and try again." : "The account could not be confirmed. Try again."}
            </Notice>
            <ActionButton tone="primary" label="Retry" onPress={connect} testID="account-connect" />
          </View>
        )}
        {state.kind === "ready" && (
          <View style={styles.stack} testID="account-ready">
            <Notice testID="account-status">{state.account.created ? "Account created." : "Account confirmed."}</Notice>
            <View accessibilityLabel={`Server coins: ${state.account.coins}`} style={styles.cell} testID="account-coins">
              <Text style={styles.cellLabel}>Server coins</Text>
              <Text style={styles.cellValue}>{state.account.coins}</Text>
            </View>
            <View accessibilityLabel={`Player id: ${state.account.uid}`} style={styles.cell}>
              <Text style={styles.cellLabel}>Player id</Text>
              <Text style={styles.cellMono}>{state.account.uid}</Text>
            </View>
          </View>
        )}
      </Panel>
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
