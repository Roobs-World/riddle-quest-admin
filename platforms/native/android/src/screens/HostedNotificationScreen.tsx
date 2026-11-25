import {Linking, Switch, Text, View} from "react-native";
import {useSyncExternalStore} from "react";
import type {DeviceNotificationProvider, DeviceNotificationSnapshot} from "../../../../../src/notifications/contracts/notificationProvider";
import {getHostedNotificationCopy} from "../../../../../src/notifications/copy/hostedNotificationCopy";
import {youtubeText} from "../../../../../src/localization/copy/localGameCopy";
import type {YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {ActionButton, Panel, Screen, Heading} from "../components/Primitives";
import {notificationCopy} from "../i18n/notificationCopy";
import {palette} from "../theme";

const unavailable: DeviceNotificationSnapshot = {kind: "device", enabled: true, busy: false, delivery: "unsupported"};
const noSubscription = () => () => undefined;
const unavailableSnapshot = () => unavailable;

/** The sole native preference controls every hosted campaign; OS permission is separate. */
export function HostedNotificationScreen({locale, controller, onBack}: {
  locale: YouTubeLocale; controller: DeviceNotificationProvider | null; onBack(): void;
}) {
  const copy = notificationCopy(locale), common = getHostedNotificationCopy(locale);
  const state = useSyncExternalStore(controller?.subscribe ?? noSubscription, controller?.getSnapshot ?? unavailableSnapshot, unavailableSnapshot);
  return <Screen testID="hosted-notifications">
    <Heading>{copy.title}</Heading>
    {!controller ? <Text style={{color: palette.text}}>{copy.unavailable}</Text> : <Panel>
      <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16}}>
        <Text style={{color: palette.text, fontSize: 16}}>{copy.title}: {state.enabled ? common.on : common.off}</Text>
        <Switch accessibilityLabel={copy.title} disabled={state.busy} value={state.enabled}
          testID="notification-enabled" onValueChange={value => {void controller.setEnabled(value);}} />
      </View>
      {state.enabled && state.delivery === "permission-required" &&
        <ActionButton label={common.allowNotifications} testID="notification-permission" disabled={state.busy}
          onPress={() => {void controller.requestPermission();}} />}
      {state.enabled && state.delivery === "blocked" && <ActionButton label={youtubeText(locale, "settings")}
        testID="notification-device-settings" onPress={() => {void Linking.openSettings().catch(() => undefined);}} />}
      {state.delivery === "not-configured" && <Text accessibilityRole="alert">{common.notConfigured}</Text>}
      {(state.delivery === "save-failed" || state.delivery === "blocked") && <Text accessibilityRole="alert">{copy.failed}</Text>}
    </Panel>}
    <ActionButton label={youtubeText(locale, "back")} onPress={onBack} testID="notifications-back" />
  </Screen>;
}
