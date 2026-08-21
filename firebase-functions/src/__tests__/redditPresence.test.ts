import {aggregateRedditPresence, disconnectRedditPresence, pollRedditPresence} from "../reddit/redditPresence";

const USER = `reddit_${"a".repeat(40)}`;
const RIVAL = `reddit_${"b".repeat(40)}`;
const NOW = 10_000;

describe("Reddit leased presence", () => {
  it("aggregates only unexpired Reddit sessions by activity priority", () => {
    expect(aggregateRedditPresence({a: {platform: "reddit", state: "online", expiresAtMs: NOW + 1},
      b: {platform: "reddit", state: "racing", expiresAtMs: NOW + 1}}, NOW)).toBe("racing");
    expect(aggregateRedditPresence({expired: {platform: "reddit", state: "racing", expiresAtMs: NOW},
      forged: {platform: "facebook", state: "racing", expiresAtMs: NOW + 1}}, NOW)).toBe("offline");
  });

  it("writes a lease and returns only unblocked known-rival state", async () => {
    const values = new Map<string, unknown>([
      [`presenceConnections/${RIVAL}`, {phone: {platform: "reddit", state: "playing", expiresAtMs: NOW + 1}}],
      [`presenceConsent/${RIVAL}`, true],
    ]);
    const update = jest.fn(async (entries: Record<string, unknown>) => Object.entries(entries).forEach(([key, value]) => values.set(key, value)));
    const database = {ref: (path = "") => ({get: async () => ({val: () => values.get(path)}), update,
      remove: async () => values.delete(path)})};
    const firestore = {
      collection: () => ({limit: () => ({get: async () => ({docs: [{id: RIVAL,
        data: () => ({targetUserId: RIVAL, source: "completed_race"})}]})})}),
      doc: () => ({get: async () => ({exists: false})}),
    };
    await expect(pollRedditPresence(USER, {sessionId: "session_123456789", state: "online", enabled: true},
      {database: database as never, firestore: firestore as never, nowMs: NOW}))
      .resolves.toEqual({rivals: [{userId: RIVAL, state: "playing"}]});
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      [`presenceConsent/${USER}`]: true,
      [`presenceConnections/${USER}/session_123456789`]: expect.objectContaining({platform: "reddit", expiresAtMs: 25_000}),
    }));
  });

  it("globally opts out and disconnects one session without affecting another", async () => {
    const values = new Map<string, unknown>([[`presenceConnections/${USER}`, {
      tab1: {platform: "reddit", state: "online", expiresAtMs: NOW + 1},
      tab2: {platform: "reddit", state: "racing", expiresAtMs: NOW + 1},
    }]]);
    const updates: Record<string, unknown>[] = [];
    const database = {ref: (path = "") => ({get: async () => ({val: () => values.get(path)}),
      update: async (value: Record<string, unknown>) => { updates.push(value); },
      remove: async () => {
        const sessions = values.get(`presenceConnections/${USER}`) as Record<string, unknown>;
        delete sessions[path.split("/").at(-1)!];
      }})};
    await disconnectRedditPresence(USER, "session_123456789", {database: database as never, nowMs: NOW});
    expect(updates.at(-1)).toMatchObject({[`presenceStatus/${USER}`]: {state: "racing"}});
    const firestore = {collection: () => ({limit: () => ({get: async () => ({docs: []})})})};
    await pollRedditPresence(USER, {sessionId: "session_123456789", state: "online", enabled: false},
      {database: database as never, firestore: firestore as never, nowMs: NOW});
    expect(updates.at(-1)).toMatchObject({[`presenceConsent/${USER}`]: false,
      [`presenceConnections/${USER}`]: null, [`presenceOptIn/${USER}`]: false});
  });
});
