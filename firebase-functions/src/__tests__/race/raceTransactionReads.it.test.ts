import {withMeteredRaceTransaction} from "../../race/raceMatchReadMeter";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {withRaceTransactionReads} from "../../race/raceTransactionReads";

/** Emulator-only checks exercise the actual SDK transaction restrictions. */
let db: FirebaseFirestore.Firestore;
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("transaction-read-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
it("retains the SDK read-after-write rejection even for an already cached document", async () => {
  /** Disposable emulator document belongs only to this guard regression. */
  const ref = db.doc("transactionReadTests/order");
  await ref.set({value: 1});
  await db.runTransaction(async attempt => {
    /** Wrapper is always created within the actual retry callback. */
    const transaction = withRaceTransactionReads(attempt);
    expect((await transaction.get(ref)).data()).toEqual({value: 1});
    transaction.set(ref, {value: 2});
    expect(() => transaction.get(ref)).toThrow(/reads.*before.*writes/i);
  });
  expect((await ref.get()).data()).toEqual({value: 2});
});
it("leaves query reads uncached and preserves SDK transaction receivers", async () => {
  await db.runTransaction(async attempt => {
    /** Query calls still execute independently against the same locked transaction. */
    const reads = jest.spyOn(attempt, "get");
    /** Wrapped SDK receiver retains the implementation's private transaction state. */
    const transaction = withRaceTransactionReads(attempt);
    await transaction.get(db.collection("transactionReadTests"));
    await transaction.get(db.collection("transactionReadTests"));
    expect(reads).toHaveBeenCalledTimes(2);
  });
});

it("combines concurrent eligibility groups into one actual SDK read", async () => {
  /** Independent references represent per-candidate attempt/privacy checks. */
  const a = db.doc("transactionReadTests/batch-a"), b = db.doc("transactionReadTests/batch-b");
  await a.set({value: "a"});
  await b.set({value: "b"});
  /** Real transaction spy measures physical calls, including any automatic retry. */
  const transport = {runTransaction: (operation: (transaction: FirebaseFirestore.Transaction) => Promise<void>) =>
    db.runTransaction(async transaction => {
      /** SDK implementation and receiver remain intact. */
      const calls = jest.spyOn(transaction, "getAll");
      try {await operation(transaction); expect(calls).toHaveBeenCalledTimes(1);}
      finally {calls.mockRestore();}
    })} as unknown as FirebaseFirestore.Firestore;
  await withMeteredRaceTransaction(transport, {documentReadAttempts: 0, transactionAttempts: 0}, async transaction => {
    /** Caller order is preserved even when one requested group reverses it. */
    const [[first], [second, shared]] = await Promise.all([transaction.getAll(a), transaction.getAll(b, a)]);
    expect(first.data()).toEqual({value: "a"});
    expect(second.data()).toEqual({value: "b"});
    expect(shared).toBe(first);
  });
});

it("retains actual SDK write rejection in a metered read-only discovery snapshot", async () => {
  /** Read-only authority can observe but never modify this real emulator document. */
  const ref = db.doc("transactionReadTests/read-only");
  await ref.set({value: 1});
  /** Physical reads and transaction attempts remain measured in read-only mode. */
  const meter = {documentReadAttempts: 0, transactionAttempts: 0};
  await withMeteredRaceTransaction(db, meter, async transaction => {
    expect((await transaction.get(ref)).data()).toEqual({value: 1});
    expect(() => transaction.set(ref, {value: 2})).toThrow(/read.only/i);
  }, {readOnly: true});
  expect((await ref.get()).data()).toEqual({value: 1});
  expect(meter).toMatchObject({documentReadAttempts: 1, transactionAttempts: 1});
});
