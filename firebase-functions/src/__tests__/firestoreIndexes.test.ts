import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, expect, it} from "@jest/globals";

/** Reads the deployed Firestore index and TTL policy. */
const readIndexConfig = () => JSON.parse(
  readFileSync(resolve(__dirname, "../../firestore.indexes.json"), "utf8"),
) as {fieldOverrides?: Array<Record<string, unknown>>};

describe("Firestore index policy", () => {
  it("enables TTL without indexing loss completion receipt expiries", () => {
    expect(readIndexConfig().fieldOverrides).toContainEqual({
      collectionGroup: "gameCompletionReceipts",
      fieldPath: "expiresAt",
      ttl: true,
      indexes: [],
    });
  });

  it("bounds race inbox retention and indexes server-only deletion links", () => {
    const overrides = readIndexConfig().fieldOverrides;
    expect(overrides).toContainEqual({
      collectionGroup: "raceInbox",
      fieldPath: "expiresAt",
      ttl: true,
      indexes: [],
    });
    for (const fieldPath of ["opponentUserId", "itemId"]) {
      expect(overrides).toContainEqual({
        collectionGroup: "raceInbox",
        fieldPath,
        indexes: [{order: "ASCENDING", queryScope: "COLLECTION_GROUP"}],
      });
    }
  });

  it("indexes the owner link on nested race receipts for deletion", () => {
    expect(readIndexConfig().fieldOverrides).toContainEqual({
      collectionGroup: "requests",
      fieldPath: "userId",
      indexes: [{order: "ASCENDING", queryScope: "COLLECTION_GROUP"}],
    });
  });
});
