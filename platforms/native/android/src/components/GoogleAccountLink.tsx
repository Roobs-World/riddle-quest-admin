import {createGoogleAccountController} from "../auth/androidGoogleIdentity";
import type {HostedFirebaseClient} from "../hosted/firebaseClient";
import {youtubeText} from "../../../../../src/localization/copy/localGameCopy";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {Image, Pressable, StyleSheet, Text, View} from "react-native";
import {googleIdentityCopy} from "../i18n/googleIdentityCopy";
import {palette, spacing} from "../theme";
import {ActionButton, Heading, Notice, Panel} from "./Primitives";

/** Native account controls preserve anonymous progress unless an account switch is separately accepted. */
export function GoogleAccountLink({locale, client, ownerId, onChanged}: {
  /** Content language. */ locale: YouTubeLocale;
  /** Target-owned native/Firebase identity adapter. */ client: HostedFirebaseClient;
  /** Currently confirmed game account. */ ownerId: string;
  /** Root refreshes account ownership after linking, restoration or sign-out. */ onChanged: () => void;
}) {
  /** Controller construction is inert; only effects enter a mounted account visit. */
  const controller = useMemo(() => createGoogleAccountController({ownerId, identity: client.googleIdentity, onChanged}), [ownerId, client.googleIdentity, onChanged]);
  /** Stable shared snapshots drive only native rendering. */
  const status = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  /** Every supported language receives the same identity choices and warnings. */
  const text = googleIdentityCopy(locale);
  useEffect(() => {controller.enter(); return () => controller.dispose();}, [controller]);
  return <Panel>
    <Heading level={2}>{text.title}</Heading>
    <Text style={styles.body}>{text.intro}</Text>
    {status === "unavailable" && <Notice testID="google-unavailable">{text.unavailable}</Notice>}
    {status === "linked" && <View style={styles.stack}>
      <Notice testID="google-linked">{text.linked}</Notice>
      <ActionButton label={text.signOut} onPress={() => {void controller.signOut();}} testID="google-sign-out" />
    </View>}
    {status === "working" && <Notice testID="google-working">{youtubeText(locale, "loading")}</Notice>}
    {status === "conflict" && <View style={styles.stack}>
      <Notice error testID="google-conflict">{text.conflict}</Notice>
      <ActionButton tone="danger" label={text.switchAccount} onPress={() => {void controller.openExisting();}} testID="google-open-existing" />
      <ActionButton label={text.keepCurrent} onPress={controller.keepCurrent} testID="google-keep-current" />
    </View>}
    {status === "failed" && <Notice error testID="google-failed">{text.failed}</Notice>}
    {(status === "anonymous" || status === "failed") && <Pressable accessibilityRole="button" accessibilityLabel={text.link} style={styles.googleButton} onPress={() => {void controller.link();}} testID="google-link">
      <Image source={require("../../assets/google-g.png")} style={styles.googleLogo} accessible={false} />
      <Text style={styles.googleLabel}>{text.link}</Text>
    </Pressable>}
  </Panel>;
}
/** Identity descriptions remain readable alongside the explicit account-switch choices. */
const styles = StyleSheet.create({googleButton: {backgroundColor: "#FFFFFF", borderColor: "#747775", borderWidth: 1, borderRadius: 20, minHeight: 48, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10},
  googleLogo: {width: 20, height: 20, resizeMode: "contain"}, googleLabel: {color: "#1F1F1F", fontSize: 14, lineHeight: 20, fontWeight: "500"}, body: {color: palette.subtle, fontSize: 15, lineHeight: 22}, stack: {gap: spacing.sm}});
