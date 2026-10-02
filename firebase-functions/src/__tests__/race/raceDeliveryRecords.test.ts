import {Timestamp} from "firebase-admin/firestore";
import {parseRacePerformanceEvent, parseRaceSettlementEvent} from "../../race/raceDeliveryRecords";

/** Minimal legacy processing receipt remains supported. */
const receipt = () => ({runId: "run-1", userId: "player-1", createdAtMs: 1000,
  expiresAt: Timestamp.fromMillis(1000000), delivered: false});
/** Canonical creator projection metadata can include a negative finish delta. */
const settlement = () => ({...receipt(), creatorId: "creator-1", challengeId: "challenge-1",
  categoryId: "history", result: "loss", adjustedDeltaMs: -500});

it("accepts legacy receipts and complete supported delivery states", () => {
  expect(parseRacePerformanceEvent(receipt(), "run-1").delivered).toBe(false);
  expect(parseRaceSettlementEvent(settlement(), "run-1").adjustedDeltaMs).toBe(-500);
  for (const deliveryState of ["pending", "delivered", "suppressed", "quarantined"] as const) {
    expect(parseRacePerformanceEvent({...receipt(), deliveryState, delivered: deliveryState !== "pending"}, "run-1").deliveryState).toBe(deliveryState);
  }
});

it.each([
  {runId: "another-run"}, {userId: "unsafe/path"}, {createdAtMs: -1}, {createdAtMs: NaN},
  {expiresAt: {seconds: 1000}}, {deliveryAttempts: 21}, {deliveryAttempts: 0.5},
  {replayId: ""}, {replayId: "unsafe/path"}, {replayId: 42}, {nextAttemptAtMs: Infinity}, {replayedAtMs: -1}, {deliveryState: "unknown"},
  {deliveryState: "delivered", delivered: false}, {deliveryState: "pending", delivered: true},
  {quarantined: true}, {suppressed: true}, {quarantined: "yes"},
  {facebookPerformanceRecorded: "yes"}, {facebookPerformanceRecorded: false},
])("rejects malformed owner receipts with answer-free errors: %j", overrides => {
  expect(() => parseRacePerformanceEvent({...receipt(), ...overrides}, "run-1"))
    .toThrow("Stored race performance receipt is invalid.");
});

it.each([{creatorId: ""}, {challengeId: "unsafe/path"}, {categoryId: "unknown"}, {result: "player_win"}, {adjustedDeltaMs: 0.5}])(
  "rejects malformed creator metadata: %j", overrides => {
    expect(() => parseRaceSettlementEvent({...settlement(), ...overrides}, "run-1"))
      .toThrow("Stored race settlement receipt is invalid.");
  },
);
