import {useContext, useId} from "react";
import {useTranslator} from "../../localization/browser/i18n";
import {AnalyticsConsentContext} from "./AnalyticsConsentContext";
import "./analyticsConsent.css";

export function AnalyticsConsentControls() {
  const consent = useContext(AnalyticsConsentContext);
  const descriptionId = useId();
  const tr = useTranslator();
  if (!consent) return null;
  return <div className="analytics-consent">
    <label className="settings-row">
      <span>{tr("Settings.ANALYTICS_TOGGLE")}</span>
      <input
        type="checkbox"
        checked={consent.enabled}
        aria-describedby={descriptionId}
        onChange={event => consent.change(event.target.checked)}
      />
    </label>
    <p id={descriptionId}>{tr("Settings.ANALYTICS_DESCRIPTION")}</p>
  </div>;
}
