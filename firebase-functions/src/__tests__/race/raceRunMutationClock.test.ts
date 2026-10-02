import {mutateRaceRun} from "../../race/raceRunMutation";
import type {RaceRunRecord} from "../../race/raceEngine";

jest.mock("../../race/raceSetupService", () => ({
  parseRunRecord: (run: unknown) => run,
  requestDocumentId: (_userId: string, requestId: string) => requestId,
  applyActionRateLimit: (run: unknown) => run,
  stripUndefined: (value: unknown) => value,
}));
jest.mock("../../race/raceOpponentPrivacy", () => ({
  resolveRaceOpponentPrivacy: async (_tx: unknown, _db: unknown, run: unknown) => ({run, scrubbed: false}),
  raceRunPrivacyWrite: (run: unknown) => run,
}));
jest.mock("../../race/raceSettlement", () => ({settleRaceRun: async (_tx: unknown, _db: unknown, run: unknown) => run}));
jest.mock("../../race/raceReceiptPrivacy", () => ({
  hydrateRaceReceiptResponse: (response: unknown) => response,
  minimizeRaceReceiptResponse: (response: unknown) => response,
  raceReceiptExpiresAt: () => 999999,
}));

jest.mock("../../race/raceTransactionReads", () => ({withRaceTransactionReads: (transaction: unknown) => transaction}));
jest.mock("../../race/raceRequestBinding", () => ({
  bindRaceRequest: () => ({version: 1, kind: "skip", fingerprint: "0".repeat(64)}),
  assertRaceMutationReceipt: jest.fn(),
}));

/** Captures accepted command time without mixing in reward or storage adapters. */
const harness = (run: RaceRunRecord) => {
  /** Captures committed run snapshots for accepted-clock assertions. */
  const writes: RaceRunRecord[] = [];
  /** Identifies run and receipt reads in the isolated transaction adapter. */
  const runRef = {kind: "run", collection: () => ({doc: () => ({kind: "receipt"})})};
  /** Records writes while returning the original authoritative run. */
  const transaction = {
    get: async (ref: {
      /** Distinguishes the run document from its receipt. */
      kind: string;
    }) => ref.kind === "run"
      ? {exists: true, id: run.runId, data: () => run}
      : {exists: false},
    set: (_ref: unknown, value: RaceRunRecord) => writes.push(value),
    create: jest.fn(),
  };
  /** Executes mutations with the same deterministic transaction adapter. */
  const db = {collection: () => ({doc: () => runRef}), runTransaction: async (fn: (tx: unknown) => unknown) => fn(transaction)};
  return {db: db as unknown as FirebaseFirestore.Firestore, writes};
};

describe("accepted race command clocks", () => {
  it.each([1500, 2300])("advances a retained hint marker for a later command at %i", async sampledAtMs => {
    /** Retained hint progress constrains subsequent accepted command clocks. */
    const run = {runId: "clock-run", userId: "owner", role: "creator", status: "active", startedAtMs: 1000,
      lastActionAtMs: 1200, events: [], hintPenaltyMs: 0, skipPenaltyMs: 0} as unknown as RaceRunRecord;
    /** Observes persisted clocks independently of the mutation callback. */
    const h = harness(run);
    /** Records the command time passed to the authoritative transition. */
    const mutate = jest.fn((accepted: RaceRunRecord, _acceptedAtMs: number) => ({run: accepted, response: {ok: true}}));
    await mutateRaceRun("owner", {kind: "skip", input: {runId: run.runId, requestId: "new-command", riddleId: "question"}}, sampledAtMs, h.db, mutate);
    expect(h.writes[0]).toMatchObject({lastActionAtMs: sampledAtMs});
    expect(mutate.mock.calls[0][1]).toBe(sampledAtMs);
  });

  it("cannot sample an accepted command before retained event progress", async () => {
    /** Retained hint progress constrains subsequent accepted command clocks. */
    const run = {runId: "clock-run", userId: "owner", role: "creator", status: "active", startedAtMs: 1000,
      lastActionAtMs: 1200, events: [{wallElapsedMs: 1800}], hintPenaltyMs: 0, skipPenaltyMs: 0} as unknown as RaceRunRecord;
    /** Observes persisted clocks independently of the mutation callback. */
    const h = harness(run);
    /** Records the command time passed to the authoritative transition. */
    const mutate = jest.fn((accepted: RaceRunRecord, _acceptedAtMs: number) => ({run: accepted, response: {ok: true}}));
    await mutateRaceRun("owner", {kind: "skip", input: {runId: run.runId, requestId: "reordered-command", riddleId: "question"}}, 2000, h.db, mutate);
    expect(h.writes[0]).toMatchObject({lastActionAtMs: 2800});
    expect(mutate.mock.calls[0][1]).toBe(2800);
  });
});
