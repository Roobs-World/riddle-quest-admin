import {useRef, useState} from "react";
import {SendLiveRaceChallengeResponseSchema, type LiveRaceCapability} from "@qwordly/core/race";
import {tr} from "../../i18n";

/** Addresses an existing game player; the server owns targeting, inbox persistence and push delivery. */
export function LiveRaceDirectInvite({challengeId, transport}: {
  /** Server-reserved lobby. */ challengeId: string;
  /** Authenticated platform transport. */ transport: LiveRaceCapability;
}) {
  /** Local presentation state for this mounted invitation or consent flow. */
  const [username, setUsername] = useState("");
  /** Local presentation state for this mounted invitation or consent flow. */
  const [busy, setBusy] = useState(false);
  /** Local presentation state for this mounted invitation or consent flow. */
  const [queued, setQueued] = useState(false);
  /** Local presentation state for this mounted invitation or consent flow. */
  const [failed, setFailed] = useState(false);
  /** Immediate operation lock prevents duplicate clicks. */
  const lock = useRef(false);
  /** One direct invitation mutation retains the lobby’s idempotent receipt. */
  const send = async () => {
    if (lock.current || queued || !transport.sendChallenge || username.trim().length < 3) return;
    lock.current = true; setBusy(true); setFailed(false);
    try {
      SendLiveRaceChallengeResponseSchema.parse(await transport.sendChallenge({challengeId, recipientUsername: username.trim()}));
      setQueued(true);
    } catch {setFailed(true);}
    finally {lock.current = false; setBusy(false);}
  };
  return transport.sendChallenge ? <div className="live-race-direct-invite">
    <label>{tr("RaceTo10.PLAYER_USERNAME")}<input value={username} maxLength={80} disabled={busy || queued}
      autoComplete="off" onChange={event => setUsername(event.target.value)} /></label>
    <button className="race-secondary" disabled={busy || queued || username.trim().length < 3} aria-busy={busy}
      onClick={() => void send()}>{tr("RaceTo10.NOTIFY_PLAYER")}</button>
    {queued && <p role="status">{tr("RaceTo10.INVITE_QUEUED")}</p>}
    {failed && <p role="alert">{tr("RaceTo10.ERROR_GENERIC")}</p>}
  </div> : null;
}
