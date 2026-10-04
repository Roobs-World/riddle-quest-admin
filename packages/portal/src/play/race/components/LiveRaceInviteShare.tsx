import {useEffect, useRef, useState} from "react";
import {useReferralSharing} from "../../sharing/ReferralSharingCapability";
import {tr} from "../../i18n";
import {type LiveRaceCapability} from "@qwordly/core/race";
import {LiveRaceDirectInvite} from "./LiveRaceDirectInvite";

/** One visit to a lobby and its target-owned native callback owns dialog feedback. */
type NativeInviteOwner = {
  /** Immutable server invitation selected for this visit. */ challengeId: string;
  /** Authenticated multiplayer provider identity. */ transport?: LiveRaceCapability;
  /** Exact native dialog callback selected from the current target. */ shareChallenge?: LiveRaceCapability["shareChallenge"];
};

/** Opens only the active platform's native invitation dialog for a reserved live lobby. */
export function LiveRaceInviteShare({challengeId, transport}: {
  /** Server-issued invitation handle, never a player identity. */ challengeId: string;
  /** Target-owned direct invitation delivery. */ transport?: LiveRaceCapability;
}) {
  /** Optional platform behavior supplied by the authenticated target adapter. */
  const sharing = useReferralSharing();
  /** The target multiplayer adapter can invite friends without referral rewards. */
  const shareChallenge = transport?.shareChallenge ?? sharing?.shareLiveRace;
  /** Replacing ownership hides old feedback without releasing a still-open provider dialog. */
  const owner = useRef<NativeInviteOwner>({challengeId, transport, shareChallenge});
  if (owner.current.challengeId !== challengeId || owner.current.transport !== transport || owner.current.shareChallenge !== shareChallenge)
    owner.current = {challengeId, transport, shareChallenge};
  /** Immediate exclusion survives lobby/provider replacement until native settlement. */
  const lock = useRef(false);
  /** The original effect lifetime suppresses all feedback after retirement. */
  const lifetime = useRef<AbortController | null>(null);
  /** Native dialog currently owns input. */
  const [busy, setBusy] = useState(false);
  /** Failure copy belongs only to the lobby/provider visit that opened the dialog. */
  const [failedOwner, setFailedOwner] = useState<NativeInviteOwner | null>(null);
  useEffect(() => {
    /** StrictMode effect replay receives its own presentation lifetime. */
    const abort = new AbortController(); lifetime.current = abort;
    return () => abort.abort();
  }, []);
  /** Sends the invite without treating a dialog success as recipient acceptance. */
  const send = async () => {
    /** The click captures exact ownership before opening provider UI synchronously. */
    const selected = owner.current, signal = lifetime.current?.signal;
    if (lock.current || !selected.shareChallenge || !signal || signal.aborted) return;
    lock.current = true;
    setBusy(true);
    setFailedOwner(null);
    try {
      /** Only declared success or expected dismissal avoid the retry notice. */
      const result = await selected.shareChallenge({challengeId: selected.challengeId});
      if (!signal.aborted && owner.current === selected && result !== "success" && result !== "cancelled")
        setFailedOwner(selected);
    } catch {if (!signal.aborted && owner.current === selected) setFailedOwner(selected);}
    finally {
      // Elapsed time cannot prove that native UI has closed: keep exclusion until settlement.
      lock.current = false;
      if (!signal.aborted) setBusy(false);
    }
  };
  return shareChallenge ? <div className="live-race-invite-share">
    <button className="race-primary" disabled={busy} aria-busy={busy} onClick={() => void send()}>{tr("RaceTo10.CHALLENGE_FRIEND")}</button>
    {failedOwner === owner.current && <p role="alert">{tr("RaceTo10.ERROR_GENERIC")}</p>}
    {transport?.sendChallenge && <LiveRaceDirectInvite challengeId={challengeId} transport={transport} />}
  </div> : null;
}
