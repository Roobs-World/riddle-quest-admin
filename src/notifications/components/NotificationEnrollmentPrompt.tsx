import {getCurrentLocale} from "../../localization/browser/i18n";
import {getHostedNotificationCopy} from "../copy/hostedNotificationCopy";
import {useNotificationSettings} from "./NotificationSettingsContext";

export function NotificationEnrollmentPrompt() {
  const notifications = useNotificationSettings();
  if (!notifications?.enabled || notifications.delivery !== "permission-required") return null;
  const copy = getHostedNotificationCopy(getCurrentLocale());
  return <div className="notification-enrollment-prompt">
    <p>{copy.permissionRequired}</p>
    <button type="button" className="play-secondary" disabled={notifications.busy}
      onClick={() => {void notifications.requestPermission();}}>{copy.allowNotifications}</button>
  </div>;
}
