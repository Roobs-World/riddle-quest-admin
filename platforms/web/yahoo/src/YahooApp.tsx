import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from "react";
import {YouTubePlayableApp, type LocalGameAppProps} from "../../../../src/gameplay/components/local/LocalGameApp";
import {createStandaloneSdkPort} from "../../../../src/app/standalone/standaloneSdk";
import {createHostedPushController} from "../../../../src/notifications/browser/hostedPushController";
import {createConfiguredHostedPushTransportFactory} from "../../../../src/notifications/browser/hostedPush/api";
import {createNotificationProvider} from "../../../../src/notifications/controllers/notificationProvider";
import type {NotificationDelivery, NotificationProvider} from "../../../../src/notifications/contracts/notificationProvider";
import {getHostedNotificationCopy, type HostedNotificationCopy} from "../../../../src/notifications/copy/hostedNotificationCopy";
import type {YouTubeLocale} from "../../../../src/platform/contracts/localGamePolicy";

function yahooNotificationTransport() {
  try {return createConfiguredHostedPushTransportFactory(import.meta.env.VITE_NOTIFICATION_SERVICE_URL);}
  catch {return undefined;}
}

/** Explains browser delivery separately from the player's notification preference. */
function deliveryMessage(delivery: NotificationDelivery, copy: HostedNotificationCopy): string | null {
  switch (delivery) {
    case "permission-required": return copy.permissionRequired;
    case "blocked": return copy.blocked;
    case "unsupported": return copy.unavailable;
    case "not-configured": return copy.notConfigured;
    case "save-failed": return copy.saveFailed;
    case "ready":
    case "inactive": return null;
    default: {
      const exhaustive: never = delivery;
      return exhaustive;
    }
  }
}

/** Yahoo browser delivery can be granted only from its Settings screen. */
function YahooNotificationSettings({controller, locale, disabled}: {
  controller: NotificationProvider;
  locale: YouTubeLocale;
  disabled: boolean;
}) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const copy = getHostedNotificationCopy(locale);
  const message = deliveryMessage(snapshot.delivery, copy);
  const allowDelivery = snapshot.enabled && (snapshot.delivery === "permission-required" || snapshot.delivery === "save-failed");
  return <div className="yt-notification-settings">
    <button
      type="button"
      className="yt-settings-row"
      aria-pressed={snapshot.enabled}
      aria-busy={snapshot.busy}
      disabled={disabled || snapshot.busy}
      onClick={() => {void controller.setEnabled(!snapshot.enabled);}}
    >
      <span>{copy.notifications}</span>
      <strong>{snapshot.enabled ? copy.on : copy.off}</strong>
    </button>
    {message && <p role="status">{message}</p>}
    {allowDelivery && <button
      type="button"
      className="yt-primary"
      disabled={disabled || snapshot.busy}
      onClick={() => {void controller.requestPermission();}}
    >{copy.allowNotifications}</button>}
  </div>;
}

/** Keeps Yahoo notification state alive while the local game changes screens. */
export function YahooApp() {
  const [sdk] = useState(createStandaloneSdkPort);
  const [controller] = useState(() => {
    const provider = createNotificationProvider({platform: "yahoo", hosted: ({platform}) => createHostedPushController({
      target: platform, transport: yahooNotificationTransport(),
    })});
    if (!provider) throw new Error("yahoo-notification-provider-disabled");
    return provider;
  });
  const localeRef = useRef<YouTubeLocale | null>(null);
  useEffect(() => {
    let current = true;
    const recordActivity = () => {
      const locale = localeRef.current;
      if (current && locale && document.visibilityState !== "hidden") void controller.recordActivity({locale});
    };
    void controller.restore().then(recordActivity);
    window.addEventListener("focus", recordActivity);
    document.addEventListener("visibilitychange", recordActivity);
    return () => {
      current = false;
      window.removeEventListener("focus", recordActivity);
      document.removeEventListener("visibilitychange", recordActivity);
      controller.retire();
    };
  }, [controller]);
  const onLocaleReady = useCallback<NonNullable<LocalGameAppProps["onLocaleReady"]>>(locale => {
    localeRef.current = locale;
    if (document.visibilityState !== "hidden") void controller.recordActivity({locale});
  }, [controller]);
  const renderSettings = useCallback<NonNullable<LocalGameAppProps["renderSettings"]>>(({locale, disabled}) =>
    <YahooNotificationSettings controller={controller} locale={locale} disabled={disabled} />, [controller]);
  return <YouTubePlayableApp sdk={sdk} onLocaleReady={onLocaleReady} renderSettings={renderSettings} />;
}
