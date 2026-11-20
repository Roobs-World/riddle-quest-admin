import {palette} from "../theme";
import type {createAndroidNotificationController} from "@riddle-quest/hosted/androidNotifications";
import {youtubeText, type YouTubeLocale} from "@riddle-quest/solo";
import type {AndroidNotificationPreferences} from "@riddle-quest/hosted/androidNotifications";
import {useEffect, useState} from "react";
import {Text, View} from "react-native";
import {ActionButton, Panel, Screen, Heading} from "../components/Primitives";
import {notificationCopy} from "../i18n/notificationCopy";
/** Native consent controls; permission prompts only follow a player's enable press. */
export function HostedNotificationScreen({
  locale,
  controller,
  onBack,
}: {
  /** Supported recipient language used for notification or referral copy. */
  locale: YouTubeLocale;
  /** Account-owned controller coordinating the device and authoritative backend. */
  controller: ReturnType<typeof createAndroidNotificationController> | null;
  /** Returns to the previous native screen. */
  onBack(): void;
}) {
  /** Translated native labels for the selected game locale. */
  const copy = notificationCopy(locale);
  /** Last readable local consent shown by the native settings screen. */
  const [preferences, setPreferences] = useState<AndroidNotificationPreferences>({invitations: false, daily: false});
  /** Native request progress and the latest user-visible failure. */
  const [busy, setBusy] = useState(true),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    /** Current account-owned snapshot or effect lifetime checked before applying work. */
    let current = true;
    controller
      ?.read()
      .then((value) => {
        if (current) setPreferences(value);
      })
      .catch(() => {
        if (current) setFailed(true);
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    if (!controller) setBusy(false);
    return () => {
      current = false;
    };
  }, [controller]);
  /** Applies one explicit notification-purpose choice through the shared controller. */
  const toggle = (key: keyof AndroidNotificationPreferences) => {
    if (!controller || busy) return;
    setBusy(true);
    setFailed(false);
    controller
      .update({...preferences, [key]: !preferences[key]})
      .then(setPreferences, async () => {
        setFailed(true);
        try {
          setPreferences(await controller.read());
        } catch {
          /* Keep the last readable state. */
        }
      })
      .finally(() => setBusy(false));
  };
  return (
    <Screen testID="hosted-notifications">
      <Heading>{copy.title}</Heading>
      {!controller ? (
        <Text style={{color: palette.text, fontSize: 16, lineHeight: 24}}>{copy.unavailable}</Text>
      ) : (
        <Panel>
          {(["invitations", "daily"] as const).map((key) => (
            <View key={key}>
              <Text style={{color: palette.text, fontSize: 16, lineHeight: 24}}>{copy[key]}</Text>
              <ActionButton
                label={preferences[key] ? copy.disable : copy.enable}
                disabled={busy}
                testID={`notification-${key}`}
                onPress={() => toggle(key)}
              />
            </View>
          ))}
          {failed ? <Text accessibilityRole="alert">{copy.failed}</Text> : null}
        </Panel>
      )}
      <ActionButton label={youtubeText(locale, "back")} onPress={onBack} testID="notifications-back" />
    </Screen>
  );
}
