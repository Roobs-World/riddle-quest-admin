import {getCurrentLocale} from "../../localization/browser/i18n";
import {getHostedNotificationCopy} from "../copy/hostedNotificationCopy";
import {useNotificationSettings} from "./NotificationSettingsContext";

export function NotificationEnrollmentPrompt() {
  const notifications = useNotificationSettings();
  if (!notifications?.enabled || (notifications.delivery !== "permission-required" && notifications.delivery !== "save-failed")) return null;
  const copy = getHostedNotificationCopy(getCurrentLocale());
  return <div className="notification-enrollment-prompt">
    <p role="status">{notifications.delivery === "save-failed" ? copy.saveFailed : copy.permissionRequired}</p>
    <button type="button" className="play-secondary" disabled={notifications.busy}
      onClick={() => {void notifications.requestPermission();}}>{copy.allowNotifications}</button>
  </div>;
}
