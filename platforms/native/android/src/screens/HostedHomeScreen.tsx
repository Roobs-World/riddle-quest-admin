import {referralCopy} from "../i18n/referralCopy";
import {raceText} from "../i18n/raceCopy";
import {notificationCopy} from "../i18n/notificationCopy";
import type {HostServices, WebGameMode} from "../../../../../src/platform/contracts/hostServices";
import {youtubeText} from "../../../../../src/localization/copy/localGameCopy";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {StyleSheet, Text, View} from "react-native";
import {ModeCard} from "../components/ModeCard";
import {ActionButton, Eyebrow, Heading, Screen} from "../components/Primitives";
import type {ProvisionedAccount} from "../hosted/firebaseClient";
import {useAuthSnapshot} from "../hosted/useAuthSnapshot";
import {hostedText} from "../i18n/hostedCopy";
import {profileText} from "../i18n/profileCopy";
import {shopText} from "../i18n/shopCopy";
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
  /** Opens Race to 10. */
  onShowRace: () => void;
  /** Opens notification preferences. */
  onShowNotifications: () => void;
  /** Opens acquisition invitations. */
  onShowReferrals: () => void;
  /** Opens the Google Play shop. */
  onShowShop: () => void;
  /** Opens the profile, leaderboards and account settings. */
  onShowProfile: () => void;
  /** Switches to the self-contained offline game. */
  onPlayOffline: () => void;
}>;
/** Current UTC day, matching the Daily's server calendar. */
const utcToday = (): string => new Date().toISOString().slice(0, 10);
/** Hosted-first home: Classic and Daily issued by the server, with the account and offline play one tap away. */
export function HostedHomeScreen({locale, services, account, onPlay, onShowAccount, onShowShop, onShowProfile, onPlayOffline, onShowRace, onShowNotifications, onShowReferrals}: HostedHomeScreenProps) {
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
      <ActionButton tone="primary" label={raceText(locale, "MULTIPLAYER_BUTTON")} onPress={onShowRace} testID="show-race" />
      <ActionButton label={referralCopy(locale).title} onPress={onShowReferrals} testID="show-referrals" />
      <ActionButton label={notificationCopy(locale).title} onPress={onShowNotifications} testID="show-notifications" />
      <ActionButton tone="primary" label={shopText(locale, "shopTitle")} onPress={onShowShop} testID="show-shop" />
      <ActionButton label={profileText(locale, "profileTitle")} onPress={onShowProfile} testID="show-profile" />
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
