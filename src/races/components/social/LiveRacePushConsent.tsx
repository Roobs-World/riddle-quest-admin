import {useReferralSharing} from "../../../sharing/components/ReferralSharingCapability";
import {usePushConsent} from "../../../notifications/components/PushConsentContext";
import {tr} from "../../../localization/browser/i18n";
import "./LiveRacePushConsent.css";

/** Explicit notification consent shared by Settings and Profile. */
export function LiveRacePushConsent() {
  /** Only the active target can supply notification permission. */
  const sharing = useReferralSharing();
  /** Shared state survives moving between supported notification surfaces. */
  const consent = usePushConsent();
  if (!sharing?.setLiveRacePush || !consent) return null;
  /** Consent state and guarded updates drive the target-owned notification controls. */
  const {enabled, busy, unavailable, change} = consent;
  return <div className="live-race-push-consent">
    <button className="race-secondary" disabled={busy} aria-pressed={enabled} aria-busy={busy} onClick={() => void change(true)}>
      {tr("RaceTo10.PUSH_ENABLE")}</button>
    <button className="race-secondary" disabled={busy} aria-pressed={!enabled} aria-busy={busy} onClick={() => void change(false)}>{tr("RaceTo10.PUSH_DISABLE")}</button>
    {unavailable && <p role="status">{tr("RaceTo10.PUSH_UNAVAILABLE")}</p>}
  </div>;
}
