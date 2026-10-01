import {assertRaceMatchReadBudget, RACE_MATCH_DOCUMENT_READ_BUDGET, RACE_MATCH_TRANSACTION_BUDGET,
  withMeteredRaceTransaction, type RaceMatchReadMeter} from "../../race/raceMatchReadMeter";

it("counts retried eligibility reads without changing transaction method ownership", async () => {
  /** Simulated transaction uses its own context for both reads and writes. */
  const transaction = {owner: "transaction", get: async function() {return {exists: this.owner === "transaction"};},
    set: function() {expect(this.owner).toBe("transaction"); return this;}};
  /** Both callback invocations represent real attempted reads, even when one commit is retried. */
  const db = {runTransaction: async (operation: (tx: typeof transaction) => Promise<unknown>) => {
    await operation(transaction);
    return operation(transaction);
  }} as unknown as FirebaseFirestore.Firestore;
  /** Provides meter behavior. */
  const meter: RaceMatchReadMeter = {documentReadAttempts: 0, transactionAttempts: 0};
  /** Provides reference behavior. */
  const reference = {} as FirebaseFirestore.DocumentReference;
  /** Provides result behavior. */
  const result = await withMeteredRaceTransaction(db, meter, async measured => {
    /** Provides snapshot behavior. */
    const snapshot = await measured.get(reference);
    measured.set(reference, {});
    return snapshot.exists;
  });
  expect(result).toBe(true);
  expect(meter).toEqual({documentReadAttempts: 2, transactionAttempts: 2});
});

it("issues exactly the remaining reads and stops before a retried transaction can exceed the work budget", async () => {
  /** Read mock records actual issued work rather than just the wrapper's counter. */
  const get = jest.fn(async () => ({exists: true}));
  /** Automatic callback retry consumes the same lookup budget. */
  const db = {runTransaction: async (operation: (tx: unknown) => Promise<unknown>) => {
    await operation({get});
    return operation({get});
  }} as unknown as FirebaseFirestore.Firestore;
  /** Exactly one document read remains, even across retries. */
  const meter = {documentReadAttempts: RACE_MATCH_DOCUMENT_READ_BUDGET - 1, transactionAttempts: 0};
  await expect(withMeteredRaceTransaction(db, meter, tx => tx.get({} as FirebaseFirestore.DocumentReference)))
    .rejects.toMatchObject({code: "resource-exhausted"});
  expect(get).toHaveBeenCalledTimes(1);
  expect(meter.documentReadAttempts).toBe(RACE_MATCH_DOCUMENT_READ_BUDGET);
});

it("permits the final transaction but refuses to start another callback", async () => {
  /** Database retries the operation after the last permitted callback. */
  const db = {runTransaction: async (operation: (tx: unknown) => Promise<unknown>) => {
    await operation({});
    return operation({});
  }} as unknown as FirebaseFirestore.Firestore;
  /** Only one transaction callback remains. */
  const meter = {documentReadAttempts: 0, transactionAttempts: RACE_MATCH_TRANSACTION_BUDGET - 1};
  /** Last callback may execute reads without mistaking its own count for a new transaction. */
  const operation = jest.fn(async () => {assertRaceMatchReadBudget(meter); return true;});
  await expect(withMeteredRaceTransaction(db, meter, operation)).rejects.toMatchObject({code: "resource-exhausted"});
  expect(operation).toHaveBeenCalledTimes(1);
  expect(meter.transactionAttempts).toBe(RACE_MATCH_TRANSACTION_BUDGET);
});

it("does not issue storage work after the elapsed deadline", async () => {
  /** Fixed wall clock avoids conflating test scoring time with elapsed lookup time. */
  const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
  try {
    expect(() => assertRaceMatchReadBudget({documentReadAttempts: 0, transactionAttempts: 0, deadlineAtMs: 1000}))
      .toThrow(expect.objectContaining({code: "deadline-exceeded"}));
    expect(() => assertRaceMatchReadBudget({documentReadAttempts: 0, transactionAttempts: 0, deadlineAtMs: 1001})).not.toThrow();
  } finally {clock.mockRestore();}
});

it("drains an already-issued read before returning a parallel budget rejection", async () => {
  /** Explicitly controlled pending storage request survives the other read's budget rejection. */
  let complete!: (value: boolean) => void;
  /** Fake read cannot settle until the test releases it. */
  const pending = new Promise<boolean>(resolve => {complete = resolve;});
  /** Uses the real transaction wrapper with a parallel read caller. */
  const db = {runTransaction: (operation: (tx: unknown) => Promise<unknown>) => operation({get: () => pending})} as unknown as FirebaseFirestore.Firestore;
  /** Only one of the two requested reads may actually reach storage. */
  const meter = {documentReadAttempts: RACE_MATCH_DOCUMENT_READ_BUDGET - 1, transactionAttempts: 0};
  /** Result must remain pending until every issued storage request is drained. */
  const result = withMeteredRaceTransaction(db, meter, tx => Promise.all([
    tx.get({} as FirebaseFirestore.DocumentReference), tx.get({} as FirebaseFirestore.DocumentReference),
  ]));
  /** Observation handler prevents any unhandled rejection while retaining the original result. */
  let settled = false;
  void result.then(() => {settled = true;}, () => {settled = true;});
  await Promise.resolve();
  await Promise.resolve();
  expect(settled).toBe(false);
  complete(true);
  await expect(result).rejects.toMatchObject({code: "resource-exhausted"});
});

it("coalesces shared paths within a callback and rereads them on transaction retry", async () => {
  /** References share identity through their physical storage path. */
  const a = {path: "records/a"} as FirebaseFirestore.DocumentReference;
  /** Independent canonical dependency must still be fetched. */
  const b = {path: "records/b"} as FirebaseFirestore.DocumentReference;
  /** A retry observes a changed authoritative value rather than an earlier callback's cache. */
  let exists = false;
  /** Actual read records retain method ownership and the original reference. */
  const transaction = {
    owner: "transaction",
    get: jest.fn(async function(reference: FirebaseFirestore.DocumentReference) {expect(this.owner).toBe("transaction"); return {ref: reference, exists};}),
    getAll: jest.fn(async function(...references: FirebaseFirestore.DocumentReference[]) {expect(this.owner).toBe("transaction"); return references.map(ref => ({ref, exists}));}),
  };
  /** Automatic retry discards the earlier transaction's cached promises. */
  const db = {runTransaction: async (operation: (tx: typeof transaction) => Promise<boolean>) => {
    expect(await operation(transaction)).toBe(false); exists = true; return operation(transaction);
  }} as unknown as FirebaseFirestore.Firestore;
  /** Additional counters distinguish network work from reused logical checks. */
  const meter = {documentReadAttempts: 0, transactionAttempts: 0, documentReadBatches: 0, documentReadCacheHits: 0};
  expect(await withMeteredRaceTransaction(db, meter, async tx => {
    /** Concurrent callers reuse in-flight reads as well as completed snapshots. */
    const [single, grouped] = await Promise.all([tx.get(a), tx.getAll(a, b, a)]);
    expect(grouped[0]).toBe(single); expect(grouped[2]).toBe(single);
    return single.exists;
  })).toBe(true);
  expect(transaction.get).toHaveBeenCalledTimes(2);
  expect(transaction.getAll).toHaveBeenCalledTimes(2);
  expect(meter).toEqual({documentReadAttempts: 4, transactionAttempts: 2, documentReadBatches: 4, documentReadCacheHits: 4});
});

it("admits a whole unique batch before issuing work and counts duplicate paths once", async () => {
  /** Two independent paths distinguish grouped admission from logical reference count. */
  const a = {path: "records/a"} as FirebaseFirestore.DocumentReference;
  /** Second unique document cannot fit in the remaining budget. */
  const b = {path: "records/b"} as FirebaseFirestore.DocumentReference;
  /** Physical grouped read is the observable storage boundary. */
  const getAll = jest.fn(async (...references: FirebaseFirestore.DocumentReference[]) => references.map(ref => ({ref, exists: false})));
  /** No automatic retry is needed to exercise the final permitted read. */
  const db = {runTransaction: (operation: (tx: unknown) => Promise<unknown>) => operation({getAll})} as unknown as FirebaseFirestore.Firestore;
  /** Exactly one physical read remains. */
  const meter = {documentReadAttempts: 999, transactionAttempts: 0};
  await expect(withMeteredRaceTransaction(db, meter, tx => tx.getAll(a, b))).rejects.toMatchObject({code: "resource-exhausted"});
  expect(getAll).not.toHaveBeenCalled();
  expect(meter.documentReadAttempts).toBe(999);
  expect(await withMeteredRaceTransaction(db, meter, tx => tx.getAll(a, a))).toHaveLength(2);
  expect(getAll).toHaveBeenCalledTimes(1);
  expect(meter.documentReadAttempts).toBe(1000);
});


it("refuses actual batch dispatch if elapsed time expires after admission", async () => {
  /** First observation permits admission; the next observation represents a delayed dispatch. */
  const clock = jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1000).mockReturnValue(2000);
  /** Canonical grouped storage is never called after the elapsed deadline. */
  const getAll = jest.fn(async () => []);
  /** Transaction start and batch admission precede the independently guarded dispatch. */
  const db = {runTransaction: (operation: (tx: unknown) => Promise<unknown>) => operation({getAll})} as unknown as FirebaseFirestore.Firestore;
  try {
    await expect(withMeteredRaceTransaction(db, {documentReadAttempts: 0, transactionAttempts: 0, deadlineAtMs: 1500},
      tx => tx.getAll({path: "records/a"} as FirebaseFirestore.DocumentReference))).rejects.toMatchObject({code: "deadline-exceeded"});
    expect(getAll).not.toHaveBeenCalled();
  } finally {clock.mockRestore();}
});

it("coalesces concurrent eligibility batches without losing ordering or shared snapshots", async () => {
  /** Distinct attempts from parallel candidate checks share one physical RPC. */
  const refs = ["a", "b", "c"].map(id => ({path: `records/${id}`} as FirebaseFirestore.DocumentReference));
  /** Transport records the actual RPC boundary and requested document order. */
  const getAll = jest.fn(async (...references: FirebaseFirestore.DocumentReference[]) => references.map(ref => ({ref, exists: true})));
  /** One transaction callback isolates cache and batching from every subsequent retry. */
  const db = {runTransaction: (operation: (tx: unknown) => Promise<unknown>) => operation({getAll})} as unknown as FirebaseFirestore.Firestore;
  /** Meter must report physical batches rather than concurrent logical callers. */
  const meter = {documentReadAttempts: 0, transactionAttempts: 0, documentReadBatches: 0};
  await withMeteredRaceTransaction(db, meter, async tx => {
    /** Reversed second group exercises caller ordering and cross-group duplicates. */
    const [first, second] = await Promise.all([tx.getAll(refs[0], refs[1]), tx.getAll(refs[2], refs[1])]);
    expect(first.map(snapshot => snapshot.ref.path)).toEqual(["records/a", "records/b"]);
    expect(second.map(snapshot => snapshot.ref.path)).toEqual(["records/c", "records/b"]);
    expect(first[1]).toBe(second[1]);
  });
  expect(getAll).toHaveBeenCalledTimes(1);
  expect(meter).toEqual({documentReadAttempts: 3, transactionAttempts: 1, documentReadBatches: 1});
});
