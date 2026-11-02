import type {HostServices, WebGameMode} from "@qwordly/hosted/hostTypes";
import {youtubeText, type YouTubeLocale} from "@qwordly/solo";
import {StyleSheet, Text, View} from "react-native";
import {ModeCard} from "../components/ModeCard";
import {ActionButton, Eyebrow, Heading, Screen} from "../components/Primitives";
import type {ProvisionedAccount} from "../hosted/firebaseClient";
import {useAuthSnapshot} from "../hosted/useAuthSnapshot";
import {hostedText} from "../i18n/hostedCopy";
import {palette, spacing} from "../theme";
/** Props for {@link HostedHomeScreen}. */
export type HostedHomeScreenProps = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Shared hosted play services, for the live balance. */
  services: HostServices;
  /** Account confirmed at connection time; the balance it carries is the floor until the profile loads. */
  account: ProvisionedAccount;
  /** Starts server-authoritative play in a mode. */
  onPlay: (mode: WebGameMode) => void;
  /** Opens the account screen. */
  onShowAccount: () => void;
  /** Switches to the self-contained offline game. */
  onPlayOffline: () => void;
}>;
/** Current UTC day, matching the Daily's server calendar. */
const utcToday = (): string => new Date().toISOString().slice(0, 10);
/** Hosted-first home: Classic and Daily issued by the server, with the account and offline play one tap away. */
export function HostedHomeScreen({locale, services, account, onPlay, onShowAccount, onPlayOffline}: HostedHomeScreenProps) {
  /** Live account snapshot from the shared services. */
  const snapshot = useAuthSnapshot(services);
  /** Server-confirmed coins: the profile once loaded, else the provisioned balance. */
  const coins = snapshot.profile?.coins ?? account.coins;
  return (
    <Screen testID="screen-hosted-home">
      <View style={styles.status} testID="hosted-status">
        <Eyebrow>{hostedText(locale, "online")}</Eyebrow>
        <Text accessibilityLabel={`${youtubeText(locale, "coins")}: ${coins}`} style={styles.coins} testID="hosted-coins">
          🪙 {coins}
        </Text>
      </View>
      <View style={styles.intro}>
        <Eyebrow>{youtubeText(locale, "title")}</Eyebrow>
        <Heading testID="hosted-home-heading">{youtubeText(locale, "chooseMode")}</Heading>
      </View>
      <View style={styles.modes}>
        <ModeCard
          glyph="🪐"
          title={youtubeText(locale, "classic")}
          caption={hostedText(locale, "classicCaption")}
          disabled={false}
          onPress={() => onPlay("classic")}
          testID="hosted-play-classic"
        />
        <ModeCard glyph="☀️" title={youtubeText(locale, "daily")} caption={utcToday()} disabled={false} onPress={() => onPlay("challenge")} testID="hosted-play-daily" />
      </View>
      <ActionButton label={hostedText(locale, "account")} onPress={onShowAccount} testID="show-account" />
      <ActionButton label={hostedText(locale, "playOffline")} onPress={onPlayOffline} testID="play-offline" />
    </Screen>
  );
}
/** Styles for the hosted home. */
const styles = StyleSheet.create({
  status: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
  coins: {color: palette.text, fontSize: 16, fontWeight: "600"},
  intro: {gap: spacing.xs},
  modes: {flexDirection: "row", gap: spacing.md},
});
