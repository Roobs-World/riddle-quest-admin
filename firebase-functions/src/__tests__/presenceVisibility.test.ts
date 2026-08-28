import {deletePresenceForUser, refreshPresenceVisibility} from "../presence/presenceVisibility";

/** Renders the viewer interface. */
const VIEWER = "player-1";
/** Renders the target interface. */
const TARGET = "player-2";

/** Provides fixture behavior. */
const fixture = (existing: string[], relationship?: Record<string, unknown>) => {
  /** Provides documents behavior. */
  const documents = new Set(existing);
  /** Provides update behavior. */
  const update = jest.fn();
  /** Provides firestore behavior. */
  const firestore = {
    doc: (path: string) => ({
      get: async () => ({
        exists: documents.has(path),
        data: () =>
          path === `users/${VIEWER}/knownRivals/${TARGET}`
            ? (relationship ?? {targetUserId: TARGET, source: "completed_race"})
            : undefined,
      }),
    }),
  };
  /** Provides database behavior. */
  const database = {ref: jest.fn(() => ({update}))};
  return {firestore: firestore as never, database: database as never, update};
};

it("publishes only a server-established directed known-rival edge", async () => {
  /** Provides allowed behavior. */
  const allowed = fixture([`users/${VIEWER}/knownRivals/${TARGET}`]);
  await expect(refreshPresenceVisibility(VIEWER, TARGET, allowed.firestore, allowed.database)).resolves.toBe(true);
  expect(allowed.update).toHaveBeenCalledWith({
    [`presenceVisibility/${VIEWER}/${TARGET}`]: true,
    [`presenceViewers/${TARGET}/${VIEWER}`]: true,
  });

  /** Provides stranger behavior. */
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
  /** Provides value behavior. */
  const value = fixture([`users/${VIEWER}/knownRivals/${TARGET}`], relationship);
  await expect(refreshPresenceVisibility(VIEWER, TARGET, value.firestore, value.database)).resolves.toBe(false);
  expect(value.update).toHaveBeenCalledWith(
    expect.objectContaining({
      [`presenceVisibility/${VIEWER}/${TARGET}`]: null,
    }),
  );
});

it.each([`users/${VIEWER}/blockedRivals/${TARGET}`, `users/${TARGET}/blockedRivals/${VIEWER}`])(
  "revokes visibility when either player has blocked the other (%s)",
  async (blockPath) => {
    /** Provides blocked behavior. */
    const blocked = fixture([`users/${VIEWER}/knownRivals/${TARGET}`, blockPath]);
    await expect(refreshPresenceVisibility(VIEWER, TARGET, blocked.firestore, blocked.database)).resolves.toBe(false);
    expect(blocked.update).toHaveBeenCalledWith(
      expect.objectContaining({
        [`presenceVisibility/${VIEWER}/${TARGET}`]: null,
      }),
    );
  },
);

it("rejects self and path-injection identity pairs", async () => {
  /** Provides value behavior. */
  const value = fixture([]);
  await expect(refreshPresenceVisibility(VIEWER, VIEWER, value.firestore, value.database)).rejects.toThrow(
    "invalid-presence-visibility-pair",
  );
  await expect(refreshPresenceVisibility("../viewer", TARGET, value.firestore, value.database)).rejects.toThrow(
    "invalid-presence-visibility-pair",
  );
  expect(value.database.ref).not.toHaveBeenCalled();
});

it("deletes live state and every indexed incoming/outgoing visibility edge", async () => {
  /** Provides update behavior. */
  const update = jest.fn();
  /** Provides values behavior. */
  const values: Record<string, unknown> = {
    [`presenceViewers/${VIEWER}`]: {[TARGET]: true, "bad/path": true},
    [`presenceVisibility/${VIEWER}`]: {[TARGET]: true, "../bad": true},
  };
  /** Provides database behavior. */
  const database = {
    ref: jest.fn((path?: string) => (path ? {get: async () => ({val: () => values[path]})} : {update})),
  };
  await deletePresenceForUser(VIEWER, database as never);
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      [`presenceConnections/${VIEWER}`]: null,
      [`presenceConsent/${VIEWER}`]: null,
      [`presenceStatus/${VIEWER}`]: null,
      [`presenceOptIn/${VIEWER}`]: null,
      [`presenceVisibility/${VIEWER}`]: null,
      [`presenceViewers/${VIEWER}`]: null,
      [`presenceVisibility/${TARGET}/${VIEWER}`]: null,
      [`presenceViewers/${TARGET}/${VIEWER}`]: null,
    }),
  );
  expect(JSON.stringify(update.mock.calls)).not.toContain("bad/path");
  expect(JSON.stringify(update.mock.calls)).not.toContain("../bad");
});
