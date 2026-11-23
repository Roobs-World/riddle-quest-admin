import {beforeEach, expect, it, jest} from "@jest/globals";

/** Pending and completed outbox snapshots returned by the fixture. */
let receipt: {
  /** Whether the canonical delivery has completed. */
  delivered: boolean;
  /** Earliest retry time while the receipt remains pending. */
  nextAttemptAtMs?: number;
};
/** Controls delivery completion independently of the receipt snapshot. */
const deliver = jest.fn(async () => false);
jest.mock("../../shared/firebaseAdmin", () => ({admin: {firestore: () => ({
  collection: () => ({doc: () => ({get: async () => ({exists: true, data: () => receipt})})}),
})}}));
jest.mock("../../race/settlement/raceSettlementDelivery", () => ({deliverRaceSettlement: (...args: unknown[]) => deliver(...args)}));
jest.mock("../../race/settlement/racePerformanceDelivery", () => ({deliverRacePerformance: (...args: unknown[]) => deliver(...args)}));

import {deliverRaceSettlementEvent, deliverRacePerformanceEvent} from "../../race/settlement/raceSettlementJobs";

beforeEach(() => {receipt = {delivered: false, nextAttemptAtMs: Date.now() + 30000}; jest.clearAllMocks();});

it.each([deliverRaceSettlementEvent, deliverRacePerformanceEvent])("retries pending receipts instead of acknowledging early Eventarc delivery", async handler => {
  /** Eventarc envelope for the fixture's bounded outbox receipt. */
  const event: Parameters<typeof handler.run>[0] = {
    params: {runId: "run-1"}, data: undefined, specversion: "1.0", id: "event-1",
    source: "test", type: "google.cloud.firestore.document.v1.created", time: new Date().toISOString(),
    location: "us-central1", project: "demo-riddle-quest", database: "(default)", namespace: "(default)",
    document: "raceSettlementOutbox/run-1",
  };
  await expect(handler.run(event)).rejects.toThrow("Race delivery remains pending.");
  receipt = {delivered: true};
  await expect(handler.run(event)).resolves.toBeUndefined();
  expect(deliver).toHaveBeenCalledTimes(2);
});
