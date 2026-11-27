// Lease draining is covered with the real deletion service in the ordering emulator suite.
jest.mock("../shared/accountDeletion", () => ({
  ...jest.requireActual("../shared/accountDeletion"),
  runWithAccountOperationLease: (_owner: string, _timeout: number, operation: () => Promise<unknown>) =>
    operation(),
}));

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
  /** A single fixture snapshot supplies coherent source reads. */
  const readTime = {seconds: 1, nanoseconds: 2, isEqual: () => true};
  /** Stored permission is asserted independently of transport calls. */
  const values = new Map<string, unknown>();
  /** Provides firestore behavior. */
  const firestore = {
    doc: (path: string) => ({path}),
    runTransaction: async (operation: (transaction: unknown) => Promise<unknown>) =>
      operation({
        getAll: async (
          ...references: Array<{
            /** Source document path. */
            path: string;
          }>
        ) =>
          references.map(({path}) => ({
            exists: documents.has(path),
            readTime,
            data: () =>
              path === `users/${VIEWER}/knownRivals/${TARGET}`
                ? (relationship ?? {targetUserId: TARGET, source: "completed_race"})
                : undefined,
          })),
      }),
  };
  /** Provides database behavior. */
  const database = {
    ref: jest.fn((path?: string) => ({
      update,
      transaction: async (operation: (value: unknown) => unknown) => {
        /** Applies the requested change to the independently stored fixture permission. */
        const next = operation(values.get(path!) ?? null);
        if (next !== undefined) values.set(path!, next);
        return {
          snapshot: {child: (key: string) => ({val: () => (values.get(path!) as Record<string, unknown>)?.[key]})},
        };
      },
    })),
  };
  return {firestore: firestore as never, database: database as never, update, values};
};

it("publishes only a server-established directed known-rival edge", async () => {
  /** Provides allowed behavior. */
  const allowed = fixture([`users/${VIEWER}/knownRivals/${TARGET}`]);
  await expect(refreshPresenceVisibility(VIEWER, TARGET, allowed.firestore, allowed.database)).resolves.toBe(true);
  expect(allowed.update).toHaveBeenCalledWith({
    [`presenceViewers/${TARGET}/${VIEWER}`]: true,
  });

  expect(allowed.values.get(`presenceVisibility/${VIEWER}/${TARGET}`)).toMatchObject({allowed: true});
  /** Provides stranger behavior. */
  const stranger = fixture([]);
  await expect(refreshPresenceVisibility(VIEWER, TARGET, stranger.firestore, stranger.database)).resolves.toBe(false);
  expect(stranger.update).toHaveBeenCalledWith({
    [`presenceViewers/${TARGET}/${VIEWER}`]: true,
  });
  expect(stranger.values.get(`presenceVisibility/${VIEWER}/${TARGET}`)).toMatchObject({allowed: false});
});

it.each([
  [{targetUserId: "player-3", source: "completed_race"}, "mismatched target"],
  [{targetUserId: TARGET, source: "unknown"}, "unknown source"],
  [{targetUserId: TARGET}, "missing source"],
])("fails closed for a malformed known-rival record (%s: %s)", async (relationship) => {
  /** Provides value behavior. */
  const value = fixture([`users/${VIEWER}/knownRivals/${TARGET}`], relationship);
  await expect(refreshPresenceVisibility(VIEWER, TARGET, value.firestore, value.database)).resolves.toBe(false);
  expect(value.values.get(`presenceVisibility/${VIEWER}/${TARGET}`)).toMatchObject({allowed: false});
});

it.each([`users/${VIEWER}/blockedRivals/${TARGET}`, `users/${TARGET}/blockedRivals/${VIEWER}`])(
  "revokes visibility when either player has blocked the other (%s)",
  async (blockPath) => {
    /** Provides blocked behavior. */
    const blocked = fixture([`users/${VIEWER}/knownRivals/${TARGET}`, blockPath]);
    await expect(refreshPresenceVisibility(VIEWER, TARGET, blocked.firestore, blocked.database)).resolves.toBe(false);
    expect(blocked.values.get(`presenceVisibility/${VIEWER}/${TARGET}`)).toMatchObject({allowed: false});
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
