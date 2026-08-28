import {aggregateRedditPresence, disconnectRedditPresence, pollRedditPresence} from "../reddit/redditPresence";

/** Renders the user interface. */
const USER = `reddit_${"a".repeat(40)}`;
/** Renders the rival interface. */
const RIVAL = `reddit_${"b".repeat(40)}`;
/** Renders the now interface. */
const NOW = 10_000;

describe("Reddit leased presence", () => {
  it("aggregates only unexpired Reddit sessions by activity priority", () => {
    expect(
      aggregateRedditPresence(
        {
          a: {platform: "reddit", state: "online", expiresAtMs: NOW + 1},
          b: {platform: "reddit", state: "racing", expiresAtMs: NOW + 1},
        },
        NOW,
      ),
    ).toBe("racing");
    expect(
      aggregateRedditPresence(
        {
          expired: {platform: "reddit", state: "racing", expiresAtMs: NOW},
          forged: {platform: "facebook", state: "racing", expiresAtMs: NOW + 1},
        },
        NOW,
      ),
    ).toBe("offline");
  });

  it("writes a lease and returns only unblocked known-rival state", async () => {
    /** Provides values behavior. */
    const values = new Map<string, unknown>([
      [`presenceConnections/${RIVAL}`, {phone: {platform: "reddit", state: "playing", expiresAtMs: NOW + 1}}],
      [`presenceConsent/${RIVAL}`, true],
    ]);
    /** Provides update behavior. */
    const update = jest.fn(async (entries: Record<string, unknown>) =>
      Object.entries(entries).forEach(([key, value]) => values.set(key, value)),
    );
    /** Provides database behavior. */
    const database = {
      ref: (path = "") => ({
        get: async () => ({val: () => values.get(path)}),
        update,
        remove: async () => values.delete(path),
      }),
    };
    /** Provides firestore behavior. */
    const firestore = {
      collection: () => ({
        limit: () => ({
          get: async () => ({docs: [{id: RIVAL, data: () => ({targetUserId: RIVAL, source: "completed_race"})}]}),
        }),
      }),
      doc: () => ({get: async () => ({exists: false})}),
    };
    await expect(
      pollRedditPresence(
        USER,
        {sessionId: "session_123456789", state: "online", enabled: true},
        {database: database as never, firestore: firestore as never, nowMs: NOW},
      ),
    ).resolves.toEqual({rivals: [{userId: RIVAL, state: "playing"}]});
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        [`presenceConsent/${USER}`]: true,
        [`presenceConnections/${USER}/session_123456789`]: expect.objectContaining({
          platform: "reddit",
          expiresAtMs: 25_000,
        }),
      }),
    );
  });

  it("globally opts out and disconnects one session without affecting another", async () => {
    /** Provides values behavior. */
    const values = new Map<string, unknown>([
      [
        `presenceConnections/${USER}`,
        {
          tab1: {platform: "reddit", state: "online", expiresAtMs: NOW + 1},
          tab2: {platform: "reddit", state: "racing", expiresAtMs: NOW + 1},
        },
      ],
    ]);
    /** Updates s. */
    const updates: Record<string, unknown>[] = [];
    /** Provides database behavior. */
    const database = {
      ref: (path = "") => ({
        get: async () => ({val: () => values.get(path)}),
        update: async (value: Record<string, unknown>) => {
          updates.push(value);
        },
        remove: async () => {
          /** Provides sessions behavior. */
          const sessions = values.get(`presenceConnections/${USER}`) as Record<string, unknown>;
          delete sessions[path.split("/").at(-1)!];
        },
      }),
    };
    await disconnectRedditPresence(USER, "session_123456789", {database: database as never, nowMs: NOW});
    expect(updates.at(-1)).toMatchObject({[`presenceStatus/${USER}`]: {state: "racing"}});
    /** Provides firestore behavior. */
    const firestore = {collection: () => ({limit: () => ({get: async () => ({docs: []})})})};
    await pollRedditPresence(
      USER,
      {sessionId: "session_123456789", state: "online", enabled: false},
      {database: database as never, firestore: firestore as never, nowMs: NOW},
    );
    expect(updates.at(-1)).toMatchObject({
      [`presenceConsent/${USER}`]: false,
      [`presenceConnections/${USER}`]: null,
      [`presenceOptIn/${USER}`]: false,
    });
  });
});
