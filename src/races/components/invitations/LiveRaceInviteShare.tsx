import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {useReferralSharing, type ReferralSharingCapability} from "../../../sharing/components/ReferralSharingCapability";
import {tr} from "../../../localization/browser/i18n";
import {type LiveRaceCapability} from "../../contracts/index";
import {LiveRaceDirectInvite} from "./LiveRaceDirectInvite";

/** One visit to a lobby and its target-owned native callback owns dialog feedback. */
type NativeInviteOwner = {
  /** Immutable server invitation selected for this visit. */ challengeId: string;
  /** Authenticated multiplayer provider identity. */ transport?: LiveRaceCapability;
  /** Exact native dialog callback selected from the current target. */ shareChallenge?: ReferralSharingCapability["shareLiveRace"];
};

/** Opens only the active platform's native invitation dialog for a reserved live lobby. */
export function LiveRaceInviteShare({challengeId, transport, autoOpen = false, showInviteButton = true}: {
  /** Server-issued invitation handle, never a player identity. */ challengeId: string;
  /** Target-owned direct invitation delivery. */ transport?: LiveRaceCapability;
  /** Only an explicit creator action may open the provider dialog after reservation. */ autoOpen?: boolean;
  /** The lobby's primary action is Play game; invitations can open automatically instead. */ showInviteButton?: boolean;
}) {
  /** Optional platform behavior supplied by the authenticated target adapter. */
  const sharing = useReferralSharing();
  /** The target multiplayer adapter can invite friends without referral rewards. */
  const shareChallenge = sharing?.shareLiveRace;
  /** Each rendered lobby/provider visit has its own stable feedback identity. */
  const selectedOwner = useMemo<NativeInviteOwner>(() => ({challengeId, transport, shareChallenge}),
    [challengeId, transport, shareChallenge]);
  /** Native actions and pending feedback follow only the lobby that actually committed. */
  const owner = useRef(selectedOwner);
  useLayoutEffect(() => {owner.current = selectedOwner;}, [selectedOwner]);
  /** Immediate exclusion survives lobby/provider replacement until native settlement. */
  const lock = useRef(false);
  /** Pending native results may update only this still-mounted lobby visit. */
  const mounted = useRef(false);
  /** Effect replay and polling cannot open the same automatic invitation twice. */
  const openedAutomatically = useRef(false);
  /** Native dialog currently owns input. */
  const [busy, setBusy] = useState(false);
  /** Failure copy belongs only to the lobby/provider visit that opened the dialog. */
  const [failedOwner, setFailedOwner] = useState<NativeInviteOwner | null>(null);
  /** Dismissing the native dialog leaves an explicit way to reopen it. */
  const [dismissedOwner, setDismissedOwner] = useState<NativeInviteOwner | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false;};
  }, []);
  /** Sends the invite without treating a dialog success as recipient acceptance. */
  const send = useCallback(async () => {
    /** Both automatic and explicit sends retain the exact committed lobby and provider. */
    const selected = owner.current;
    if (lock.current || !selected.shareChallenge || !mounted.current) return;
    lock.current = true;
    setBusy(true);
    setFailedOwner(null);
    setDismissedOwner(null);
    try {
      /** Only declared success or expected dismissal avoid the retry notice. */
      const result = await selected.shareChallenge({challengeId: selected.challengeId});
      if (mounted.current && owner.current === selected) {
        if (result === "cancelled") setDismissedOwner(selected);
        else if (result !== "success") setFailedOwner(selected);
      }
    } catch {if (mounted.current && owner.current === selected) setFailedOwner(selected);}
    finally {
      // Elapsed time cannot prove that native UI has closed: keep exclusion until settlement.
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!autoOpen || (showInviteButton && !sharing?.autoOpenLiveRaceInvite) || !shareChallenge || openedAutomatically.current) return;
    openedAutomatically.current = true;
    void send();
  }, [autoOpen, showInviteButton, sharing?.autoOpenLiveRaceInvite, shareChallenge, send]);
  return shareChallenge ? <div className="live-race-invite-share">
    {(showInviteButton || !autoOpen || failedOwner === selectedOwner || dismissedOwner === selectedOwner) && <button className="race-secondary" disabled={busy} aria-busy={busy}
      onClick={() => void send()}>{tr(showInviteButton ? "RaceTo10.CHALLENGE_FRIEND" : "RaceTo10.RETRY")}</button>}
    {failedOwner === selectedOwner && <p role="alert">{tr("RaceTo10.ERROR_GENERIC")}</p>}
    {transport?.sendChallenge && <LiveRaceDirectInvite challengeId={challengeId} transport={transport} />}
  </div> : null;
}
