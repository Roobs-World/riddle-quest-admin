import {useEffect, useRef, useState} from "react";
import {getCurrentLocale, useTranslator} from "../../localization/browser/i18n";
import {useNotificationSettings} from "./NotificationSettingsContext";
import {getHostedNotificationCopy} from "../copy/hostedNotificationCopy";

/** Controls the shared notification preference from Settings. */
export function NotificationSettings({disabled = false}: {disabled?: boolean}) {
  const consent = useNotificationSettings();
  const tr = useTranslator();
  const setupLinkInput = useRef<HTMLInputElement | null>(null);
  const [copiedSetupLink, setCopiedSetupLink] = useState<string | null>(null);
  const [linkExpiryCheckedAt, setLinkExpiryCheckedAt] = useState(0);
  const setupLinkExpiresAt = consent?.setupLink?.expiresAtMs;
  useEffect(() => {
    if (!setupLinkExpiresAt || disabled || !consent?.enabled) return;
    const remaining = setupLinkExpiresAt - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setLinkExpiryCheckedAt(Date.now()), remaining);
    return () => window.clearTimeout(timer);
  }, [consent?.enabled, disabled, setupLinkExpiresAt]);
  if (!consent) return null;
  const {enabled, busy, delivery, change} = consent;
  const copy = getHostedNotificationCopy(getCurrentLocale());
  const setupLink = !disabled && enabled && consent.setupLink &&
    consent.setupLink.expiresAtMs > Math.max(Date.now(), linkExpiryCheckedAt) ? consent.setupLink : null;
  const copySetupLink = () => {
    if (!setupLink) return;
    if (setupLink.expiresAtMs <= Date.now()) {
      setLinkExpiryCheckedAt(Date.now());
      return;
    }
    const selectForManualCopy = () => {
      setCopiedSetupLink(null);
      setupLinkInput.current?.focus();
      setupLinkInput.current?.select();
    };
    try {
      if (!navigator.clipboard?.writeText) {
        selectForManualCopy();
        return;
      }
      void navigator.clipboard.writeText(setupLink.url)
        .then(() => setCopiedSetupLink(setupLink.url))
        .catch(selectForManualCopy);
    } catch {
      selectForManualCopy();
    }
  };
  const message = disabled ? null : delivery === "setup-failed" ? copy.setupFailed : delivery === "unsupported" ? copy.unavailable : delivery === "not-configured" ? copy.notConfigured :
    delivery === "blocked" ? copy.blocked : delivery === "permission-required" && !setupLink ? copy.permissionRequired : null;
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
    {!disabled && delivery === "save-failed" && <p role="status">{copy.saveFailed}</p>}
    {message && <p role="status">{message}</p>}
    {setupLink && <div className="settings-page" data-screenshot-private="true">
      <p>{copy.setupLinkInstructions}</p>
      <label>
        <span>{copy.setupLinkLabel}</span>
        <input ref={setupLinkInput} type="url" readOnly value={setupLink.url} autoComplete="off" spellCheck={false}
          style={{width: "100%", minWidth: 0, boxSizing: "border-box"}}
          onFocus={event => event.currentTarget.select()} />
      </label>
      <button type="button" className="play-secondary" onClick={copySetupLink}>{copy.copySetupLink}</button>
      {copiedSetupLink === setupLink.url && <p role="status">{copy.setupLinkCopied}</p>}
    </div>}
    {!disabled && enabled && !setupLink && (delivery === "permission-required" || delivery === "save-failed" || delivery === "setup-failed") && <button type="button" className="settings-row" disabled={busy}
      onClick={() => {void consent.requestPermission();}}>{copy.allowNotifications}</button>}
  </>;
}
