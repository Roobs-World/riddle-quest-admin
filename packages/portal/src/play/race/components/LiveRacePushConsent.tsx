import {useRef, useState} from "react";
import {useReferralSharing} from "../../sharing/ReferralSharingCapability";
import {tr} from "../../i18n";

/** Only an explicit click requests browser notification permission through the active target adapter. */
export function LiveRacePushConsent() {
  /** Only the active target can supply notification permission. */
  const sharing = useReferralSharing();
  /** Local presentation state for this mounted invitation or consent flow. */
  const [enabled, setEnabled] = useState(false);
  /** Local presentation state for this mounted invitation or consent flow. */
  const [busy, setBusy] = useState(false);
  /** Local presentation state for this mounted invitation or consent flow. */
  const [unavailable, setUnavailable] = useState(false);
  /** Immediate operation lock prevents duplicate clicks. */
  const lock = useRef(false);
  /** Requests or revokes explicit consent through the target adapter. */
  const change = async (next: boolean) => {
    if (lock.current || !sharing?.setLiveRacePush) return;
    lock.current = true; setBusy(true); setUnavailable(false);
    try {
      /** Acknowledged consent outcome, separate from notification delivery. */
      const saved = await sharing.setLiveRacePush(next);
      if (saved) setEnabled(next); else setUnavailable(true);
    } catch {setUnavailable(true);}
    finally {lock.current = false; setBusy(false);}
  };
  return sharing?.setLiveRacePush ? <div className="live-race-push-consent">
    <button className="race-secondary" disabled={busy || enabled} aria-busy={busy} onClick={() => void change(true)}>
      {tr("RaceTo10.PUSH_ENABLE")}</button>
    <button className="race-secondary" disabled={busy} onClick={() => void change(false)}>{tr("RaceTo10.PUSH_DISABLE")}</button>
    {unavailable && <p role="status">{tr("RaceTo10.PUSH_UNAVAILABLE")}</p>}
  </div> : null;
}
