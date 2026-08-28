import {
  aggregatePresenceValue,
  setPresenceConsentForUser,
  writeAggregatedPresence,
} from "../presence/presenceAggregation";

describe("presence server aggregation", () => {
  it("returns offline for missing or malformed connection maps", () => {
    expect(aggregatePresenceValue(null)).toBe("offline");
    expect(aggregatePresenceValue([])).toBe("offline");
    expect(aggregatePresenceValue({bad: {state: "forged"}})).toBe("offline");
    expect(aggregatePresenceValue({bad: {state: "racing", platform: "forged"}})).toBe("offline");
  });

  it("uses the highest activity across tabs and devices", () => {
    expect(
      aggregatePresenceValue({
        a: {platform: "jest", state: "online"},
        b: {platform: "facebook", state: "playing"},
      }),
    ).toBe("playing");
    expect(
      aggregatePresenceValue({
        a: {platform: "facebook", state: "racing"},
        b: {platform: "jest", state: "playing"},
      }),
    ).toBe("racing");
  });

  it("ignores malformed records without hiding a valid session", () => {
    expect(
      aggregatePresenceValue({
        a: null,
        b: {platform: "jest", state: 4},
        c: {platform: "jest", state: "online"},
      }),
    ).toBe("online");
  });

  it("provider-scoped kill switch suppresses Facebook without hiding Jest sessions", () => {
    /** Provides connections behavior. */
    const connections = {
      facebook: {platform: "facebook", state: "racing"},
      jest: {platform: "jest", state: "playing"},
    };
    expect(aggregatePresenceValue(connections, false)).toBe("playing");
    expect(aggregatePresenceValue({facebook: connections.facebook}, false)).toBe("offline");
    expect(aggregatePresenceValue(connections, true)).toBe("racing");
  });

  it("atomically revokes the opt-in read bit when the last connection disappears", async () => {
    /** Provides update behavior. */
    const update = jest.fn();
    /** Provides database behavior. */
    const database = {
      ref: jest.fn((path?: string) => (path ? {get: async () => ({val: () => null})} : {update})),
    };
    await expect(writeAggregatedPresence("player-1", database as never, 123)).resolves.toBe("offline");
    expect(update).toHaveBeenCalledWith({
      "presenceStatus/player-1": {state: "offline", updatedAt: 123},
      "presenceOptIn/player-1": false,
    });
  });

  it("atomically disables every session and rival read for an opted-out account", async () => {
    /** Provides update behavior. */
    const update = jest.fn(async () => undefined);
    /** Provides database behavior. */
    const database = {ref: jest.fn(() => ({update}))};
    /** Provides r id. */
    const userId = `facebook_${"a".repeat(40)}`;
    await setPresenceConsentForUser(userId, false, database as never, 456);
    expect(update).toHaveBeenCalledWith({
      [`presenceConsent/${userId}`]: false,
      [`presenceConnections/${userId}`]: null,
      [`presenceStatus/${userId}`]: {state: "offline", updatedAt: 456},
      [`presenceOptIn/${userId}`]: false,
    });
    await setPresenceConsentForUser(userId, true, database as never, 457);
    expect(update).toHaveBeenLastCalledWith({[`presenceConsent/${userId}`]: true});
    await expect(setPresenceConsentForUser("player-1", false, database as never, 456)).rejects.toThrow(
      "invalid-presence-consent",
    );
    await expect(setPresenceConsentForUser(userId, false, database as never, Number.NaN)).rejects.toThrow(
      "invalid-presence-consent",
    );
    expect(update).toHaveBeenCalledTimes(2);
  });
});
