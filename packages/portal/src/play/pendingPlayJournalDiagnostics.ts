import {createPendingPlayRecoveryStorage, writePendingGuessJournal, clearPendingGuessJournal, type PendingGuessJournal, type PendingPlayStorage} from "./pendingGuessJournal";
import {readPendingGuessJournal} from "./readPendingGuessJournal";
export {readPendingGuessJournal} from "./readPendingGuessJournal";

/** Synchronous inspection adapter extends gameplay storage for explicit diagnostics and fixtures. */
export function createPendingPlayJournalStorage(storage: PendingPlayStorage) {
  return {...createPendingPlayRecoveryStorage(storage),
    read: (scope: string) => readPendingGuessJournal(scope, storage),
    write: (journal: PendingGuessJournal, skipUnchanged = false) => writePendingGuessJournal(journal, storage, skipUnchanged),
    clear: (scope: string) => clearPendingGuessJournal(scope, storage),
  };
}
