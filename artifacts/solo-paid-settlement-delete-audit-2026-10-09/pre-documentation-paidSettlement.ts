import type {readPendingGuessJournal,writePendingGuessJournal,acquirePendingPlayLease,releasePendingPlayLease, PendingGuessJournal,PendingPlayStorage} from "./pendingGuessJournal";

/** Storage operations stay bound to the concrete adapter without a runtime import cycle. */
export type JournalOperations = readonly [read: typeof readPendingGuessJournal, write: typeof writePendingGuessJournal,
  acquire: typeof acquirePendingPlayLease, release: typeof releasePendingPlayLease];

/** Completes only an unchanged, lease-owned receipt transition; replaced journals retire the retry. */
function settlePendingGuessJournal(scope: string, expected: string, journal: PendingGuessJournal | null,
  owner: string, now: number, storage: PendingPlayStorage, operations: JournalOperations): boolean {
  /** Adapter-bound operations preserve the existing durable validation and lease rules. */
  const [read, write, acquire] = operations;
  try {
    /** Exact stored predecessor prevents a stale tab from overwriting a newer draft. */
    const key = `riddleQuest:pendingPlay:v1:${scope}`;
    /** Legacy invalid optional metadata is normalized by the same durable reader as recovery. */
    const unchanged = () => {
      /** An unavailable reader must keep the persistence obligation alive. */
      const raw = storage.getItem(key);
      if (raw === expected) return true;
      /** Only validated stored gameplay can establish a replacement. */
      const stored = raw === null ? null : read(scope, storage);
      if (raw !== null && !stored) throw new Error("Journal unavailable");
      return JSON.stringify(stored) === expected;
    };
    if (!unchanged()) return true;
    if (!acquire(scope, owner, now, storage)) return false;
    if (!unchanged()) return true;
    if (journal) return journal.scope === scope && write(journal, storage);
    storage.removeItem(key);
    return storage.getItem(key) === null;
  } catch {return false;}
}

/** Mutable cells keep deferred persistence on the latest mounted gameplay state. */
type Cell<T> = {/** Current committed value. */ current: T};
/** One retry is bound to a captured receipt and delivery lifetime. */
export type SettlementPersistence = readonly [
  /** Current delivery lifetime. */ owner: Cell<{scope: string | null} | null>,
  /** Render-time account scope. */ scope: Cell<string | null>,
  /** Latest remaining journal, or settled deletion. */ journal: Cell<PendingGuessJournal | null>,
  /** Immutable expected predecessor bytes. */ pending: Cell<string | null>,
  /** Current renewal clock handle. */ timer: Cell<number | null>,
  /** This tab's durable lease identity. */ tabOwner: string,
  /** Clock and cancellation remain target-owned. */ clock: Pick<Window, "clearInterval"> & {/** Current lease time. */ now: () => number},
];
/** Deferred coordinator cannot borrow a newer receipt or account after module loading. */
export function persist(storage: PendingPlayStorage, state: SettlementPersistence,
  owner: {scope: string}, expected: string, operations: JournalOperations): void {
  /** Named tuple entries keep the compact internal call explicit inside the deferred coordinator. */
  const [ownerRef, scope, journal, pending, timer, tabOwner, clock] = state;
  /** Every mutation belongs to the exact admitting lifetime and receipt. */
  const owns = () => ownerRef.current === owner && scope.current === owner.scope &&
    pending.current === expected && (!journal.current || journal.current.scope === owner.scope);
  if (!owns() || !settlePendingGuessJournal(owner.scope, expected, journal.current,
    tabOwner, clock.now(), storage, operations) || !owns()) return;
  pending.current = null;
  if (!journal.current?.queue.length && !journal.current?.coinAction && timer.current !== null) {
    clock.clearInterval(timer.current);
    timer.current = null;
  }
  if (!journal.current) operations[3](owner.scope, tabOwner, storage);
}
