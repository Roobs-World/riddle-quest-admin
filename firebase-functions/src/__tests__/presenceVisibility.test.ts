import {deletePresenceForUser, refreshPresenceVisibility} from "../presence/presenceVisibility";

const VIEWER = "player-1";
const TARGET = "player-2";

const fixture = (existing: string[], relationship?: Record<string, unknown>) => {
  const documents = new Set(existing);
  const update = jest.fn();
  const firestore = {
    doc: (path: string) => ({get: async () => ({
      exists: documents.has(path),
      data: () => path === `users/${VIEWER}/knownRivals/${TARGET}`
        ? relationship ?? {targetUserId: TARGET, source: "completed_race"}
        : undefined,
    })}),
  };
  const database = {ref: jest.fn(() => ({update}))};
  return {firestore: firestore as never, database: database as never, update};
};

it("publishes only a server-established directed known-rival edge", async () => {
  const allowed = fixture([`users/${VIEWER}/knownRivals/${TARGET}`]);
  await expect(refreshPresenceVisibility(VIEWER, TARGET, allowed.firestore, allowed.database)).resolves.toBe(true);
  expect(allowed.update).toHaveBeenCalledWith({
    [`presenceVisibility/${VIEWER}/${TARGET}`]: true,
    [`presenceViewers/${TARGET}/${VIEWER}`]: true,
  });

  const stranger = fixture([]);
  await expect(refreshPresenceVisibility(VIEWER, TARGET, stranger.firestore, stranger.database)).resolves.toBe(false);
  expect(stranger.update).toHaveBeenCalledWith({
    [`presenceVisibility/${VIEWER}/${TARGET}`]: null,
    [`presenceViewers/${TARGET}/${VIEWER}`]: null,
  });
});

it.each([
  [{targetUserId: "player-3", source: "completed_race"}, "mismatched target"],
  [{targetUserId: TARGET, source: "unknown"}, "unknown source"],
  [{targetUserId: TARGET}, "missing source"],
])("fails closed for a malformed known-rival record (%s: %s)", async (relationship) => {
  const value = fixture([`users/${VIEWER}/knownRivals/${TARGET}`], relationship);
  await expect(refreshPresenceVisibility(VIEWER, TARGET, value.firestore, value.database)).resolves.toBe(false);
  expect(value.update).toHaveBeenCalledWith(expect.objectContaining({
    [`presenceVisibility/${VIEWER}/${TARGET}`]: null,
  }));
});

it.each([
  `users/${VIEWER}/blockedRivals/${TARGET}`,
  `users/${TARGET}/blockedRivals/${VIEWER}`,
])("revokes visibility when either player has blocked the other (%s)", async (blockPath) => {
  const blocked = fixture([`users/${VIEWER}/knownRivals/${TARGET}`, blockPath]);
  await expect(refreshPresenceVisibility(VIEWER, TARGET, blocked.firestore, blocked.database)).resolves.toBe(false);
  expect(blocked.update).toHaveBeenCalledWith(expect.objectContaining({
    [`presenceVisibility/${VIEWER}/${TARGET}`]: null,
  }));
});

it("rejects self and path-injection identity pairs", async () => {
  const value = fixture([]);
  await expect(refreshPresenceVisibility(VIEWER, VIEWER, value.firestore, value.database))
    .rejects.toThrow("invalid-presence-visibility-pair");
  await expect(refreshPresenceVisibility("../viewer", TARGET, value.firestore, value.database))
    .rejects.toThrow("invalid-presence-visibility-pair");
  expect(value.database.ref).not.toHaveBeenCalled();
});

it("deletes live state and every indexed incoming/outgoing visibility edge", async () => {
  const update = jest.fn();
  const values: Record<string, unknown> = {
    [`presenceViewers/${VIEWER}`]: {[TARGET]: true, "bad/path": true},
    [`presenceVisibility/${VIEWER}`]: {[TARGET]: true, "../bad": true},
  };
  const database = {
    ref: jest.fn((path?: string) => path
      ? {get: async () => ({val: () => values[path]})}
      : {update}),
  };
  await deletePresenceForUser(VIEWER, database as never);
  expect(update).toHaveBeenCalledWith(expect.objectContaining({
    [`presenceConnections/${VIEWER}`]: null,
    [`presenceConsent/${VIEWER}`]: null,
    [`presenceStatus/${VIEWER}`]: null,
    [`presenceOptIn/${VIEWER}`]: null,
    [`presenceVisibility/${VIEWER}`]: null,
    [`presenceViewers/${VIEWER}`]: null,
    [`presenceVisibility/${TARGET}/${VIEWER}`]: null,
    [`presenceViewers/${TARGET}/${VIEWER}`]: null,
  }));
  expect(JSON.stringify(update.mock.calls)).not.toContain("bad/path");
  expect(JSON.stringify(update.mock.calls)).not.toContain("../bad");
});
