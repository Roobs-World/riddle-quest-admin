import {getCurrentLocale, useTranslator} from "../../localization/browser/i18n";
import {useNotificationSettings} from "./NotificationSettingsContext";
import {getHostedNotificationCopy} from "../copy/hostedNotificationCopy";

/** Controls the shared notification preference from Settings. */
export function NotificationSettings({disabled = false}: {disabled?: boolean}) {
  const consent = useNotificationSettings();
  const tr = useTranslator();
  if (!consent) return null;
  const {enabled, busy, delivery, change} = consent;
  const copy = getHostedNotificationCopy(getCurrentLocale());
  const message = disabled ? null : delivery === "unsupported" ? copy.unavailable : delivery === "not-configured" ? copy.notConfigured :
    delivery === "blocked" ? copy.blocked : delivery === "permission-required" ? copy.permissionRequired : null;
  return <>
    <button
      type="button"
      className="settings-row"
      aria-pressed={!disabled && enabled}
      aria-busy={busy}
      disabled={disabled || busy}
      onClick={() => void change(!enabled)}
    >
      <span>{tr("Settings.NOTIFICATIONS")}</span>
      <strong>{tr(!disabled && enabled ? "Settings.TOGGLE_ON" : "Settings.TOGGLE_OFF")}</strong>
    </button>
    {!disabled && delivery === "save-failed" && <p role="status">{tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR")}</p>}
    {message && <p role="status">{message}</p>}
    {!disabled && enabled && (delivery === "permission-required" || delivery === "save-failed") && <button type="button" className="settings-row" disabled={busy}
      onClick={() => {void consent.requestPermission();}}>{copy.allowNotifications}</button>}
  </>;
}
