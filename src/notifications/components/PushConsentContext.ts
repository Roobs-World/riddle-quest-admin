import {createContext, useContext, useRef, useState} from "react";
import type {ReferralSharingCapability} from "../../sharing/components/ReferralSharingCapability";

/** Shared acknowledged consent and operation lock for every notification control. */
export function usePushConsentState(capability?: ReferralSharingCapability | null) {
  /** Only the active target can supply notification permission. */
  const sharing = capability;
  /** Local presentation state for this mounted invitation or consent flow. */
  const [enabled, setEnabled] = useState(false);
  /** Local presentation state for this mounted invitation or consent flow. */
  const [busy, setBusy] = useState(false);
  /** Local presentation state for this mounted invitation or consent flow. */
  const [unavailable, setUnavailable] = useState(false);
  /** Immediate operation lock prevents duplicate clicks. */
  const lock = useRef(false);
  /** Initial presentation is not proof that a previously saved subscription is disabled. */
  const acknowledged = useRef(false);
  /** Requests or revokes explicit consent through the target adapter. */
  const change = async (next: boolean) => {
    if (lock.current || (acknowledged.current && next === enabled) || !sharing?.setLiveRacePush) return;
    lock.current = true; setBusy(true); setUnavailable(false);
    try {
      /** Acknowledged consent outcome, separate from notification delivery. */
      const saved = await sharing.setLiveRacePush(next);
      if (saved) {acknowledged.current = true; setEnabled(next);} else setUnavailable(true);
    } catch {setUnavailable(true);}
    finally {lock.current = false; setBusy(false);}
  };
  return {enabled, busy, unavailable, change};
}

/** A mounted target provider owns consent so modal navigation retains the same state. */
export const PushConsentContext = createContext<ReturnType<typeof usePushConsentState> | null>(null);

/** Reads the target-owned consent presentation state. */
export function usePushConsent() {return useContext(PushConsentContext);}
