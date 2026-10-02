import {useRef, useState} from "react";
import {useReferralSharing} from "../../sharing/ReferralSharingCapability";
import {tr} from "../../i18n";

/** Opens only the active platform's native invitation dialog for a reserved live lobby. */
export function LiveRaceInviteShare({challengeId}: {
  /** Server-issued invitation handle, never a player identity. */ challengeId: string;
}) {
  /** Optional platform behavior supplied by the authenticated target adapter. */
  const sharing = useReferralSharing();
  /** Immediate lock prevents two dialogs before React commits the busy state. */
  const lock = useRef(false);
  /** Native dialog currently owns input. */
  const [busy, setBusy] = useState(false);
  /** Dismissal keeps the lobby ready to share again; failures expose retry copy. */
  const [failed, setFailed] = useState(false);
  /** Sends the invite without treating a dialog success as recipient acceptance. */
  const send = async () => {
    if (lock.current || !sharing?.shareLiveRace) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {setFailed(await sharing.shareLiveRace({challengeId}) === "error");}
    catch {setFailed(true);}
    finally {lock.current = false; setBusy(false);}
  };
  return sharing?.shareLiveRace ? <div className="live-race-invite-share">
    <button className="race-primary" disabled={busy} aria-busy={busy} onClick={() => void send()}>{tr("RaceTo10.CHALLENGE_FRIEND")}</button>
    {failed && <p role="alert">{tr("RaceTo10.ERROR_GENERIC")}</p>}
  </div> : null;
}
