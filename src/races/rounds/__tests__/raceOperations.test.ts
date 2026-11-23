import {describe, expect, it} from "@jest/globals";
import {raceOperationRequiresReceipt, type RaceOperation} from "../raceOperations";

describe("race operation policy", () => {
  it("requires receipts for every server mutation", () => {
    /** Multiplayer mutations protected by idempotency receipts. */
    const mutations: RaceOperation[] = ["raceStart", "raceGuess", "raceHint", "raceSkip", "raceAbandon", "racePublish"];
    expect(mutations.every(raceOperationRequiresReceipt)).toBe(true);
  });

  it("does not add receipts to read-only operations", () => {
    /** Multiplayer reads that only need bridge-level correlation. */
    const reads: RaceOperation[] = ["raceCategories", "raceResume", "raceChallenge", "raceOutcome", "raceInbox"];
    expect(reads.some(raceOperationRequiresReceipt)).toBe(false);
  });
});
