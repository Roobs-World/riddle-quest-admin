import {useCallback, useRef, useState} from "react";

/** Owns transient host notices independently of a persistent target configuration warning. */
export function useHostNotice({owner, configurationWarning, ownsMessage}: {
  /** Authentication visit identity; profile-only updates preserve it. */
  owner: unknown;
  /** Target configuration warning remains available for each new account visit. */
  configurationWarning: string | null;
  /** Subscription guard retires notices before React commits an account replacement. */
  ownsMessage?: () => boolean;
}) {
  /** Current render ownership also rejects callbacks captured by an older visit. */
  const currentOwner = useRef(owner);
  /** Latest immediate subscription guard for this account visit. */
  const currentGuard = useRef(ownsMessage);
  currentOwner.current = owner;
  currentGuard.current = ownsMessage;
  /** Stored notices retain their originating account rather than becoming global host state. */
  const [stored, setStored] = useState({owner, value: configurationWarning});
  /** Old setters and old queued state updates cannot clear or replace the current player's notice. */
  const setNotice = useCallback((value: string | null) => {
    /** Rechecks both render identity and pre-render subscription ownership. */
    const owned = () => currentOwner.current === owner && (currentGuard.current?.() ?? true);
    if (!owned()) return;
    setStored(current => owned() ? {owner, value} : current);
  }, [owner]);
  return {notice: stored.owner === owner ? stored.value : configurationWarning, setNotice};
}
