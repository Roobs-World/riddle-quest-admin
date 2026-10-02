import {expect, it, jest} from "@jest/globals";
import type {RaceOutcome} from "@qwordly/core/race";
import {deliverHostRaceResult} from "../hostRaceResultEffects";

/** Canonical recording delivered to optional target callbacks. */
const result: RaceOutcome = {runId: "run-1", result: "recorded", correctCount: 10, wallFinishMs: 40000,
  hintPenaltyMs: 0, skipPenaltyMs: 0, totalPenaltyMs: 0, adjustedFinishMs: 40000, publishable: true,
  rematchEligible: false, newlyUnlockedAchievementIds: [], achievementCoinsAwarded: 0};

it("does not start provider work after the originating account is replaced", async () => {
  /** Observes both external callback boundaries. */
  const record = jest.fn(async () => undefined), show = jest.fn(async () => undefined);
  await deliverHostRaceResult(result, () => false, record, show);
  expect(record).not.toHaveBeenCalled(); expect(show).not.toHaveBeenCalled();
});
it("does not open results after ownership changes during provider recording", async () => {
  /** The provider acknowledgment is independent of later account changes. */
  let finish!: () => void, current = true;
  /** Actual pending provider completion used by the production callback sequence. */
  const pending = new Promise<void>(resolve => {finish = resolve;});
  /** Only the still-current owner can request result presentation. */
  const record = jest.fn(() => pending), show = jest.fn(async () => undefined);
  /** Starts recording while the original account is still current. */
  const delivery = deliverHostRaceResult(result, () => current, record, show);
  expect(record).toHaveBeenCalledWith(result); current = false; finish(); await delivery;
  expect(show).not.toHaveBeenCalled();
});
it("retains both callbacks while the original account remains current", async () => {
  /** Provider work and result presentation each execute once. */
  const record = jest.fn(async () => undefined), show = jest.fn(async () => undefined);
  await deliverHostRaceResult(result, () => true, record, show);
  expect(record).toHaveBeenCalledWith(result); expect(show).toHaveBeenCalledTimes(1);
});
