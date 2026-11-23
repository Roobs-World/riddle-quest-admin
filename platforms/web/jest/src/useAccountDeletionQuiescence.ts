import {useEffect, useState} from "react";
import {
  ACCOUNT_DELETION_CLEANUP_PENDING_KEY,
  ACCOUNT_DELETION_EPOCH_KEY,
  isAccountDeletionCleanupPending,
} from "./accountDeletionCleanup";
import type {NotificationOperationGate} from "./notifications/operationGate";
import {installBrowserPlayerStateMutationGuard} from "../../../../src/web/play/playerPreferences";

/** Permanently quiesces a live tab when another same-origin tab requests deletion. */
export function useAccountDeletionQuiescence(gate: NotificationOperationGate): boolean {
  /** Provides [quiesced, set quiesced] behavior. */
  const [quiesced, setQuiesced] = useState(isAccountDeletionCleanupPending);
  useEffect(() => {
    /** Removes mutation guard. */
    const removeMutationGuard = installBrowserPlayerStateMutationGuard(gate.isOpen);
    if (quiesced) gate.close();
    /** Provides on storage behavior. */
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
