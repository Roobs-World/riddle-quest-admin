import {useEffect, useState} from "react";
import {
  ACCOUNT_DELETION_CLEANUP_PENDING_KEY,
  ACCOUNT_DELETION_EPOCH_KEY,
  isAccountDeletionCleanupPending,
} from "./accountDeletionCleanup";
import type {NotificationOperationGate} from "./notifications/operationGate";
import {installBrowserPlayerStateMutationGuard} from "../play/playerPreferences";

/** Permanently quiesces a live tab when another same-origin tab requests deletion. */
export function useAccountDeletionQuiescence(gate: NotificationOperationGate): boolean {
  const [quiesced, setQuiesced] = useState(isAccountDeletionCleanupPending);
  useEffect(() => {
    const removeMutationGuard = installBrowserPlayerStateMutationGuard(gate.isOpen);
    if (quiesced) gate.close();
    const onStorage = (event: StorageEvent) => {
      if (
        (event.key === ACCOUNT_DELETION_EPOCH_KEY && event.newValue !== null) ||
        (event.key === ACCOUNT_DELETION_CLEANUP_PENDING_KEY && event.newValue !== null)
      ) {
        gate.close();
        setQuiesced(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      removeMutationGuard();
    };
  }, [gate, quiesced]);
  return quiesced;
}
