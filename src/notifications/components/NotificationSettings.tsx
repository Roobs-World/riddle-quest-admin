import {useTranslator} from "../../localization/browser/i18n";
import {useNotificationSettings} from "./NotificationSettingsContext";

/** Edits the registered account's preference for notifications on native devices. */
export function NotificationSettings({disabled = false}: {disabled?: boolean}) {
  const consent = useNotificationSettings();
  const tr = useTranslator();
  if (consent?.kind !== "manager") return null;
  const {enabled, busy, change, saveFailed, available} = consent;
  const locked = disabled || !available;
  return <>
    <button
      type="button"
      className="settings-row"
      aria-pressed={!locked && enabled}
      aria-busy={busy}
      disabled={locked || busy}
      onClick={() => void change(!enabled)}
    >
      <span>{tr("Settings.NOTIFICATIONS")}</span>
      <strong>{tr(!locked && enabled ? "Settings.TOGGLE_ON" : "Settings.TOGGLE_OFF")}</strong>
    </button>
    {!locked && saveFailed && <p role="status">{tr("Settings.NOTIFICATION_SAVE_FAILED")}</p>}
  </>;
}
