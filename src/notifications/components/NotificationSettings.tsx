import {useTranslator} from "../../localization/browser/i18n";
import {useNotificationSettings} from "./NotificationSettingsContext";

/** Controls the shared notification preference from Settings. */
export function NotificationSettings() {
  const consent = useNotificationSettings();
  const tr = useTranslator();
  if (!consent) return null;
  const {enabled, busy, delivery, change} = consent;
  return <>
    <button
      type="button"
      className="settings-row"
      aria-pressed={enabled}
      aria-busy={busy}
      disabled={busy}
      onClick={() => void change(!enabled)}
    >
      <span>{tr("Settings.NOTIFICATIONS")}</span>
      <strong>{tr(enabled ? "Settings.TOGGLE_ON" : "Settings.TOGGLE_OFF")}</strong>
    </button>
    {delivery === "save-failed" && <p role="status">{tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR")}</p>}
  </>;
}
